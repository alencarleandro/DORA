# Amostra-ouro final — 2025

## Estado atual — 20/10/2026

Os três arquivos oficiais têm 300 rótulos preenchidos. O [consenso operacional](consensus.csv) foi registrado com adjudicação assistida por IA autorizada pelo usuário: 112 corretivas e 188 não corretivas. As 14 divergências corretivas e 7 decisões de projeto estão em [adjudication-log.json](adjudication-log.json); o [protocolo](consensus_summary.md) explicita a origem compartilhada das sugestões de Luis/Leandro. Não se afirma independência humana estrita.

A calibração verificou 300/300 referências. Melhor versão: fix-majority-v3; precisão 46,34%, recall 67,86%, F1 55,07%, **abaixo do mínimo de 70%**. O CFR (b) permanece exploratório. Consulte [o relatório e os comandos de reprodução](../dataset-s02-final/validacao/cfr-b/REPORT.md). O fechamento administrativo das avaliações não aprova a heurística.

## Origem da amostra

Os três integrantes usam `gold_standard_sample.csv`: **60 repositórios × 5 releases**, semente **42**, sorteados da base final de 300 projetos. `sampling-manifest.json` registra a janela e a restrição de comparações disponíveis, com 299 candidatos ao sorteio.

## Arquivos oficiais

- `rotulos-isabella.csv`: 300 rótulos assistidos por IA, revisados e aceitos por Isabella.
- `rotulos-luis.csv`: 300 rótulos assistidos por IA, revisados e aceitos por Luis conforme confirmação de Leandro em 20/10/2026. As sugestões reutilizam o rascunho assistido de Leandro; a origem comum limita a independência da concordância. Registro em `revisao-luis/confirmacao-revisao-humana.json`.
- `rotulos-leandro.csv`: 300 rótulos assistidos por IA, revisados e confirmados por Leandro em 20/10/2026.

Leandro tem um [rascunho assistido e evidências](revisao-leandro/README.md): 300 sugestões, incluindo 38 ambiguidades resolvidas por julgamento de IA com confiança explícita. Leandro declarou a revisão concluída em 20/10/2026 e autorizou a incorporação das 300 decisões à planilha oficial. O rascunho foi preservado como histórico; a confirmação e os hashes estão em `revisao-leandro/confirmacao-revisao-humana.json`. Isso não constitui consenso do grupo nem estabelece cegamento estrito.

Cada pessoa altera somente suas classificações e notas. Manter referências, cabeçalhos e ordem das linhas. Não consultar avaliações dos colegas ou previsões da heurística antes de concluir a avaliação independente. Os comandos de concordância procuram esses três nomes nesta pasta.

`revisao-isabella/` guarda rascunho, decisões, evidências e hashes da revisão. O rascunho não é a entrada dos scripts de consenso. O uso de IA deve ser informado na metodologia.

## Concordância e consenso

Após os três arquivos estarem completos, Luis executa, na raiz do projeto:

```powershell
node scripts/calculate-agreement.mjs --data-dir data/gold-standard-final-300-2025
node scripts/consolidate-consensus.mjs --data-dir data/gold-standard-final-300-2025
```

Os relatórios e `consensus.csv` já estão nesta pasta. Para reproduzir as adjudicações explícitas, use `node scripts/finalize-gold-consensus-2025.mjs` após o cálculo de concordância. O consolidator genérico acima calcula maioria simples e não substitui a adjudicação documentada desta base; executá-lo sobrescreve o consenso. O consenso antigo de `../gold-standard/` não pertence a esta base.

Fluxo completo e local dos relatórios de CFR (b): [guia da Sprint 2](../../docs/ESTRUTURA-DADOS-S02.md).
