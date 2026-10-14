# Revisão assistida de Leandro — Issue #5

Foram examinadas as referências públicas das 300 releases da amostra final (60 projetos × 5), mantendo tags, datas e ordem. Os rótulos abaixo são **sugestões de IA, ainda sem revisão humana**. Não são uma avaliação humana independente nem uma amostra-ouro validada.

- `rotulos-leandro-assistidos.csv`: sugestões no mesmo formato da planilha individual.
- `evidencias-leandro.csv`: links, trechos curtos das notas, comparações locais, datas e hashes das páginas consultadas.
- `decisoes.json`: classificações propostas e prioridades de revisão por release.
- `revisao-leandro.json`: contagens, método, limitações e hashes das planilhas oficiais preservadas.

**262 sugestões de release corretiva:** 90 `sim` e 172 `não`. **38 casos permanecem sem decisão** porque as fontes são ambíguas (dependências, finalidade mista, snapshots semanais ou apenas CI/build). Célula vazia não significa `não`. Todas as sugestões, inclusive as preenchidas, precisam ser revisadas por Leandro.

## Como concluir sua avaliação

1. Abra `rotulos-leandro-assistidos.csv` e `evidencias-leandro.csv` lado a lado. Comece pelas linhas com `review_priority=alta`.
2. Consulte a release/changelog e confirme se a finalidade principal é corrigir um defeito recente. Não basta ser patch, mencionar um bug ou conter aviso de que a versão tem um bug ainda não corrigido.
3. Confira `project_type` e `real_delivery` uma vez por projeto; mantenha essas duas respostas iguais nas cinco linhas. READMEs foram consultados em outubro de 2026; mudanças de finalidade desde as releases de 2025 exigem atenção.
4. Complete os 38 rótulos vazios, confirme ou corrija as demais sugestões e registre evidência e justificativa. Não consulte rótulos dos colegas nem resultados do classificador durante sua avaliação.
5. Após sua revisão, transfira as decisões aceitas para `../rotulos-leandro.csv`, mantendo os campos de referência e registrando uso de IA nas notas. **Não copie automaticamente o rascunho antes de revisar.**
6. Com os três arquivos oficiais concluídos, execute concordância e consenso apontando para `data/gold-standard-final-300-2025`.

Nenhum arquivo de Isabella ou Luís foi alterado. O arquivo oficial de Leandro também permanece preservado até a revisão. Os scripts de concordância/consenso não leem esta subpasta.

## Método e limites

As sugestões foram feitas a partir das notas das releases, changelogs oficiais vinculados, README e commits locais. Não foram usados CSVs de classificação dos colegas nem previsões do CFR (b). A conversa anterior já continha descrições da heurística; portanto, não se afirma cegamento estrito do avaliador. Há decisões subjetivas sobre finalidade predominante e projetos híbridos. Concordância entre respostas assistidas pelo mesmo modelo não deve ser apresentada como concordância humana independente.

Evidências integrais de coleta ficam em `data/issue-5-evidence/`, ignoradas pelo Git; a entrega versiona somente referências, hashes e trechos curtos. Para reproduzir: `node scripts/collect-leandro-evidence.mjs releases`, `node scripts/collect-leandro-evidence.mjs repos`, `node scripts/collect-leandro-supplement.mjs`, `node scripts/build-leandro-labels.mjs`. As consultas são públicas e não usam token.

**Explicando para uma criança:** preparei um rascunho do gabarito e deixei as pistas de onde tirei cada resposta. Você precisa conferir as respostas antes de dizer que o gabarito é seu. Quando não havia uma pista clara, deixei a resposta em branco para não inventar.
