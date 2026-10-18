# Sprint 3 — Isabella — Issue #8

Entrega das RQ05 e RQ06 a partir dos 300 projetos de `data/dataset-s02-final/dataset.csv`, janela UTC de 2025. A análise é local, sem token, nova coleta ou dependência dos históricos em `data/jobs`.

## Executar

Requisito: Python 3.12. Recomenda-se um ambiente virtual para manter as dependências desta análise separadas.

```powershell
python -m venv .venv-rq05-rq06
.venv-rq05-rq06/Scripts/Activate.ps1
python -m pip install -r scripts/requirements-rq05-rq06.txt
npm run rq05
npm run test:rq05
npm test
```

Em Linux/macOS, ative com `source .venv-rq05-rq06/bin/activate`. Os comandos Python diretos equivalentes são `python scripts/analyze-rq05-rq06.py` e `python -m pytest tests/test_rq05_rq06.py -q`. O workflow do GitHub executa os testes Python em um job próprio, além da suíte Node existente.

Opções do script: `--dataset caminho.csv`, `--output output/outra-analise`, `--expected-rows 300`, `--window-start 2025-01-01`, `--window-end 2025-12-31`, `--permutations 9999`, `--seed 42` e `--skip-plots`. A entrada deve manter o contrato de colunas, repositórios únicos e uma única janela. Não use o diretório que contém a entrada como saída. O padrão produz figuras; `--skip-plots` fica registrado no manifesto.

## Arquivos para a equipe

| Caminho em `output/rq05-rq06/` | Conteúdo |
|---|---|
| [REPORT.md](../output/rq05-rq06/REPORT.md) | Método, resultados, discussão e limitações para o artigo #10 |
| [rq05-correlations.csv](../output/rq05-rq06/rq05-correlations.csv) | Dois pares de Spearman: ρ, p bilateral, p por permutação, n, exclusões e validação |
| [rq06-tests.csv](../output/rq05-rq06/rq06-tests.csv) | 18 combinações, estatísticas, efeitos, p bruto/ajustado e decisão Holm |
| [rq06-group-summary.csv](../output/rq05-rq06/rq06-group-summary.csv) | n, Q1, mediana, Q3, IQR, unidades e limites por grupo/medida |
| [factor-cuts.json](../output/rq05-rq06/factor-cuts.json) | Quartis, cortes efetivos, tratamento de empates e n do fator |
| [rq06-group-assignments.csv](../output/rq05-rq06/rq06-group-assignments.csv) | Grupo de cada projeto nos três fatores |
| [exclusions.csv](../output/rq05-rq06/exclusions.csv) / [quality-warnings.csv](../output/rq05-rq06/quality-warnings.csv) | Exclusões por análise e ocorrências por coluna; ausente não vira zero |
| [manifest.json](../output/rq05-rq06/manifest.json) | Hash da entrada/script, plano, versões, janela e controles |
| [figures/](../output/rq05-rq06/figures/) | Dois gráficos de dispersão e três painéis de boxplots, em PNG/SVG |
| [VALIDATION.md](../output/rq05-rq06/VALIDATION.md) | Testes, conferências e pendência identificada na suíte existente |

Os arquivos gerados são substituídos ao repetir a execução no mesmo diretório. A fonte é lida e seu hash é conferido; ela não é regravada. O roteiro temporário em `data/temporario-issue-8-sprint3/` foi preservado como referência.

## Decisões metodológicas

- RQ05: Spearman bilateral para frequência × CFR CI e frequência × CFR por releases, sem combinar os proxies. O p assintótico é acompanhado de uma verificação bilateral com 9.999 permutações e sementes fixas 42/43, definida antes da execução.
- RQ06: estrelas, contribuidores e idade em quartis; seis medidas, incluindo as duas definições de lead time e as duas de CFR. Os cortes são fixados antes de filtrar cada medida. Empates não são divididos para equilibrar grupos; intervalos vazios são coalescidos.
- Três ou mais grupos ativos: Kruskal–Wallis com correção de empates e ε²=H/(n−1). Dois grupos ativos: Mann–Whitney bilateral e Cliff's delta com sinal na ordem crescente dos grupos. Menos de dois grupos ou medida constante: não estimável, com motivo explícito.
- Holm: uma família com todos os testes RQ06 estimáveis, dos 18 planejados, a 5%. Os dois p-valores RQ05 são apresentados separadamente. Nenhum fator foi selecionado com base em significância; não há post-hoc exploratório.
- Lead time por commit: n=299, excluindo o valor negativo de `tw93/Mole` somente nessa medida. Recuperação: n=258, com 42 ausentes. Demais medidas: n=300. Zero é preservado.
- CFR (b) mantém `pending_independent_labels` e é exploratório em tabelas e figuras. Não foram criados rótulos, consenso ou F1. Os fatores escolhidos dispensam preencher o tipo de projeto sem consenso.

## Leitura dos resultados

Frequência × CFR CI: ρ≈0,064, p≈0,271, sem evidência de associação monotônica a 5%. Frequência × CFR por releases: ρ≈0,571, p≈2,19×10⁻²⁷, uma associação positiva exploratória que depende da validade do proxy. A permutação mantém as mesmas conclusões, com p=0,2718 e p=0,0001, respectivamente.

Todos os 18 testes RQ06 foram estimáveis; oito rejeitam após Holm. Há diferenças entre quartis de contribuidores na frequência e nos dois lead times; entre quartis de idade nessas três medidas e no CFR por releases; entre quartis de estrelas apenas no CFR por releases. Isso não estabelece pares específicos diferentes nem causalidade. As maiores estimativas de ε² observadas foram para idade × lead time (aproximadamente 0,294 e 0,298).

O artigo deve manter os denominadores, efeitos e p ajustados, além das limitações de seleção, proxies, censura e confundimento. Estrelas e contribuidores são fotografias da coleta, posteriores a 2025. O resultado de CI não comprova nem refuta causalmente a ausência de trade-off no DORA. Consulte o relatório completo antes de transpor conclusões para a apresentação.
