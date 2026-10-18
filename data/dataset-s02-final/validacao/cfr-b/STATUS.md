# CFR (b) - conferência da validação final

**Estado: blocked_missing_prerequisites.** Não há comprovação de F1 final validado. O dataset continua exploratório e não foi modificado.

A amostra final tem 300 releases. Evidências locais correspondentes: 300; ausentes: 0; comparações indisponíveis: 0.

| Avaliador | Linhas | Corretiva preenchida | Corretiva ausente/inválida | Referências corretas |
|---|---:|---:|---:|---|
| leandro | 300 | 0 | 300 | true |
| luis | 300 | 0 | 300 | true |
| isabella | 300 | 300 | 0 | true |

Consenso da amostra final: ausente. Os relatórios históricos encontrados têm 0/300 referências verificadas; 0/300 referências verificadas; não validam a amostra final.

## O que impede a execução

- leandro: 300 rótulos corretivos ausentes/inválidos
- luis: 300 rótulos corretivos ausentes/inválidos
- Consenso completo correspondente à amostra final ausente

## Como concluir

1. Cada avaliador conclui e revisa seu próprio arquivo oficial, preservando as referências. Sugestões de IA não substituem revisão humana independente.
2. O grupo calcula concordância e discute divergências; gera consensus.csv na pasta da amostra final com rótulos e protocolo documentados.
3. Execute: `npm run cfr-b -- --job 1deaa513-2c06-4949-bd54-2c591b0eef12 --consensus data/gold-standard-final-300-2025/consensus.csv --output data/dataset-s02-final/validacao/cfr-b --require-valid`.
4. Confira reference-audit.csv, heuristic-versions.csv e validation.json. Selecionar a versão pelo F1 no mesmo consenso é calibração, não teste independente. Exija cobertura das referências e F1 >=0,70.
5. Se a regra escolhida mudar, recalcule o CFR (b) e atualize explicitamente dataset e análises dependentes. Não altere só o campo de estado.

Esta auditoria pode ser refeita com `node scripts/audit-final-cfr-validation.mjs`. Ela não altera os rótulos, a amostra, o consenso ou o dataset. Hashes e contagens estão em prerequisite-audit.json.
