"""Issue #8: local, reproducible association analysis from repository-level exports."""
from __future__ import annotations

import argparse
import csv
import hashlib
import importlib.metadata
import json
import math
from datetime import date, datetime, timezone
from pathlib import Path
import platform
import sys

import numpy as np
import pandas as pd
from scipy import stats
from statsmodels.stats.multitest import multipletests

ROOT = Path(__file__).resolve().parents[1]
MEASURES = {
    "deployment_frequency": ("Frequência", "releases/semana"),
    "lead_time_release_median_hours": ("Lead time por release", "horas"),
    "lead_time_commit_median_hours": ("Lead time por commit", "horas"),
    "cfr_ci": ("CFR de CI", "proporção"),
    "cfr_b": ("CFR por releases (exploratório)", "proporção"),
    "recovery_median_hours": ("Recuperação observada", "horas"),
}
FACTORS = {"stars": "Estrelas", "contributors_count": "Contribuidores", "age_days": "Idade (dias)"}
NUMERIC = list(FACTORS) + list(MEASURES)
ALPHA = 0.05
SOURCES = {
    "spearman": "https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.spearmanr.html",
    "kruskal": "https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.kruskal.html",
    "mannwhitney": "https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.mannwhitneyu.html",
    "holm": "https://www.statsmodels.org/stable/generated/statsmodels.stats.multitest.multipletests.html",
}


def parse_number(raw: str, column: str) -> tuple[float, str]:
    value = str(raw).strip()
    if not value:
        return np.nan, "missing"
    # Only numeric fields are unescaped; repository names and source text remain untouched.
    if value.startswith("'") and len(value) > 1 and value[1] in "-+":
        value = value[1:]
    try:
        number = float(value)
    except ValueError:
        return np.nan, "not_numeric"
    if not math.isfinite(number):
        return np.nan, "not_finite"
    if number < 0:
        return np.nan, "negative_value"
    if column in ("cfr_ci", "cfr_b") and number > 1:
        return np.nan, "proportion_outside_0_1"
    if column in ("stars", "contributors_count") and not number.is_integer():
        return np.nan, "count_not_integer"
    return number, ""


def load_dataset(dataset: Path, expected_rows: int = 300,
                 expected_window: tuple[str, str] = ("2025-01-01", "2025-12-31")):
    with dataset.open(encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream)
        headers = reader.fieldnames or []
        if len(headers) != len(set(headers)):
            raise ValueError("Cabeçalhos duplicados.")
        required = {"repository", "window_start", "window_end", "cfr_b_validation", *NUMERIC}
        if not required.issubset(headers):
            raise ValueError(f"Colunas ausentes: {sorted(required - set(headers))}")
        raw = list(reader)
    if len(raw) != expected_rows or not raw:
        raise ValueError(f"Esperados {expected_rows} projetos; encontrados {len(raw)}.")
    clean, warnings, seen, windows = [], [], set(), set()
    for row in raw:
        if None in row or any(value is None for value in row.values()):
            raise ValueError("Linha com quantidade de campos incompatível com o cabeçalho.")
        repository = row["repository"].strip()
        if not repository or repository.casefold() in seen:
            raise ValueError(f"Repositório vazio ou duplicado: {repository}")
        seen.add(repository.casefold())
        start, end = row["window_start"], row["window_end"]
        if date.fromisoformat(start) > date.fromisoformat(end):
            raise ValueError("Janela invertida.")
        windows.add((start, end))
        record = {"repository": repository, "cfr_b_validation": row["cfr_b_validation"] or "unknown"}
        for column in NUMERIC:
            record[column], reason = parse_number(row[column], column)
            if reason:
                warnings.append({"repository": repository, "column": column,
                                 "raw_value": row[column], "reason": reason,
                                 "action": "exclude_from_affected_analysis_only"})
        clean.append(record)
    if windows != {tuple(expected_window)}:
        raise ValueError(f"Janela divergente: {sorted(windows)}; esperada {expected_window}.")
    return pd.DataFrame(clean), warnings


def quartile_groups(values: pd.Series):
    """Linear quartiles on the full valid factor. Equal values always stay together."""
    valid = values.dropna()
    assigned = pd.Series(index=values.index, dtype="object")
    quantiles = valid.quantile([0.25, 0.5, 0.75], interpolation="linear").tolist() if len(valid) else []
    if not len(valid):
        return assigned, {"factor_n": 0, "quantiles": [], "cuts": [], "groups": [], "groups_reduced": True}
    cuts = sorted({float(q) for q in quantiles if q < valid.max()})
    initial = np.searchsorted(cuts, valid.to_numpy(), side="left")
    occupied = sorted(set(initial.tolist()))
    # Coalesce empty intervals, never split a tied value to balance group sizes.
    cuts = [cuts[i] for i in occupied[:-1]]
    indices = np.searchsorted(cuts, valid.to_numpy(), side="left")
    assigned.loc[valid.index] = [f"Q{i + 1}" for i in indices]
    groups = []
    for i in range(len(cuts) + 1):
        label = f"Q{i + 1}"
        groups.append({"group": label, "lower_exclusive": cuts[i - 1] if i else None,
                       "upper_inclusive": cuts[i] if i < len(cuts) else None,
                       "factor_n": int((assigned == label).sum())})
    return assigned, {"factor_n": len(valid), "quantiles": quantiles, "cuts": cuts,
                      "groups": groups, "groups_reduced": len(groups) < 4,
                      "boundary_rule": "(lower, upper]; unbounded endpoints; empty intervals coalesced"}


def permutation_pvalue(x, y, rho: float, repetitions: int, seed: int) -> float | None:
    if repetitions == 0:
        return None
    rng = np.random.default_rng(seed)
    a, b = stats.rankdata(x), stats.rankdata(y)
    a, b = a - a.mean(), b - b.mean()
    denominator = np.linalg.norm(a) * np.linalg.norm(b)
    extreme = sum(abs(float(np.dot(a, rng.permutation(b)) / denominator)) >= abs(rho) - 1e-14
                  for _ in range(repetitions))
    return (extreme + 1) / (repetitions + 1)


def correlation(frame: pd.DataFrame, y: str, repetitions: int = 9999, seed: int = 42):
    pair = frame[["deployment_frequency", y]].dropna()
    result = {"variant": "RQ05a" if y == "cfr_ci" else "RQ05b", "x": "deployment_frequency", "y": y,
              "rho": None, "p_value": None, "p_permutation": None, "n": len(pair),
              "excluded_n": len(frame) - len(pair), "status": "not_estimable", "reason": "",
              "permutations": repetitions, "seed": seed,
              "metric_validation": validation_state(frame, y)}
    if len(pair) < 3:
        result["reason"] = "fewer_than_3_valid_pairs"
    elif any(pair[column].nunique() < 2 for column in pair):
        result["reason"] = "constant_variable"
    else:
        rho, p = stats.spearmanr(pair.iloc[:, 0], pair.iloc[:, 1], alternative="two-sided")
        if not (np.isfinite(rho) and np.isfinite(p)):
            result["reason"] = "non_finite_statistic"
            return result
        result.update(rho=float(rho), p_value=float(p), status="estimated")
        result["p_permutation"] = permutation_pvalue(pair.iloc[:, 0], pair.iloc[:, 1], float(rho), repetitions, seed)
    return result


def validation_state(frame: pd.DataFrame, metric: str) -> str:
    if metric != "cfr_b":
        return "not_applicable"
    states = sorted(set(frame["cfr_b_validation"]))
    return "validated" if states == ["validated"] else "exploratory:" + ",".join(states)


def cliff_magnitude(delta: float) -> str:
    value = abs(delta)
    return "desprezível" if value < .147 else "pequeno" if value < .33 else "médio" if value < .474 else "grande"


def compare_groups(samples: dict[str, np.ndarray]):
    active = {name: np.asarray(values, dtype=float) for name, values in samples.items() if len(values)}
    n = sum(map(len, active.values()))
    result = {"status": "not_estimable", "reason": "", "test": "", "statistic": None,
              "p_value": None, "effect_name": "", "effect": None, "effect_magnitude": "",
              "n": n, "groups_used": len(active), "method": "", "small_group": any(len(v) < 5 for v in active.values()),
              "group_order": ";".join(active)}
    if len(active) < 2:
        result["reason"] = "fewer_than_2_nonempty_groups"
        return result
    if np.unique(np.concatenate(list(active.values()))).size < 2:
        result["reason"] = "constant_metric"
        return result
    if len(active) == 2:
        x, y = active.values()
        ties = np.unique(np.concatenate([x, y])).size < n
        method = "exact" if min(len(x), len(y)) <= 8 and not ties else "asymptotic"
        statistic, p = stats.mannwhitneyu(x, y, alternative="two-sided", method=method, use_continuity=True)
        effect = 2 * statistic / (len(x) * len(y)) - 1
        result.update(test="mann_whitney_u", method=method + ("; tie correction; continuity=True" if method == "asymptotic" else "; no ties"),
                      effect_name="cliffs_delta", effect=float(effect), effect_magnitude=cliff_magnitude(float(effect)))
    else:
        statistic, p = stats.kruskal(*active.values(), nan_policy="raise")
        result.update(test="kruskal_wallis", method="chi_square_asymptotic; tie correction",
                      effect_name="epsilon_squared_H_over_n_minus_1", effect=float(statistic / (n - 1)))
    if not (np.isfinite(statistic) and np.isfinite(p)):
        result.update(reason="non_finite_statistic", effect=None)
        return result
    result.update(status="estimated", statistic=float(statistic), p_value=float(p))
    return result


def holm_adjust(tests: list[dict], planned: int = 18):
    estimable = [row for row in tests if row["status"] == "estimated" and row["p_value"] is not None]
    for row in tests:
        row.update(p_adjusted=None, reject_holm=None, family_planned=planned, family_estimable=len(estimable))
    if estimable:
        rejected, adjusted, _, _ = multipletests([row["p_value"] for row in estimable], alpha=ALPHA, method="holm")
        for row, reject, p in zip(estimable, rejected, adjusted):
            row.update(p_adjusted=float(p), reject_holm=bool(reject))


def summarize(values):
    if not len(values):
        return {"n": 0, "q1": None, "median": None, "q3": None, "iqr": None}
    q1, median, q3 = np.quantile(values, [.25, .5, .75], method="linear")
    return {"n": len(values), "q1": float(q1), "median": float(median), "q3": float(q3), "iqr": float(q3 - q1)}


def analyze(frame, quality, repetitions=9999, seed=42):
    correlations = [correlation(frame, metric, repetitions, seed + i) for i, metric in enumerate(("cfr_ci", "cfr_b"))]
    factors, groups, summaries, tests, exclusions = {}, {}, [], [], []
    warnings_by_key = {(w["repository"], w["column"]): w for w in quality}

    def exclude(analysis, columns):
        for _, row in frame.iterrows():
            for column in columns:
                if pd.isna(row[column]):
                    event = warnings_by_key.get((row["repository"], column), {"raw_value": "", "reason": "missing"})
                    exclusions.append({"analysis": analysis, "repository": row["repository"], "column": column,
                                       "raw_value": event["raw_value"], "reason": event["reason"]})

    for result in correlations:
        exclude(result["variant"], [result["x"], result["y"]])
    for factor in FACTORS:
        assigned, factor_info = quartile_groups(frame[factor])
        factors[factor], groups[factor] = factor_info, assigned
        for metric, (_, unit) in MEASURES.items():
            samples = {}
            for group in factor_info["groups"]:
                values = frame.loc[assigned == group["group"], metric].dropna().to_numpy()
                samples[group["group"]] = values
                summaries.append({"factor": factor, "metric": metric, "unit": unit, **group,
                                  **summarize(values), "metric_validation": validation_state(frame, metric)})
            result = compare_groups(samples)
            result.update(factor=factor, metric=metric, unit=unit, excluded_n=len(frame) - result["n"],
                          groups_planned=len(factor_info["groups"]), metric_validation=validation_state(frame, metric))
            tests.append(result)
            exclude("RQ06:" + factor + ":" + metric, [factor, metric])
    holm_adjust(tests, len(FACTORS) * len(MEASURES))
    assignments = [{"repository": row["repository"], **{factor + "_group": groups[factor].iloc[i] if pd.notna(groups[factor].iloc[i]) else "" for factor in FACTORS}}
                   for i, (_, row) in enumerate(frame.iterrows())]
    return {"correlations": correlations, "tests": tests, "group_summary": summaries,
            "factors": factors, "assignments": assignments, "exclusions": exclusions, "quality": quality}


def write_csv(path: Path, rows: list[dict], headers: list[str]):
    def safe(value):
        if value is None or isinstance(value, float) and not np.isfinite(value):
            return ""
        if isinstance(value, str) and value[:1] in ("=", "+", "-", "@", "\t", "\r"):
            return "'" + value
        return value
    with path.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=headers, extrasaction="raise")
        writer.writeheader()
        writer.writerows({key: safe(row.get(key)) for key in headers} for row in rows)


def fmt(value):
    return "—" if value is None else f"{value:.6g}"


def make_plots(frame, result, output):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.ticker import PercentFormatter
    plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 10, "svg.hashsalt": "dora-issue-8"})
    output.mkdir(parents=True, exist_ok=True)
    files = []

    def save(fig, stem):
        for ext in ("png", "svg"):
            path = output / f"{stem}.{ext}"
            fig.savefig(path, dpi=160, bbox_inches="tight", metadata={"Date": None} if ext == "svg" else None)
            files.append(path.name)
        plt.close(fig)

    for row in result["correlations"]:
        pair = frame[[row["x"], row["y"]]].dropna()
        fig, ax = plt.subplots(figsize=(7.5, 5.3), layout="constrained")
        ax.scatter(pair.iloc[:, 0], pair.iloc[:, 1] * 100, s=24, alpha=.65,
                   color="#ad5b19" if row["y"] == "cfr_b" else "#245e89", edgecolors="none")
        if len(pair) and pair.iloc[:, 0].min() > 0:
            ax.set_xscale("log")
            ax.set_xlabel("Frequência de releases (releases/semana; escala log)")
        else:
            ax.set_xlabel("Frequência de releases (releases/semana)")
        ax.set_ylabel(MEASURES[row["y"]][0] + " (%)")
        ax.set_ylim(-2, 102)
        ax.yaxis.set_major_formatter(PercentFormatter())
        ax.set_title(f"{row['variant']}: frequência e {MEASURES[row['y']][0]}\nn={row['n']}; ρ={fmt(row['rho'])}; p={fmt(row['p_value'])}\np por permutação={fmt(row['p_permutation'])}", fontsize=11)
        ax.grid(alpha=.2)
        ax.set_axisbelow(True)
        save(fig, "rq05-" + row["y"].replace("_", "-"))
    colors = ["#bed4e5", "#8cb5d2", "#5790ba", "#28628e"]
    for factor, title in FACTORS.items():
        assigned, _ = quartile_groups(frame[factor])
        fig, axes = plt.subplots(2, 3, figsize=(15, 8.7), layout="constrained")
        fig.suptitle("RQ06 — " + title + ": cortes fixos do fator, sem imputação", fontsize=14)
        for ax, (metric, (label, unit)) in zip(axes.flat, MEASURES.items()):
            names = [group["group"] for group in result["factors"][factor]["groups"]]
            arrays = [frame.loc[assigned == group, metric].dropna().to_numpy() for group in names]
            rates = metric in ("cfr_ci", "cfr_b")
            shown = [values * 100 if rates else values for values in arrays]
            if shown:
                boxes = ax.boxplot(shown, positions=np.arange(1, len(names) + 1), patch_artist=True, widths=.55,
                                   medianprops={"color": "#1a1a1a", "linewidth": 1.7},
                                   flierprops={"marker": ".", "markersize": 3, "alpha": .5})
                for patch, color in zip(boxes["boxes"], colors):
                    patch.set_facecolor(color)
                ax.set_xticks(np.arange(1, len(names) + 1), [f"{name}\nn={len(values)}" for name, values in zip(names, arrays)])
            if rates:
                ax.set_ylim(-2, 102)
                ax.yaxis.set_major_formatter(PercentFormatter())
                ax.set_ylabel("%")
            else:
                ax.set_yscale("symlog", linthresh=1)
                ax.set_ylim(bottom=0)
                ax.set_ylabel(unit + " (symlog; linear até 1)")
            ax.set_title(label, fontsize=10)
            ax.grid(axis="y", alpha=.2)
            ax.set_axisbelow(True)
        save(fig, "rq06-" + factor.replace("_", "-"))
    return files


def report_text(result, manifest):
    n = manifest["rows"]
    lines = ["# Issue #8 — RQ05 e RQ06", "",
             f"Base: **{n} repositórios**, uma linha e um peso por projeto, janela UTC **{manifest['window_start']} a {manifest['window_end']}**. Análise local, sem token ou nova coleta. O CSV original não foi alterado.", "",
             "## Método", "",
             "O plano fixado no código usa duas correlações de Spearman bilaterais e uma família de 18 testes (três fatores × seis medidas). Estrelas, contribuidores e idade foram escolhidos antes da execução por estarem disponíveis para a coorte, sem depender do tipo de projeto ainda sem consenso. Não houve seleção de fatores ou métodos por p-valor.", "",
             "Ausentes, números não finitos, durações/frequências negativas e proporções fora de [0,1] são excluídos apenas da análise afetada. O apóstrofo de proteção é removido somente na conversão numérica. Valores zero reais são preservados. As exclusões por análise estão em `exclusions.csv` e as ocorrências por coluna em `quality-warnings.csv`.", "",
             "O p de Spearman fornecido pelo SciPy é assintótico. Como n<500, também relatamos uma verificação Monte Carlo bilateral por permutação de um vetor de postos, com correção (extremos+1)/(B+1). Esse resultado é adicional e não substitui silenciosamente o método pedido. Não houve interrupção por significância.", "",
             f"Permutações por par: **{manifest['plan']['permutations']}**; sementes: **{manifest['plan']['seed']} e {manifest['plan']['seed'] + 1}**. A resolução mínima do p Monte Carlo é 1/(B+1); não se trata de enumeração exata de todas as permutações.", "",
             "Os quartis usam interpolação linear. Cada fator recebe cortes uma única vez, na base inteira válida desse fator, antes de filtrar cada métrica. Intervalos são (inferior, superior], com extremos abertos ilimitados. Bordas repetidas e intervalos vazios são coalescidos; valores empatados nunca são separados para equilibrar n.", "",
             "Com três ou mais grupos não vazios usamos Kruskal–Wallis, com correção de empates, e ε²=H/(n−1), conforme a fórmula exigida no README. Com dois grupos usamos Mann–Whitney bilateral e δ=2U1/(n1×n2)−1, mantendo a ordem crescente dos grupos. O método exato é usado apenas com min(n1,n2)≤8 e sem empates; nos demais casos usa-se aproximação com correção de empates e continuidade. Grupos com n<5 são sinalizados. Não há teste de normalidade ou post-hoc nesta entrega.", "",
             "Holm é aplicado em uma única família aos p-valores estimáveis dos 18 testes planejados, α=0,05. A saída registra o número planejado e o efetivamente corrigido. Não estimável permanece vazio, nunca vira p=1 ou efeito zero. Os dois testes da RQ05 são relatados separadamente e não entram na família da RQ06.", "",
             "## Qualidade e tamanhos de amostra", "", "| Medida | n válido | Ausentes/inválidos |", "|---|---:|---:|"]
    for metric, control in manifest["valid_counts"].items():
        lines.append(f"| {MEASURES[metric][0]} | {control} | {n-control} |")
    invalid = [w for w in result["quality"] if w["reason"] != "missing"]
    for w in invalid:
        lines.append(f"\nValor excluído da medida afetada: `{w['repository']}`, `{w['column']}`, motivo `{w['reason']}`. A fonte permanece intacta.")
    lines += ["", "## RQ05 — Frequência e falhas", "",
              "| Proxy | n | ρ | p assintótico | p permutação | Estado |", "|---|---:|---:|---:|---:|---|"]
    for row in result["correlations"]:
        lines.append(f"| {row['y']} | {row['n']} | {fmt(row['rho'])} | {fmt(row['p_value'])} | {fmt(row['p_permutation'])} | {row['status']} |")
    for row in result["correlations"]:
        if row["status"] == "estimated":
            direction = "positiva" if row["rho"] > 0 else "negativa" if row["rho"] < 0 else "nula"
            lines += ["", f"**{row['variant']}:** associação monotônica {direction}, com |ρ|={fmt(abs(row['rho']))}. O sinal descreve a tendência observada entre projetos; não mede efeito causal de aumentar a frequência. " +
                      ("O proxy baseado em releases permanece exploratório, sem validação final da heurística." if row["y"] == "cfr_b" else "O proxy de CI mede falha de pipeline, não falha comprovada em produção.")]
            lines += ["", "O teste bilateral " + ("detecta evidência de associação a 5%." if row["p_value"] < ALPHA else "não detecta evidência de associação a 5%; isso não demonstra ausência de relação.")]
        else:
            lines += ["", f"{row['variant']} não estimável: {row['reason']}."]
    lines += ["", "![Frequência e CFR CI](figures/rq05-cfr-ci.png)", "", "![Frequência e CFR por releases](figures/rq05-cfr-b.png)", "",
              "## RQ06 — Grupos de projetos", "", "| Fator | Q1 | Mediana | Q3 | Grupos e n do fator |", "|---|---:|---:|---:|---|"]
    for factor, data in result["factors"].items():
        qs = data["quantiles"] or [None] * 3
        sizes = "; ".join(f"{g['group']}: {g['factor_n']}" for g in data["groups"])
        lines.append(f"| {FACTORS[factor]} | {fmt(qs[0])} | {fmt(qs[1])} | {fmt(qs[2])} | {sizes} |")
    lines += ["", "Cortes efetivos e limites por grupo estão em `factor-cuts.json`; atribuições por projeto em `rq06-group-assignments.csv`. Medianas, Q1, Q3, IQR e n por grupo/medida estão em `rq06-group-summary.csv`.", "",
              "| Fator | Medida | n | Teste | p bruto | p Holm | Efeito | Rejeita a 5% |", "|---|---|---:|---|---:|---:|---:|---|"]
    for row in result["tests"]:
        effect = ("ε²=" if row["effect_name"].startswith("epsilon") else "δ=") + fmt(row["effect"]) if row["effect"] is not None else "—"
        decision = "sim" if row["reject_holm"] is True else "não" if row["reject_holm"] is False else "não estimável"
        lines.append(f"| {FACTORS[row['factor']]} | {MEASURES[row['metric']][0]} | {row['n']} | {row['test'] or row['reason']} | {fmt(row['p_value'])} | {fmt(row['p_adjusted'])} | {effect} | {decision} |")
    estimable = [r for r in result["tests"] if r["status"] == "estimated"]
    significant = [r for r in estimable if r["reject_holm"]]
    lines += ["", f"Dos **18 testes planejados**, **{len(estimable)} foram estimáveis** e **{len(significant)} rejeitaram a hipótese nula após Holm**. A rejeição indica diferenças entre distribuições; não identifica automaticamente pares de grupos ou um fator causal."]
    for factor in FACTORS:
        found = [MEASURES[r["metric"]][0] for r in significant if r["factor"] == factor]
        lines += ["", f"**{FACTORS[factor]}:** " + ("diferenças detectadas após Holm em " + ", ".join(found) + "." if found else "não houve rejeição após Holm nas medidas planejadas. Isso não prova igualdade dos grupos.")]
    for factor in FACTORS:
        lines += ["", f"![Comparações por {FACTORS[factor]}](figures/rq06-{factor.replace('_', '-')}.png)"]
    lines += ["", "## Discussão e limitações", "",
              "As correlações relacionam métricas agregadas por repositório. Elas não constituem, sozinhas, confirmação ou refutação causal da hipótese de ausência de trade-off entre velocidade e estabilidade. Releases não são deploys comprovados, e falhas de CI não são incidentes de produção. Diferenças entre os dois proxies podem refletir sua construção e disponibilidade.", "",
              "Popularidade e contribuidores são fotografias obtidas na coleta, posteriores à janela de 2025; não são medidas históricas garantidas desse ano. Idade, popularidade e contribuidores podem ser associados entre si. Os testes são univariados e Holm controla multiplicidade, não confundimento. Projetos populares selecionados com mínimos de atividade não representam todas as equipes de software.", "",
              "Kruskal–Wallis e Mann–Whitney comparam distribuições por postos. Sem hipóteses adicionais sobre suas formas, não atribuímos toda diferença apenas à mediana. As magnitudes de δ seguem os cortes do README; não aplicamos esses cortes ao ε². A recuperação resume apenas episódios encerrados e pode sofrer influência da censura.", "",
              "CFR (b) conserva o estado de validação da fonte: " + ", ".join(manifest["cfr_b_validation"]) + ". Não foram criados rótulos, consenso ou F1 nesta análise. Tipo do projeto não foi usado porque o consenso da amostra de 60 projetos ainda não está disponível para a coorte inteira. Rework rate e análise de sensibilidade permanecem nas entregas dos colegas.", "",
              "## Reprodução", "", "```powershell", "python -m pip install -r scripts/requirements-rq05-rq06.txt",
              "python scripts/analyze-rq05-rq06.py --dataset data/dataset-s02-final/dataset.csv --output output/rq05-rq06",
              "python -m pytest tests/test_rq05_rq06.py -q", "```", "",
              "O manifesto registra hash da fonte, plano, cortes, n, exclusões, métodos e versões. Para replicar o ambiente usado nesta execução, consulte também `dependency-versions.json`. Os SVGs e PNGs são gerados pelo mesmo script. O relatório contribui para resultados/discussão do artigo (#10).", "",
              "## Referências de implementação", ""]
    lines += [f"- [{name}]({url})" for name, url in SOURCES.items()]
    return "\n".join(lines) + "\n"


def run(dataset: Path, output: Path, expected_rows=300, expected_window=("2025-01-01", "2025-12-31"), repetitions=9999, seed=42, skip_plots=False):
    if output.resolve() == dataset.resolve() or dataset.resolve().is_relative_to(output.resolve()):
        raise ValueError("A saída não pode conter ou substituir o dataset de entrada.")
    source = dataset.read_bytes()
    frame, quality = load_dataset(dataset, expected_rows, expected_window)
    result = analyze(frame, quality, repetitions, seed)
    versions = {name: importlib.metadata.version(name) for name in ("numpy", "pandas", "scipy", "statsmodels", "matplotlib")}
    manifest = {"issue": 8, "input": str(dataset.resolve()), "dataset_sha256": hashlib.sha256(source).hexdigest(),
                "script_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), "rows": len(frame),
                "window_start": expected_window[0], "window_end": expected_window[1],
                "unit_of_analysis": "repository", "source_modified": False,
                "plan": {"factors": list(FACTORS), "metrics": list(MEASURES), "rq05_pairs": 2,
                         "rq06_family_planned": 18, "alpha": ALPHA, "holm_scope": "all_estimable_RQ06_tests",
                         "quantile_method": "linear_type_7", "quartile_ties": "coalesce_empty_intervals; never split equal values",
                         "kw_effect": "H/(n-1)", "mw_effect": "2*U1/(n1*n2)-1", "permutations": repetitions, "seed": seed,
                         "spearman_p": "two_sided_asymptotic_plus_preplanned_two_sided_permutation_check"},
                "valid_counts": {metric: int(frame[metric].notna().sum()) for metric in MEASURES},
                "cfr_b_validation": sorted(set(frame["cfr_b_validation"])),
                "rq06_family_estimable": sum(r["status"] == "estimated" for r in result["tests"]),
                "rq06_rejected_holm": sum(r["reject_holm"] is True for r in result["tests"]),
                "quality_occurrences": len(quality), "invalid_occurrences": sum(w["reason"] != "missing" for w in quality),
                "factor_cuts": result["factors"], "versions": versions, "python": platform.python_version(),
                "created_at": datetime.now(timezone.utc).isoformat(), "figures_generated": False}
    output.mkdir(parents=True, exist_ok=True)
    # Explicit header contracts keep empty/non-estimable exports parseable.
    exports = {
        "rq05-correlations.csv": (result["correlations"], list(result["correlations"][0])),
        "rq06-tests.csv": (result["tests"], list(result["tests"][0])),
        "rq06-group-summary.csv": (result["group_summary"], ["factor", "metric", "unit", "group", "lower_exclusive", "upper_inclusive", "factor_n", "n", "q1", "median", "q3", "iqr", "metric_validation"]),
        "rq06-group-assignments.csv": (result["assignments"], ["repository", *[f + "_group" for f in FACTORS]]),
        "exclusions.csv": (result["exclusions"], ["analysis", "repository", "column", "raw_value", "reason"]),
        "quality-warnings.csv": (quality, ["repository", "column", "raw_value", "reason", "action"]),
    }
    for name, (rows, headers) in exports.items():
        write_csv(output / name, rows, headers)
    files = [] if skip_plots else make_plots(frame, result, output / "figures")
    manifest.update(figures_generated=not skip_plots, figures=files)
    if dataset.read_bytes() != source:
        raise RuntimeError("A fonte mudou durante a análise; resultados não confirmados.")
    for name, data in (("manifest.json", manifest), ("factor-cuts.json", result["factors"]), ("analysis.json", result), ("dependency-versions.json", versions)):
        (output / name).write_text(json.dumps(data, indent=2, ensure_ascii=False, allow_nan=False) + "\n", encoding="utf-8")
    text = report_text(result, manifest)
    if skip_plots:
        text = "\n".join(line for line in text.splitlines() if not line.startswith("![")) + "\n"
    (output / "REPORT.md").write_text(text, encoding="utf-8")
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", type=Path, default=ROOT / "data/dataset-s02-final/dataset.csv")
    parser.add_argument("--output", type=Path, default=ROOT / "output/rq05-rq06")
    parser.add_argument("--expected-rows", type=int, default=300)
    parser.add_argument("--window-start", default="2025-01-01")
    parser.add_argument("--window-end", default="2025-12-31")
    parser.add_argument("--permutations", type=int, default=9999)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--skip-plots", action="store_true")
    args = parser.parse_args()
    if args.permutations < 0 or args.expected_rows < 1 or args.seed < 0:
        parser.error("Permutações/semente devem ser não negativas e expected-rows positivo.")
    manifest = run(args.dataset, args.output, args.expected_rows, (args.window_start, args.window_end), args.permutations, args.seed, args.skip_plots)
    print(json.dumps({key: manifest[key] for key in ("rows", "valid_counts", "rq06_family_estimable", "rq06_rejected_holm", "figures_generated")}, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, RuntimeError) as error:
        print(f"Erro: {error}", file=sys.stderr)
        sys.exit(1)
