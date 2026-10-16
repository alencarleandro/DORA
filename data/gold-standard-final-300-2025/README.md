# Amostra-ouro final — 2025

Os três integrantes usam `gold_standard_sample.csv`: **60 repositórios × 5 releases**, semente **42**, sorteados da base final de 300 projetos. `sampling-manifest.json` registra a janela e a restrição de comparações disponíveis, com 299 candidatos ao sorteio.

## Arquivos oficiais

- `rotulos-isabella.csv`: 300 rótulos assistidos por IA, revisados e aceitos por Isabella.
- `rotulos-luis.csv`: arquivo individual de Luis para a mesma amostra.
- `rotulos-leandro.csv`: arquivo individual de Leandro para a mesma amostra.

Leandro tem um [rascunho assistido e evidências](revisao-leandro/README.md): 300 referências examinadas, 262 sugestões e 38 casos sem decisão. A revisão humana está pendente; os scripts não usam esse rascunho e a planilha oficial foi preservada.

Cada pessoa altera somente suas classificações e notas. Manter referências, cabeçalhos e ordem das linhas. Não consultar avaliações dos colegas ou previsões da heurística antes de concluir a avaliação independente. Os comandos de concordância procuram esses três nomes nesta pasta.

`revisao-isabella/` guarda rascunho, decisões, evidências e hashes da revisão. O rascunho não é a entrada dos scripts de consenso. O uso de IA deve ser informado na metodologia.

## Concordância e consenso

Após os três arquivos estarem completos, Luis executa, na raiz do projeto:

```powershell
node scripts/calculate-agreement.mjs --data-dir data/gold-standard-final-300-2025
node scripts/consolidate-consensus.mjs --data-dir data/gold-standard-final-300-2025
```

Os relatórios e `consensus.csv` serão criados aqui. Eles ainda dependem das avaliações do grupo. O consenso antigo de `../gold-standard/` não pertence a esta base.

Fluxo completo e local dos relatórios de CFR (b): [guia da Sprint 2](../../docs/ESTRUTURA-DADOS-S02.md).
