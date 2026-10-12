# Dataset consolidado da Sprint 2

**300 repositórios**, **55 colunas**, janela UTC **2025-01-01 a 2025-12-31**. `dataset.csv` é a base para análise. `dictionary.csv` define cada coluna. `manifest.json` registra a janela, os IDs e hashes das fontes.

| Pasta | Conteúdo | Responsável |
|---|---|---|
| `selecao/` | lista selecionada, metadados, decisões, consultas e funil de A | Isabella / #6 |
| `metricas/` | exports B/C e comparações indisponíveis | integração das entregas da equipe |
| `validacao/` | conferência do dataset e log dos testes | Isabella / #6; relatórios futuros de CFR (b) por Leandro / #5 |

Os arquivos `metricas/metrics-b.csv` e `metricas/metrics-c.csv` alimentam a consolidação. A lista `selecao/repositories.csv` define os 300 projetos; `metadata.csv` também contém candidatos fora da seleção.

## Reprodução

Na raiz do projeto, execute `node scripts/assemble-isabella-dataset.mjs`. Usa os exports versionados, sem token. Confere chaves, branches, elegibilidade, contagens, taxas, quartis, unidades e igualdade com os valores entregues, e escreve `validacao/quality-report.json`.

Não recalcula métricas a partir de eventos. Para isso, é necessário obter os dados brutos de `data/jobs`, ausentes deste checkout. `node scripts/finalize-isabella.mjs ID_DA_COLETA` finaliza uma coleta local completa nas mesmas pastas, sem gerar ZIP.

## Unidades e pendências

CFR é proporção entre 0 e 1. Tempos são horas salvo campos `_days`. Frequência é releases por semana. Vazios não são zeros. Recuperação resume episódios encerrados; censurados estão contabilizados separadamente.

`validacao/quality-report.json` registra um lead time negativo já presente em `tw93/Mole`. As duas comparações indisponíveis estão em `metricas/comparison-quality.json`. Os valores medidos foram preservados.

A CFR (b) continua exploratória até as avaliações do grupo, consenso e validação. Os rótulos revisados de Isabella estão na pasta irmã `../gold-standard-final-300-2025/`, com uso de IA explícito e rastreabilidade em `revisao-isabella/`.

Siga o [guia de pastas da equipe](../../docs/ESTRUTURA-DADOS-S02.md) e a [entrega da #6](../../docs/ISSUE-6-S02.md).
