# Revisão assistida de Leandro — Issue #5

Foram examinadas as referências públicas das 300 releases da amostra final (60 projetos × 5), mantendo tags, datas e ordem. Os rótulos abaixo são **sugestões de IA, ainda sem revisão humana**. Não são uma avaliação humana independente nem uma amostra-ouro validada.

- `rotulos-leandro-assistidos.csv`: sugestões no mesmo formato da planilha individual.
- `evidencias-leandro.csv`: links, trechos curtos das notas, comparações locais, datas e hashes das páginas consultadas.
- `decisoes.json`: classificações propostas e prioridades de revisão por release.
- `revisao-leandro.json`: contagens, método, limitações e hashes das planilhas oficiais preservadas.

**300 sugestões de release corretiva:** 106 `sim` e 194 `não`. Os **38 casos inicialmente ambíguos foram decididos por julgamento assistido de IA**, a pedido de Leandro: 16 `sim` e 22 `não`. Trinta dessas decisões têm confiança baixa e oito, média. As justificativas e fontes estão em `resolucoes-assistidas.json`, nas notas e no registro de evidências. Isso completa o rascunho, não a revisão humana nem o consenso do grupo.

## Como concluir sua avaliação

1. Abra `rotulos-leandro-assistidos.csv` e `evidencias-leandro.csv` lado a lado. Comece pelas linhas com `review_priority=alta`.
2. Consulte a release/changelog e confirme se a finalidade principal é corrigir um defeito recente. Não basta ser patch, mencionar um bug ou conter aviso de que a versão tem um bug ainda não corrigido.
3. Confira `project_type` e `real_delivery` uma vez por projeto; mantenha essas duas respostas iguais nas cinco linhas. READMEs foram consultados em outubro de 2026; mudanças de finalidade desde as releases de 2025 exigem atenção.
4. Confira especialmente os 38 casos marcados como `ai_resolved_from_ambiguous`, confirme ou corrija as demais sugestões e registre evidência e justificativa. Não consulte rótulos dos colegas nem resultados do classificador durante sua avaliação.
5. Após sua revisão, transfira as decisões aceitas para `../rotulos-leandro.csv`, mantendo os campos de referência e registrando uso de IA nas notas. **Não copie automaticamente o rascunho antes de revisar.**
6. Com os três arquivos oficiais concluídos, execute concordância e consenso apontando para `data/gold-standard-final-300-2025`.

Nenhum arquivo de Isabella ou Luis foi alterado. O arquivo oficial de Leandro também permanece preservado até a revisão. Os scripts de concordância/consenso não leem esta subpasta.

## Método e limites

As sugestões foram feitas a partir das notas das releases, changelogs oficiais vinculados, README e commits locais. Não foram usados CSVs de classificação dos colegas nem previsões do CFR (b). A conversa anterior já continha descrições da heurística; portanto, não se afirma cegamento estrito do avaliador. Há decisões subjetivas sobre finalidade predominante e projetos híbridos. Concordância entre respostas assistidas pelo mesmo modelo não deve ser apresentada como concordância humana independente.

Evidências integrais de coleta ficam em `data/issue-5-evidence/`, ignoradas pelo Git; a entrega versiona somente referências, hashes e trechos curtos. Para reproduzir: `node scripts/collect-leandro-evidence.mjs releases`, `node scripts/collect-leandro-evidence.mjs repos`, `node scripts/collect-leandro-supplement.mjs`, `node scripts/build-leandro-labels.mjs`. O montador aplica também `scripts/resolve-leandro-ambiguities.mjs`, com as 38 decisões editoriais explícitas, sem chamar a heurística de CFR. As consultas são públicas e não usam token.

**Explicando para uma criança:** completei o rascunho com meu melhor palpite baseado nas pistas. Quando as pistas eram fracas, deixei um aviso de baixa confiança. Você ainda precisa conferir, e esses palpites não são respostas independentes do Luis ou do grupo.
