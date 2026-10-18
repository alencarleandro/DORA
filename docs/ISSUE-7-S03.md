# Sprint 3 - Leandro - Issue #7

Entrega: análise descritiva das RQ 01 a 04 e classificação DORA de referência C1, a partir do CSV consolidado de 300 projetos. Executa localmente, sem token, consultas ao GitHub ou acesso a `data/jobs`.

## Executar

Requisitos: Node.js >=22 e Python 3 com Matplotlib. Os testes/análises sem gráficos usam apenas Node.js.

```powershell
python -m pip install -r scripts/requirements-rq01-rq04.txt
npm run rq01
npm test
```

Para selecionar o interpretador: `npm run rq01 -- --python "C:/caminho/python.exe"`. Para outra base/saída: `npm run rq01 -- --dataset dados.csv --output output/outra-analise`. O CSV deve seguir o contrato do dataset consolidado, com uma única janela. `--skip-plots` gera os dados e o relatório sem as figuras; o manifesto registra se os gráficos foram gerados. O script falha explicitamente se o interpretador/dependência não estiver disponível, preservando a análise já salva.

Os testes usam entradas sintéticas pequenas, sem rede, para verificar quartis, limites, censura, ausentes, valores inválidos, duplicatas e o fluxo de exportação. A execução real usa apenas o dataset versionado, não os dados demonstrativos dos testes.

## Ler a entrega

- [Resultados e discussão](../output/rq01-rq04/REPORT.md): texto com método, unidades, denominadores, limitações e resultados das quatro RQ.
- [Tabela descritiva](../output/rq01-rq04/descriptive-summary.csv): mediana, Q1, Q3, IQR, extremos e n válido por medida.
- [Classificações C1](../output/rq01-rq04/c1-classifications.csv): quatro notas por projeto, C1 completa e extensão parcial explicitamente separadas.
- [Distribuição C1](../output/rq01-rq04/c1-distribution.csv): contagens e percentuais com o denominador de cada política.
- [Gráficos](../output/rq01-rq04/figures/): seis figuras científicas em PNG/SVG, para o artigo.
- [Avisos de qualidade](../output/rq01-rq04/quality-warnings.csv), [manifesto](../output/rq01-rq04/manifest.json) e [validação](../output/rq01-rq04/VALIDATION.md).

Os gráficos são ECDFs: a altura indica a proporção de projetos com valor até aquele ponto. Os gráficos de duração/frequência usam escala symlog, linear até 1 e logarítmica acima de 1; zeros continuam visíveis. Os gráficos de taxas usam 0 a 100%. Cada curva informa seu n.

## Decisões que precisam acompanhar o artigo

1. **Unidade:** cada projeto tem o mesmo peso. Para duração, resumimos medianas por projeto; não afirmamos ter a mediana de todos os eventos globais. Os quartis usam interpolação linear tipo 7.
2. **Ausentes:** 42 projetos sem recuperação observada não recebem zero ou nota Elite. A C1 completa usa os 258 projetos com quatro dimensões; os 300 também têm uma classificação disponível, exploratória, baseada nas dimensões observadas.
3. **Dados inválidos:** o lead time por commit negativo de `tw93/Mole` é preservado na fonte e excluído da análise dessa medida. Assim, RQ02b tem n=299. O script não reescreve o dataset original.
4. **CFR (b):** permanece exploratório porque o CSV informa `pending_independent_labels`. A issue #5 fechada não substitui um relatório de validação. Não foram criados rótulos, consenso ou F1 nesta tarefa.
5. **Frequência mensal:** em 2025, 12 releases/ano satisfazem uma por mês. O script evita arredondar o ano para 52,14 semanas, o que classificava indevidamente os projetos com exatamente 12 releases como Low nessa dimensão. O limite semanal usa as 365 jornadas do ano; anos bissextos também são tratados.

## Integração com Luis e Isabella

A C1 disponível de RQ01-04 e RQ07 foi alinhada em 18/10/2026. Ambos usam `classifyWindowFrequency`, com 12 releases por ano civil como limite mensal. A comparação tem **300 chaves e zero divergências**. O script e os resultados da sensibilidade foram recalculados e a réplica Python foi atualizada. O histórico anterior (cinco diferenças de escore) permanece no Git. Os 258 casos completos continuam separados dos 300 com dimensões disponíveis; não houve imputação.

A confirmação da validação do CFR (b) está em [STATUS.md](../data/dataset-s02-final/validacao/cfr-b/STATUS.md). Há evidência local para as 300 releases, mas os arquivos oficiais de Leandro e Luis ainda não têm rótulos corretivos preenchidos e o consenso final não existe. A ausência do consenso impede concluir o F1.

Isabella pode usar `descriptive-summary.csv` e `analysis.json` como base das RQ05/RQ06, sempre mantendo as mesmas unidades, n por variante e a ressalva do CFR (b). Comparações pareadas devem excluir somente projetos sem uma das variáveis, sem transformar ausentes em zero.

O [REPORT.md](../output/rq01-rq04/REPORT.md) é a contribuição de resultados/discussão para a #10. A revisão final do artigo continua sendo do trio. Não foram alterados os dados ou relatórios dos colegas.

## Fala curta para a daily

“Na issue 7, implementei a análise das quatro métricas DORA sobre os 300 projetos. Gerei estatísticas, gráficos e a classificação C1, separando os 258 projetos completos dos 42 com dados parciais. Também sinalizei um lead time negativo e documentei o tratamento dos dados ausentes. A análise está reproduzível sem token; a C1 está alinhada com a sensibilidade e falta concluir a validação do CFR baseado em releases.”

**Explicando de forma simples:** peguei as contas que já tínhamos, resumi os resultados e organizei os projetos por faixa de desempenho. Quando faltava uma informação, deixei isso visível, em vez de inventar uma nota.
