"""Statistical controls and input integrity for issue #8."""
import csv
import importlib.util
import json
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("rq05_rq06", ROOT / "scripts/analyze-rq05-rq06.py")
analysis = importlib.util.module_from_spec(spec)
spec.loader.exec_module(analysis)


@pytest.fixture
def dataset(tmp_path):
    path = tmp_path / "dataset.csv"
    headers = ["repository", "window_start", "window_end", "cfr_b_validation", *analysis.NUMERIC]
    rows = []
    for i in range(12):
        row = dict.fromkeys(headers, "")
        row.update(repository=f"org/repo{i}", window_start="2025-01-01", window_end="2025-12-31",
                   cfr_b_validation="pending_independent_labels", stars=i, contributors_count=i // 3,
                   age_days=100 + i, deployment_frequency=i, lead_time_release_median_hours=12-i,
                   lead_time_commit_median_hours=i, cfr_ci=i/12, cfr_b=(11-i)/12,
                   recovery_median_hours="" if i < 3 else i)
        rows.append(row)
    rows[0]["repository"] = "tw93/Mole"
    rows[0]["lead_time_commit_median_hours"] = "'-14.5"
    with path.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=headers)
        writer.writeheader()
        writer.writerows(rows)
    return path


@pytest.mark.parametrize("raw,column,reason", [
    ("", "cfr_ci", "missing"), ("nan", "age_days", "not_finite"),
    ("inf", "age_days", "not_finite"), ("oops", "stars", "not_numeric"),
    ("'-14", "lead_time_commit_median_hours", "negative_value"),
    ("1.1", "cfr_ci", "proportion_outside_0_1"), ("1.5", "stars", "count_not_integer"),
])
def test_invalid_numbers(raw, column, reason):
    value, actual = analysis.parse_number(raw, column)
    assert np.isnan(value)
    assert actual == reason


def test_zero_and_numeric_csv_protection():
    assert analysis.parse_number("0", "recovery_median_hours") == (0.0, "")
    assert analysis.parse_number("'+12", "stars") == (12.0, "")


def test_local_exclusion_and_fixed_cuts(dataset):
    before = dataset.read_bytes()
    frame, quality = analysis.load_dataset(dataset, 12)
    result = analysis.analyze(frame, quality, repetitions=0)
    assert dataset.read_bytes() == before
    assert len(result["tests"]) == 18
    for row in result["tests"]:
        expected = 11 if row["metric"] == "lead_time_commit_median_hours" else 9 if row["metric"] == "recovery_median_hours" else 12
        assert row["n"] == expected
    assert quality[0]["repository"] == "tw93/Mole"
    assert quality[0]["reason"] == "negative_value"
    assert result["factors"]["stars"]["cuts"] == [2.75, 5.5, 8.25]
    empty = [r for r in result["group_summary"] if r["factor"] == "stars" and r["metric"] == "recovery_median_hours" and r["group"] == "Q1"]
    assert empty[0]["n"] == 0 and empty[0]["median"] is None
    assert frame.loc[0, "deployment_frequency"] == 0
    assert result["correlations"][0]["n"] == 12


@pytest.mark.parametrize("values,expected", [([1]*10, 1), ([1]*9+[2], 2), ([1,1,2,2,3,3,4,4], 4)])
def test_ties_never_split(values, expected):
    series = pd.Series(values)
    groups, meta = analysis.quartile_groups(series)
    assert len(meta["groups"]) == expected
    for value in set(values):
        assert groups[series == value].nunique() == 1
    assert sum(g["factor_n"] for g in meta["groups"]) == len(values)


def test_missing_factor_has_no_groups():
    groups, meta = analysis.quartile_groups(pd.Series([np.nan]*5))
    assert groups.isna().all() and meta["groups"] == []


def test_known_spearman_and_pairwise_missing():
    frame = pd.DataFrame({"deployment_frequency": [0,1,2,3,np.nan], "cfr_ci": [0,.2,.4,.8,1]})
    result = analysis.correlation(frame, "cfr_ci", repetitions=0)
    assert result["rho"] == pytest.approx(1)
    assert result["n"] == 4 and result["excluded_n"] == 1
    frame["cfr_ci"] = [1,.8,.4,0,0]
    assert analysis.correlation(frame, "cfr_ci", 0)["rho"] == pytest.approx(-1)


def test_constant_correlation_is_not_zero():
    frame = pd.DataFrame({"deployment_frequency": [1]*5, "cfr_ci": [0,.2,.4,.6,.8]})
    result = analysis.correlation(frame, "cfr_ci", 0)
    assert result["status"] == "not_estimable" and result["rho"] is None
    assert result["reason"] == "constant_variable"


def test_permutation_is_reproducible_and_two_sided():
    p = analysis.permutation_pvalue([1,2,3,4], [1,2,3,4], 1, 4999, 42)
    assert p == analysis.permutation_pvalue([1,2,3,4], [1,2,3,4], 1, 4999, 42)
    assert p == pytest.approx(2/24, abs=.02)


def test_known_kruskal_and_epsilon():
    result = analysis.compare_groups({"Q1": [1,2,3], "Q2": [4,5,6], "Q3": [7,8,9]})
    assert result["statistic"] == pytest.approx(7.2)
    assert result["p_value"] == pytest.approx(np.exp(-3.6))
    assert result["effect"] == pytest.approx(.9)


def test_kruskal_tie_correction():
    result = analysis.compare_groups({"Q1": [1,1], "Q2": [2,2], "Q3": [3,3]})
    assert result["statistic"] == pytest.approx(5)
    assert result["effect"] == pytest.approx(1)


def test_insufficient_pairs():
    frame = pd.DataFrame({"deployment_frequency": [1,2], "cfr_ci": [0,1]})
    result = analysis.correlation(frame, "cfr_ci", 0)
    assert result["reason"] == "fewer_than_3_valid_pairs" and result["p_value"] is None


def test_mann_whitney_delta_sign_and_empty_groups():
    result = analysis.compare_groups({"Q1": [1,2,3], "Q2": [], "Q3": [4,5,6]})
    assert result["test"] == "mann_whitney_u"
    assert result["p_value"] == pytest.approx(.1)
    assert result["effect"] == -1 and result["group_order"] == "Q1;Q3"
    assert analysis.compare_groups({"Q1": [4,5,6], "Q2": [1,2,3]})["effect"] == 1


def test_tie_corrected_delta_matches_pair_count():
    x, y = [1,2,2], [2,3,3]
    expected = sum(np.sign(a-b) for a in x for b in y) / (len(x)*len(y))
    result = analysis.compare_groups({"Q1": x, "Q2": y})
    assert result["effect"] == pytest.approx(expected)
    assert result["method"].startswith("asymptotic")


def test_nonestimable_group_cases():
    assert analysis.compare_groups({"Q1": [], "Q2": [1,2]})["reason"] == "fewer_than_2_nonempty_groups"
    assert analysis.compare_groups({"Q1": [1,1], "Q2": [1,1]})["reason"] == "constant_metric"


def test_known_holm_family():
    rows = [{"status": "estimated", "p_value": p} for p in [.01,.04,.03]]
    rows.append({"status": "not_estimable", "p_value": None})
    analysis.holm_adjust(rows)
    assert [r["p_adjusted"] for r in rows[:3]] == pytest.approx([.03,.06,.06])
    assert [r["reject_holm"] for r in rows] == [True,False,False,None]
    assert all(r["family_planned"] == 18 and r["family_estimable"] == 3 for r in rows)


def test_run_exports_and_source_integrity(dataset, tmp_path):
    before = dataset.read_bytes()
    output = tmp_path / "results"
    manifest = analysis.run(dataset, output, 12, ("2025-01-01", "2025-12-31"), 0, 42, True)
    assert dataset.read_bytes() == before
    assert manifest["rows"] == 12
    result = json.loads((output / "analysis.json").read_text(encoding="utf-8"))
    assert len(result["tests"]) == 18
    assert "NaN" not in (output / "analysis.json").read_text(encoding="utf-8")
    assert (output / "REPORT.md").is_file()
    with (output / "rq05-correlations.csv").open(encoding="utf-8-sig", newline="") as stream:
        assert len(list(csv.DictReader(stream))) == 2


def test_input_guards(dataset, tmp_path):
    with pytest.raises(ValueError, match="Esperados"):
        analysis.load_dataset(dataset, 300)
    with pytest.raises(ValueError, match="Janela divergente"):
        analysis.load_dataset(dataset, 12, ("2024-01-01", "2024-12-31"))
    with pytest.raises(ValueError):
        analysis.run(dataset, dataset.parent, 12, ("2025-01-01", "2025-12-31"), 0, 42, True)
    text = dataset.read_text(encoding="utf-8")
    dataset.write_text(text.replace("org/repo1,", "tw93/Mole,"), encoding="utf-8")
    with pytest.raises(ValueError, match="duplicado"):
        analysis.load_dataset(dataset, 12)


def test_versioned_cohort_and_independent_rank_formula():
    """Real-cohort denominators, KW tie correction and Holm via direct formulas."""
    path = ROOT / "data/dataset-s02-final/dataset.csv"
    before = path.read_bytes()
    frame, quality = analysis.load_dataset(path)
    result = analysis.analyze(frame, quality, repetitions=0)
    assert {m: int(frame[m].notna().sum()) for m in analysis.MEASURES} == {
        "deployment_frequency": 300, "lead_time_release_median_hours": 300,
        "lead_time_commit_median_hours": 299, "cfr_ci": 300, "cfr_b": 300,
        "recovery_median_hours": 258,
    }
    for test in result["tests"]:
        assigned, _ = analysis.quartile_groups(frame[test["factor"]])
        subset = frame.loc[assigned.notna() & frame[test["metric"]].notna(), [test["metric"]]].copy()
        subset["group"] = assigned.loc[subset.index]
        subset["rank"] = subset[test["metric"]].rank(method="average")
        n = len(subset)
        rank_groups = subset.groupby("group")["rank"].agg(["sum", "size"])
        uncorrected = 12/(n*(n+1)) * sum(rank_groups["sum"]**2/rank_groups["size"]) - 3*(n+1)
        ties = subset[test["metric"]].value_counts()
        correction = 1 - sum(ties**3-ties)/(n**3-n)
        assert test["statistic"] == pytest.approx(uncorrected/correction, abs=1e-10)
    ordered = sorted(result["tests"], key=lambda r: r["p_value"])
    previous = 0
    for i, test in enumerate(ordered):
        previous = min(1, max(previous, (len(ordered)-i)*test["p_value"]))
        assert test["p_adjusted"] == pytest.approx(previous)
    assert path.read_bytes() == before
