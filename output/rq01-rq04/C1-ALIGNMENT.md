# Alinhamento C1 - 18/10/2026

RQ01-04 e RQ07 agora usam a mesma função `classifyWindowFrequency` de `lib/descriptive.mjs`. O limite mensal é 12 releases por ano civil, sem o arredondamento anterior para 52,14 semanas.

As cinco diferenças anteriores eram em `react/react`, `rust-lang/rust`, `obsproject/obs-studio`, `apache/superset` e `mozilla/pdf.js`. Todos têm exatamente 12 releases em 2025. As versões anteriores dos resultados permanecem no histórico Git.

**Resultado atual:** 300 chaves comparadas, **zero diferenças de C1 disponível**. A conferência está em `c1-rq07-comparison.csv` e no manifesto. Os 258 casos completos e 42 parciais continuam identificados separadamente; não se atribuiu recuperação zero aos projetos sem observação.

Recalculamos o relatório da sensibilidade da #9. C1 × C2: 82/300 mudam de categoria (27,3%), kappa linear de aproximadamente 0,5745. A réplica Python confirmou os seis kappas com erro inferior a 1e-9. Os arquivos de RQ08 não mudaram de fórmula.

`npm test` passou nos 123 testes, incluindo um teste de integração que compara as 300 classificações dos dois pipelines e um teste que impede a auditoria do CFR (b) de tratar rótulos ausentes como consenso válido.

## Validação do CFR (b)

Veja [o diagnóstico](../../data/dataset-s02-final/validacao/cfr-b/STATUS.md). As evidências locais das 300 releases estão disponíveis, mas faltam rótulos oficiais de Leandro e Luis e o consenso final. **Não existe F1 final validado para incorporar.** Nenhuma sugestão de IA foi promovida a rótulo humano, e nenhum valor do dataset foi modificado. As análises que usam CFR (b) continuam exploratórias.
