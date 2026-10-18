# Sprint 3 - Issue #7: RQ 01 a 04 e classificação C1

## Método

Análise local de **300 repositórios**, janela UTC **2025-01-01 a 2025-12-31**. Fonte: `data/dataset-s02-final/dataset.csv`; SHA-256: `c109078a7ba40e3c982749a5cdb638b700dd1d6bbe21d0e868287ae9115a8fc5`.

Cada observação é um repositório e cada projeto tem o mesmo peso. Os quartis abaixo descrevem a distribuição das métricas por repositório. Para lead time e recuperação, são quartis das medianas dos projetos, não quartis de todas as durações individuais. Não é possível reconstruir a distribuição global de eventos apenas com este CSV agregado. Quartis: interpolação linear na posição (n-1)p, convenção tipo 7. Ausentes ficam ausentes; negativos e proporções fora de [0,1] são excluídos apenas da análise afetada e registrados em quality-warnings.csv. Nenhuma fonte foi alterada.

## Estatística descritiva

| Medida | n válido | Ausentes/inválidos | Q1 | Mediana | Q3 | IQR | Unidade |
|---|---:|---:|---:|---:|---:|---:|---|
| Frequência de releases | 300 | 0 | 0,2253 | 0,4603 | 0,9973 | 0,7719 | releases/semana |
| Lead time por release | 300 | 0 | 116,7349 | 325,3675 | 1.106,4024 | 989,6675 | horas |
| Lead time por commit | 299 | 1 | 127,3665 | 428,6215 | 1.865,5222 | 1.738,1558 | horas |
| CFR do CI | 300 | 0 | 0,0137 | 0,0564 | 0,1355 | 0,1218 | proporção |
| CFR de entrega (exploratório) | 300 | 0 | 0,062 | 0,25 | 0,4856 | 0,4236 | proporção |
| Recuperação observada | 258 | 42 | 1,4359 | 3,7683 | 12,5626 | 11,1267 | horas |
| Fração de episódios censurados | 263 | 37 | 0 | 0 | 0,007 | 0,007 | proporção |

As taxas estão em proporção: 0,15 corresponde a 15%. O IQR de uma proporção pode ser convertido para pontos percentuais multiplicando-o por 100.

## Resultados e discussão para o artigo

### RQ 01 - Frequência de deploys

A frequência mediana foi **0,4603 releases/semana**, com IQR **0,7719** (n=300). O inventário soma 18.333 releases em 300 repositórios com contagem disponível. A frequência é uma proxy: publicar uma release no GitHub não comprova implantação ou uso em produção. Os resultados representam a coorte selecionada, não todos os projetos open source.

### RQ 02 - Lead time

A mediana das medianas por release foi **325,3675 h**, e por commit **428,6215 h**. Na comparação pareada, a variante por release foi maior em **176/299** projetos. Cada variante preserva os pesos definidos no coletor: commit mais antigo por release em (a), todos os commits de todas as releases por projeto em (b). Comparar os valores pareados evita atribuir a diferença apenas às medianas marginais. Não se presume que (a) sempre excede (b), porque a ponderação dos eventos é distinta.

Há 1 valor(es) inválido(s) de lead time por commit. O valor negativo não foi convertido em zero nem valor absoluto: foi preservado na fonte e excluído das estatísticas desta variante. Datas de autoria/publicação e comparação entre branches exigem auditoria com B. A ausência de uma comparação não significa ausência de mudanças.

### RQ 03 - Taxa de falha

O CFR de CI tem mediana **5,6365%**, e o proxy de entrega **25%**, com n válido 300 e 300, respectivamente. Na comparação pareada há 300 projetos. Falha de testes/build não é falha em produção; o proxy de entrega relaciona uma release a uma posterior corretiva em até sete dias. São fenômenos e denominadores diferentes.

**Situação do CFR (b): EXPLORATÓRIO - validação da heurística pendente.** Estados presentes no CSV: pending_independent_labels. O fechamento de uma issue não comprova validação científica. Não foi calculado F1, consenso ou concordância nesta análise. As exclusões de releases no fim da janela (244 censuradas, contagens disponíveis em 300 projetos) e resultados desconhecidos (0) permanecem separados. As médias por repositório não são taxas agregadas de todos os eventos.

### RQ 04 - Tempo de recuperação

A recuperação observada tem mediana de **3,7683 h** e IQR **11,1267 h**, com **258/300** projetos observados. Os 42 restantes não receberam recuperação zero nem nota Elite automaticamente. O motivo por projeto está em c1-classifications.csv: ausência de episódio observado, todos os episódios censurados ou outro dado ausente/inválido.

A fração censurada tem mediana **0%** nos **263** projetos com denominador. Foram registrados 18.439 episódios e 119 censurados (contagens disponíveis em 300 e 300 projetos). A censura não foi tratada como recuperação concluída. A análise é descritiva de episódios recuperados; não estima uma curva de sobrevivência nem o tempo de recuperação dos episódios censurados. Falhas iniciais sem sucesso anterior (15.626) são registradas à parte pelo coletor.

## Classificação DORA de referência C1

C1 usa frequência de releases, lead time por release (a), CFR do CI (a) e recuperação observada. Reutiliza os cortes de lib/sensitivity.mjs para duração e CFR. Frequência: Elite >=7/semana; High >=1/semana; Medium >=1/mês; Low abaixo disso. Para ano civil completo, 12 releases é exatamente o limite mensal, evitando o arredondamento 52,14 semanas do módulo legado.

Lead time: <24 h, <168 h, <720 h e >=720 h; CFR: <=15%, <=30%, <=45% e >45%; recuperação: <1 h, <24 h, <168 h e >=168 h. Notas Elite=4, High=3, Medium=2, Low=1. A categoria geral é floor(mediana das quatro notas).

**C1 completa:** 258 projetos; Low: 15; Medium: 132; High: 103; Elite: 8. **Sem C1 completa:** 42. Publicamos separadamente c1_available_score, uma extensão exploratória baseada apenas nas dimensões observadas, para integração com RQ07. Ela não deve ser misturada com a C1 completa nem interpretada como quatro dimensões medidas. Não foi feita imputação.

Conferência do export de Luis: 300 chaves correspondentes; 5 diferenças na classificação disponível. Consulte c1-rq07-comparison.csv; diferenças de política/limiar não foram escondidas. Os resultados de RQ07 não foram recalculados ou sobrescritos por este script.

## Limites e integração

Não há inferência causal, teste de correlação, comparação entre grupos ou conclusão de robustez nesta entrega; RQ05/RQ06 pertencem à #8 e sensibilidade à #9. A análise parte de agregados previamente coletados e não reaudita eventos brutos, retenção do Actions ou a validade da heurística. A seleção por popularidade e mínimos de releases/runs restringe a generalização. A idade/linguagem dos projetos não são variáveis de ajuste aqui.

Para Isabella: use descriptive-summary.csv e analysis.json; preserve n por variante. Para Luis: use c1-classifications.csv e declare a política de ausentes usada na sensibilidade. Para o artigo (#10): esta seção fornece texto de resultados e discussão que deve ser revisado pelo trio; não declare o CFR (b) validado sem evidência.

## Artefatos

- descriptive-summary.csv: mediana, Q1, Q3, IQR, mínimo, máximo, zeros, n, ausentes e inválidos.
- c1-classifications.csv e c1-distribution.csv: notas por dimensão e classificações completa/parcial.
- quality-warnings.csv: dados inválidos ou inconsistentes, sem correção silenciosa.
- analysis.json e manifest.json: valores para gráficos e proveniência.
- figures/: ECDFs por RQ e distribuição C1, nos formatos PNG e SVG (quando gráficos habilitados).

Não requer token ou arquivos de data/jobs. Comando: npm run rq01 -- --dataset data/dataset-s02-final/dataset.csv --output output/rq01-rq04. Requer Python 3 com matplotlib para figuras; --python seleciona executável e --skip-plots permite gerar somente as análises.
