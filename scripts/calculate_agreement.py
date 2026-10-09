#!/usr/bin/env python3
"""
Validação e cálculo do Kappa de Fleiss em Python.
Implementa o cálculo conforme statsmodels.stats.inter_rater ou fallback matricial equivalente.
"""
import csv
import sys
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "gold-standard"
RATERS = ["luis", "leandro", "isabella"]


def norm(val: str) -> str:
    s = (val or "").strip().lower()
    if s == "nao":
        s = "não"
    return s


def load_data(data_dir: Path):
    raterData = {}
    for r in RATERS:
        f = data_dir / f"rotulos-{r}.csv"
        if not f.exists():
            raise FileNotFoundError(f"Arquivo não encontrado: {f}")
        with open(f, mode="r", encoding="utf-8-sig") as fp:
            raterData[r] = list(csv.DictReader(fp))
    return raterData


def compute_fleiss_kappa(matrix, categories):
    """
    matrix: N x m (linhas = sujeitos, colunas = avaliadores)
    categories: lista de categorias possíveis
    """
    N = len(matrix)
    n = len(matrix[0])
    k = len(categories)
    cat_to_idx = {c: i for i, c in enumerate(categories)}

    table = [[0] * k for _ in range(N)]
    for i, row in enumerate(matrix):
        for val in row:
            idx = cat_to_idx[val]
            table[i][idx] += 1

    # P_i
    sum_pi = 0.0
    for i in range(N):
        sum_sq = sum(table[i][j] ** 2 for j in range(k))
        pi = (sum_sq - n) / (n * (n - 1))
        sum_pi += pi
    p_bar = sum_pi / N

    # p_j
    pj = [0.0] * k
    for j in range(k):
        col_sum = sum(table[i][j] for i in range(N))
        pj[j] = col_sum / (N * n)

    pe = sum(p ** 2 for p in pj)

    if abs(1.0 - pe) < 1e-12:
        kappa = 1.0
    else:
        kappa = (p_bar - pe) / (1.0 - pe)

    return {
        "N": N,
        "n": n,
        "k": k,
        "p_bar": p_bar,
        "pe": pe,
        "kappa": kappa
    }


def interpret(kappa: float) -> str:
    if kappa < 0:
        return "Pobre (< 0,00)"
    if kappa <= 0.20:
        return "Leve (0,00 a 0,20)"
    if kappa <= 0.40:
        return "Razoável (0,21 a 0,40)"
    if kappa <= 0.60:
        return "Moderada (0,41 a 0,60)"
    if kappa <= 0.80:
        return "Substancial (0,61 a 0,80)"
    return "Quase perfeita (0,81 a 1,00)"


def main():
    print("=" * 70)
    print(" CÁLCULO DE CONCORDÂNCIA (PYTHON): KAPPA DE FLEISS (1971)")
    print("=" * 70)

    try:
        raterData = load_data(DATA_DIR)
    except Exception as e:
        print(f"Erro ao carregar dados: {e}", file=sys.stderr)
        sys.exit(1)

    first_rater = RATERS[0]
    rows = raterData[first_rater]

    # Dimensão 1 & 2: Repositórios
    repo_map = {}
    for r in rows:
        repo = r["repository"]
        if repo not in repo_map:
            repo_map[repo] = True

    unique_repos = list(repo_map.keys())

    matrix_type = []
    matrix_delivery = []
    for repo in unique_repos:
        row_t = []
        row_d = []
        for r in RATERS:
            item = next(x for x in raterData[r] if x["repository"] == repo)
            row_t.append(norm(item["project_type"]))
            row_d.append(norm(item["real_delivery"]))
        matrix_type.append(row_t)
        matrix_delivery.append(row_d)

    # Dimensão 3: Releases
    matrix_corrective = []
    for idx in range(len(rows)):
        row_c = []
        for r in RATERS:
            row_c.append(norm(raterData[r][idx]["is_corrective"]))
        matrix_corrective.append(row_c)

    dims = [
        ("Tipo de Projeto", matrix_type, ['biblioteca/framework', 'aplicação/serviço', 'ferramenta cli', 'outro']),
        ("Entregas Reais ao Usuário", matrix_delivery, ['sim', 'não', 'incerto']),
        ("Release Corretiva (CFR b)", matrix_corrective, ['sim', 'não'])
    ]

    for name, mat, cats in dims:
        res = compute_fleiss_kappa(mat, cats)
        print(f"\nDimensão: {name}")
        print(f"  • N = {res['N']} sujeitos, n = {res['n']} avaliadores, k = {res['k']} categorias")
        print(f"  • P_observado: {res['p_bar'] * 100:.2f}%")
        print(f"  • P_esperado:  {res['pe'] * 100:.2f}%")
        print(f"  • Kappa (κ):   {res['kappa']:.4f}")
        print(f"  • Avaliação:   {interpret(res['kappa'])}")

    print("\nValidação cruzada com Python concluída.")


if __name__ == "__main__":
    main()
