# CFR (b) — calibração na amostra final 2025

Data: 20/10/2026. Estado: **calibrated_below_threshold_assisted_reference**.

As 300 referências foram verificadas contra tags e datas reais. Os três arquivos individuais têm 300 rótulos preenchidos. O consenso operacional contém 112 corretivas e 188 não corretivas. Foram resolvidas por adjudicação de IA delegada 14 divergências corretivas e 7 decisões de projeto; os votos originais foram preservados. Veja [protocolo](../../../gold-standard-final-300-2025/consensus_summary.md) e [decisões](../../../gold-standard-final-300-2025/adjudication-log.json).

## Concordância pré-adjudicação

Para release corretiva: concordância observada **96,89%**, Fleiss κ **0,932112** (valor exato no agreement_report.json). Esses números são descritivos: Luis e Leandro reutilizaram sugestões de IA comuns. Não demonstram confiabilidade de três avaliações humanas independentes.

## Classificador

| Versão | TP | FP | FN | TN | Precisão | Recall | F1 |
|---|---:|---:|---:|---:|---:|---:|---:|
| patch-v1 | 65 | 72 | 47 | 116 | 47,45% | 58,04% | 52,21% |
| patch-or-fix-v2 | 106 | 178 | 6 | 10 | 37,32% | 94,64% | 53,54% |
| fix-majority-v3 | 76 | 88 | 36 | 100 | 46,34% | 67,86% | 55,07% |

Melhor versão nesta referência: **fix-majority-v3**, com F1 **55,07%**. Mínimo exigido: **70%**. Não atingiu o corte. A heurística não está aprovada e o CFR (b) permanece exploratório.

Precisão = TP/(TP+FP); recall = TP/(TP+FN); F1 = 2TP/(2TP+FP+FN). As matrizes foram recontadas a partir de predictions.csv. Selecionar a melhor versão no mesmo consenso é calibração e não demonstra generalização. Uma referência com origem compartilhada de IA tem limitações adicionais de independência.

## Consequências

Não alteramos os valores do dataset, os rótulos individuais ou a heurística para melhorar o resultado. O manifesto registra o estado real da calibração. É necessário revisar a heurística e avaliar seu desempenho com referência adequada, idealmente independente; não ajustar os rótulos para alcançar F1. As análises e o relatório Word anteriormente gerados continuam com resultados exploratórios; o Word de 19/10/2026 antecede esta calibração.

## Reprodução local

1. node scripts/calculate-agreement.mjs --data-dir data/gold-standard-final-300-2025
2. node scripts/finalize-gold-consensus-2025.mjs
3. node scripts/calculate-cfr-b.mjs --job 1deaa513-2c06-4949-bd54-2c591b0eef12 --consensus data/gold-standard-final-300-2025/consensus.csv --output data/dataset-s02-final/validacao/cfr-b --require-valid
4. node scripts/audit-final-cfr-validation.mjs
5. node scripts/report-final-cfr-calibration.mjs

O passo 3 grava resultados mesmo quando retorna reprovação por F1. Os passos 4 e 5 auditam e consolidam o estado; o auditor isolado verifica somente pré-requisitos. Testes de concordância e heurística: 19 aprovados em 20/10/2026. Nenhum token ou acesso remoto necessário.
