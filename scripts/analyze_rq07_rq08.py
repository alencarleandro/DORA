#!/usr/bin/env python3
"""
Script de validação e replicação em Python para a RQ 07 (Sensibilidade)
e RQ 08 (Rework Rate).
Executa de forma autônoma com a biblioteca padrão do Python e confere
exatamente os mesmos resultados do pipeline Node.js.
"""

import csv
import json
import math
import sys
from pathlib import Path

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BASE_DIR = Path(__file__).resolve().parent.parent
DATASET_PATH = BASE_DIR / "data" / "dataset-s02-final" / "dataset.csv"
OUTPUT_DIR = BASE_DIR / "output" / "rq07-rq08"

CATEGORIES = {4: "Elite", 3: "High", 2: "Medium", 1: "Low"}


def clean_val(val):
    if val is None:
        return None
    s = str(val).strip()
    if not s:
        return None
    if s.startswith("'"):
        s = s[1:].strip()
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def classify_df(val, row=None):
    if val is None or not math.isfinite(val):
        return None
    if val >= 7.0:
        return 4
    if val >= 1.0:
        return 3
    if row and row.get('window_start', '').endswith('-01-01') and row.get('window_end') == row['window_start'][:4] + '-12-31':
        return 2 if float(row['releases_in_window']) >= 12 else 1
    if val >= (12.0 / (365.25 / 7)):
        return 2
    return 1


def classify_lead_time(val):
    if val is None or not math.isfinite(val):
        return None
    if val < 1.0:
        return 4
    if val < 7.0:
        return 3
    if val < 30.0:
        return 2
    return 1


def classify_cfr(val):
    if val is None or not math.isfinite(val):
        return None
    if val <= 0.15:
        return 4
    if val <= 0.30:
        return 3
    if val <= 0.45:
        return 2
    return 1


def classify_recovery(val):
    if val is None or not math.isfinite(val):
        return None
    if val < 1.0:
        return 4
    if val < 24.0:
        return 3
    if val < 168.0:
        return 2
    return 1


def overall_dora(scores):
    valid = [s for s in scores if s is not None]
    if not valid:
        return None
    valid.sort()
    n = len(valid)
    if n % 2 == 1:
        med = valid[n // 2]
    else:
        med = (valid[n // 2 - 1] + valid[n // 2]) / 2.0
    return math.floor(med)


def weighted_cohen_kappa_linear(y1, y2, k=4):
    n = len(y1)
    matrix = [[0] * k for _ in range(k)]
    for a, b in zip(y1, y2):
        matrix[a - 1][b - 1] += 1

    row_sums = [sum(row) for row in matrix]
    col_sums = [sum(matrix[i][j] for i in range(k)) for j in range(k)]

    po = 0.0
    pe = 0.0
    for i in range(k):
        for j in range(k):
            w = 1.0 - abs(i - j) / (k - 1)
            po += w * (matrix[i][j] / n)
            pe += w * (row_sums[i] / n) * (col_sums[j] / n)

    if abs(1.0 - pe) < 1e-12:
        return 1.0
    return (po - pe) / (1.0 - pe)


def main():
    print("=" * 70)
    print(" REPLICAÇÃO EM PYTHON: ANÁLISE DE SENSIBILIDADE DORA (RQ 07 / RQ 08)")
    print("=" * 70)

    if not DATASET_PATH.exists():
        print(f"Erro: Dataset não encontrado em {DATASET_PATH}", file=sys.stderr)
        sys.exit(1)

    with open(DATASET_PATH, mode="r", encoding="utf-8-sig") as fp:
        rows = list(csv.DictReader(fp))

    print(f"Carregados {len(rows)} repositórios.")

    c1_scores, c2_scores, c3_scores, c4_scores = [], [], [], []
    for r in rows:
        df = clean_val(r.get("deployment_frequency"))
        df_score = classify_df(df, r)
        lt_rel = clean_val(r.get("lead_time_release_median_days"))
        lt_com = clean_val(r.get("lead_time_commit_median_days"))
        cfr_ci = clean_val(r.get("cfr_ci"))
        cfr_b = clean_val(r.get("cfr_b"))
        rec = clean_val(r.get("recovery_median_hours"))

        c1 = overall_dora([df_score, classify_lead_time(lt_rel), classify_cfr(cfr_ci), classify_recovery(rec)])
        c2 = overall_dora([df_score, classify_lead_time(lt_com), classify_cfr(cfr_b), classify_recovery(rec)])
        c3 = overall_dora([df_score, classify_lead_time(lt_rel), classify_cfr(cfr_b), classify_recovery(rec)])
        c4 = overall_dora([df_score, classify_lead_time(lt_com), classify_cfr(cfr_ci), classify_recovery(rec)])

        c1_scores.append(c1)
        c2_scores.append(c2)
        c3_scores.append(c3)
        c4_scores.append(c4)

    pairs = [
        ("C1 x C2 (Referência vs Alternativa Completa)", c1_scores, c2_scores),
        ("C1 x C3 (Isolamento do CFR)", c1_scores, c3_scores),
        ("C1 x C4 (Isolamento do Lead Time)", c1_scores, c4_scores),
        ("C2 x C3 (Lead Time sob CFR de Entrega)", c2_scores, c3_scores),
        ("C2 x C4 (CFR sob Lead Time por Commit)", c2_scores, c4_scores),
        ("C3 x C4 (Cruzamento das Mistas)", c3_scores, c4_scores),
    ]

    print("\nResultados da Análise de Sensibilidade (RQ 07):")
    for name, y1, y2 in pairs:
        changed = sum(1 for a, b in zip(y1, y2) if a != b)
        pct = (changed / len(y1)) * 100
        kappa = weighted_cohen_kappa_linear(y1, y2)
        print(f"  • {name}:")
        print(f"      Mudança: {changed}/{len(y1)} ({pct:.1f}%) | Kappa Linear: {kappa:.4f}")

    # Comparar com saída JSON do Node.js
    node_summary_file = OUTPUT_DIR / "rq07-sensitivity-summary.json"
    if node_summary_file.exists():
        with open(node_summary_file, "r", encoding="utf-8") as fp:
            node_data = json.load(fp)
        print("\nValidação cruzada Node.js vs Python:")
        for idx, p in enumerate(node_data["pairwise_sensitivity"]):
            py_kappa = weighted_cohen_kappa_linear(pairs[idx][1], pairs[idx][2])
            diff = abs(p["kappa"] - py_kappa)
            assert diff < 1e-9, f"Divergência detectada em {p['name']}: {p['kappa']} vs {py_kappa}"
        print("  ✓ Todas as 6 métricas de Kappa Linear conferem com precisão exata (< 10^-9)!")


if __name__ == "__main__":
    main()
