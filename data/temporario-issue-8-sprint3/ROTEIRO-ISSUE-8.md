# Issue #8 - roteiro passo a passo da Sprint 3

**Sua tarefa: issue #8, RQ05 e RQ06.**

Este é um material de orientação temporário, publicado no GitHub para a pessoa responsável pela issue #8 acessar. Está inteiro na pasta `data/temporario-issue-8-sprint3/`. Depois de usar, pode excluir somente essa pasta em um commit de limpeza. Os dados e resultados do projeto ficam fora dela.

## 1. Entender o que você precisa responder

**RQ05:** projetos que publicam com mais frequência têm maior ou menor taxa de falha?

Você vai comparar frequência de releases com duas medidas diferentes de falha: falhas do CI e falhas aproximadas por uma release corretiva posterior.

**RQ06:** quais características dos projetos estão associadas a diferenças nas métricas DORA?

Você vai dividir os projetos em grupos e comparar as distribuições das métricas. Não precisa repetir a coleta no GitHub.

**Explicando para uma criança:** já temos as fichas de 300 projetos. Primeiro você verifica se quem entrega mais também erra mais. Depois separa os projetos em grupos e confere se os resultados mudam. Uma coisa andar junto com outra não significa que uma causou a outra.

## 2. Preparar o projeto e conferir o que já existe

1. Abra o repositório DORA no computador.
2. Confira se há alterações suas antes de atualizar: `git status`.
3. Atualize com `git pull`. Preserve alterações locais; não use reset ou limpeza para fazer o pull funcionar.
4. No Projects, confira a issue #8 atribuída a você e mantenha o status de acordo com o trabalho real.
5. Leia no README as seções **RQ05**, **RQ06** e **Lab03S03**. Elas são os requisitos da disciplina; as escolhas de implementação sugeridas neste roteiro não são novas exigências do professor.

Os cálculos desta tarefa são locais e não usam token. Os arquivos de entrada são CSVs pequenos; não copie os históricos grandes de `data/jobs`.

## 3. Abrir os arquivos certos

| Arquivo | Para que serve |
|---|---|
| `data/dataset-s02-final/dataset.csv` | Entrada principal: 300 projetos, uma linha por projeto, janela de 2025 |
| `data/dataset-s02-final/dictionary.csv` | Significado das 55 colunas |
| `data/dataset-s02-final/manifest.json` | Janela, origem e situação da validação |
| `output/rq01-rq04/REPORT.md` | Resultados descritivos e cuidados identificados por Leandro |
| `output/rq01-rq04/quality-warnings.csv` | Um lead time por commit inválido em `tw93/Mole` |
| `output/rq01-rq04/c1-classifications.csv` | Classificação C1 completa e parcial, separadas |
| `output/rq07-rq08/` | Análise de sensibilidade de Luis |

**Atualização de 18/10:** o alinhamento de C1 e o diagnóstico final de CFR (b) foram publicados no commit `75c1623`. As duas análises concordam nos 300 projetos; o diagnóstico mantém explícita a ausência do consenso final. Faça pull para receber essa atualização. A entrada principal `dataset.csv` continua a mesma.

Se disponíveis no seu checkout, consulte também `output/rq01-rq04/C1-ALIGNMENT.md` e `data/dataset-s02-final/validacao/cfr-b/STATUS.md`.

## 4. Criar uma análise reproduzível

Sugestão de organização para a **entrega permanente**, fora desta pasta temporária:

```text
scripts/analyze-rq05-rq06.py
scripts/requirements-rq05-rq06.txt
tests/test_rq05_rq06.py
output/rq05-rq06/
    rq05-correlations.csv
    rq06-tests.csv
    rq06-group-summary.csv
    manifest.json
    REPORT.md
    figures/
docs/ISSUE-8-S03.md
```

Esses são nomes propostos, não comandos ou arquivos que já estão implementados. Primeiro crie o script; depois execute-o.

O script deve receber caminho de entrada e pasta de saída. Dependências sugeridas: `pandas`, `scipy`, `statsmodels` e `matplotlib`. Registre as versões realmente usadas. Crie um ambiente virtual local, ignorado pelo Git, se necessário.

Comando sugerido **depois de implementar** a interface do script:

```powershell
python scripts/analyze-rq05-rq06.py --dataset data/dataset-s02-final/dataset.csv --output output/rq05-rq06
```

Não deixe parâmetros, cortes e caminhos escondidos em um notebook que depende da ordem manual das células. Um notebook também pode ser usado, desde que rode do início ao fim e gere os arquivos automaticamente.

## 5. Validar os dados antes das contas

No início do script:

1. Confira que `repository` é único e há 300 projetos na base esperada.
2. Confira a mesma janela em todas as linhas: `2025-01-01` a `2025-12-31`.
3. Converta as colunas numéricas explicitamente. Campos vazios são ausentes, não zero.
4. O export protege números negativos com apóstrofo. Remova a proteção de planilha apenas na conversão numérica, antes de verificar o domínio. Isso impede que o valor negativo de Mole seja tratado como texto ou positivo.
5. Exclua valores negativos de duração/frequência e proporções fora de [0,1] somente da análise afetada; registre qual projeto, coluna e motivo. Não altere o CSV original.
6. Para cada teste ou correlação, filtre somente as colunas usadas naquela análise. Não elimine globalmente os 42 projetos sem recuperação e os 300 projetos não precisam ter o mesmo n em todos os testes.
7. Registre os tamanhos de amostra e as exclusões de cada resultado.

**Números de controle conhecidos:** recuperação tem 258 projetos observados e 42 ausentes; lead time por commit tem 299 valores válidos depois de excluir o negativo. As outras medidas principais têm 300 valores na base atual. São verificações, não valores para forçar: se a base mudar, investigue e documente.

## 6. Implementar a RQ05 - duas correlações

Use `scipy.stats.spearmanr` nos pares:

| Análise | X | Y |
|---|---|---|
| RQ05a | `deployment_frequency` | `cfr_ci` |
| RQ05b | `deployment_frequency` | `cfr_b` |

Para cada par:

1. Separe apenas projetos com X e Y válidos.
2. Confira se as variáveis variam e se há observações suficientes. Se uma coluna for constante ou faltarem dados, marque como não estimável, com motivo; não transforme `NaN` em correlação zero.
3. Calcule Spearman bilateral.
4. Exporte `variant`, `rho`, `p_value`, `n`, quantidade excluída e situação da validação da métrica.
5. Crie um gráfico de dispersão para cada variante, com eixos/unidades explícitos. Frequência pode usar escala logarítmica quando positiva; zeros reais em outras variáveis não devem ser descartados apenas para desenhar o gráfico.
6. No texto, explique o sinal e a magnitude de rho, além do p-valor. Não use somente “significativo/não significativo”.

Interpretação: rho positivo sugere que projetos com mais releases tendem a ter CFR maior; negativo, CFR menor; perto de zero, pouca associação monotônica detectada. Nenhum desses resultados demonstra causalidade.

O README pede rho, p-valor, n e dispersão. Se acrescentar permutação ou outra análise de robustez, registre a semente, a quantidade de repetições e a justificativa; não troque métodos depois de ver o p-valor para buscar significância.

## 7. Definir os fatores da RQ06 antes de testar

Escolha **no mínimo três fatores**, conforme o README. Para começar sem depender do consenso da amostra-ouro, a sugestão é:

- Popularidade: `stars` em quartis.
- Número de contribuidores: `contributors_count` em quartis.
- Idade: `age_days` em quartis.

São três características disponíveis na coorte de 300. Não use tipo de projeto como se os 300 já estivessem rotulados: a amostra-ouro tem apenas 60 projetos e seu consenso ainda não está pronto. Linguagem é uma alternativa, mas exige regra explícita para categorias pequenas.

Para cada fator numérico:

1. Calcule os cortes na base do fator válido e registre Q1, mediana e Q3.
2. Atribua os grupos uma única vez. Mantenha os mesmos cortes quando filtrar os projetos disponíveis de cada métrica.
3. Defina como tratar empates nos cortes. Não divida projetos com o mesmo valor arbitrariamente só para deixar quatro grupos iguais.
4. Se `qcut` encontrar bordas repetidas, trate explicitamente a redução de grupos e registre os cortes finais. Não esconda esse efeito.
5. Exporte nome do fator, grupo, limites e n. Se sobrar só um grupo, não há teste entre grupos.

**Explicando de um jeito simples:** para comparar pequenos e grandes, primeiro você decide o que é pequeno e grande. Não muda essa regra cada vez que olha outra métrica.

## 8. Comparar os grupos nas métricas DORA

Analise as quatro dimensões, preservando as duas variantes obrigatórias de lead time e CFR:

| Dimensão | Coluna | Unidade |
|---|---|---|
| Frequência | `deployment_frequency` | releases/semana |
| Lead time (a) | `lead_time_release_median_hours` | horas |
| Lead time (b) | `lead_time_commit_median_hours` | horas |
| CFR (a) | `cfr_ci` | proporção |
| CFR (b) | `cfr_b` | proporção, exploratória |
| Recuperação | `recovery_median_hours` | horas |

Com três fatores e seis medidas, você planeja **18 testes fator × medida**. Registre esse plano antes de olhar os resultados.

Para cada combinação:

1. Remova apenas projetos sem fator ou métrica válidos.
2. Gere resumo por grupo: n, mediana, Q1, Q3 e IQR.
3. Com três ou mais grupos: `scipy.stats.kruskal` e tamanho de efeito **epsilon² = H/(n-1)**, conforme a fórmula do README. Há outras fórmulas publicadas; neste trabalho use a exigida pela disciplina e informe qual foi usada.
4. Com exatamente dois grupos: `scipy.stats.mannwhitneyu`, bilateral, e **Cliff's delta = 2U1/(n1*n2)-1**. Preserve a ordem dos grupos para interpretar o sinal do delta.
5. Informe grupos vazios, amostras pequenas, todos os valores idênticos e testes não estimáveis. Não invente um resultado para completar a tabela.
6. Para Mann-Whitney, documente tratamento de empates e escolha de método. Para Kruskal-Wallis, reconheça a limitação da aproximação com grupos pequenos.
7. Não interprete Kruskal-Wallis significativo como identificação de qual grupo difere; isso exigiria comparações posteriores justificadas e corrigidas.

Não precisa passar os dados por um teste de normalidade para justificar o método: o README já solicita esses testes não paramétricos.

## 9. Corrigir as comparações múltiplas

Depois de reunir todos os p-valores estimáveis da RQ06:

1. Aplique `statsmodels.stats.multitest.multipletests(..., method='holm', alpha=0.05)`.
2. Use uma família definida previamente: neste plano, os 18 testes fator × medida. Se algum não for estimável, registre o total planejado e o total efetivamente corrigido; não escolha só os p-valores pequenos.
3. Exporte p bruto, p ajustado, decisão a 5%, tamanho de efeito e n.
4. Comente tamanho de efeito mesmo quando não houver significância, sem transformar ausência de evidência em prova de igualdade.

Para Cliff's delta, o README usa: |delta| <0,147 desprezível; <0,33 pequeno; <0,474 médio; >=0,474 grande. Não aplique esses mesmos cortes ao epsilon².

## 10. Produzir os gráficos e escrever resultados

Para RQ05, duas dispersões. Para RQ06, boxplots por fator e medida, podendo organizar os gráficos em painéis. Informe n, unidade e escala. As caixas mostram dispersão; elas não substituem os testes nem os tamanhos de efeito.

No `REPORT.md`, escreva:

1. Base e janela, unidade por repositório e exclusões.
2. Método e decisões de quartis, empates, testes e família Holm.
3. Resultados da RQ05: rho, p e n para cada proxy.
4. Resultados da RQ06: resumos por grupo, teste, p ajustado e efeito.
5. Discussão: o que foi observado, o que não pode ser concluído e diferenças entre proxies.
6. Limitações e dependências da amostra-ouro/CFR (b).

Modelo de frase a preencher **com os valores calculados**, sem inventar números:

> Na RQ05, a associação entre frequência e CFR do CI apresentou rho = [resultado], p = [resultado] e n = [resultado]. Isso indica [interpretação da associação], sem demonstrar causalidade.

> Na RQ06, o fator [nome] apresentou [resultado] para [métrica], com p ajustado de [valor] e efeito [valor e fórmula]. A diferença observada deve ser interpretada considerando os tamanhos dos grupos e as limitações da coleta.

## 11. Tratar corretamente as pendências do grupo

**CFR (b):** o dataset informa `pending_independent_labels`. Leandro tem 300 propostas assistidas, mas a revisão humana, a avaliação oficial de Luis e o consenso final não estão concluídos. Não escreva “heurística validada” nem use o fechamento de uma issue como evidência de F1. Você pode executar as análises com essa variante, identificando-as como exploratórias.

**C1:** não é preciso usá-la como variável de entrada para testar cada métrica na RQ05/RQ06. Caso a utilize em análises extras, distinga C1 completa de classificação com dimensões disponíveis. Os 42 projetos sem recuperação não são automaticamente Elite.

**Rework rate:** pertence ao bônus do Luis, não à sua #8. Não substitui CFR (b).

## 12. Validar a entrega

Verifique ao menos:

- Um exemplo com associação crescente, outro decrescente e um caso de coluna constante.
- Quartis com empates, fator com menos de quatro grupos e grupos vazios depois do filtro.
- Zero real de CFR preservado; ausente não convertido em zero.
- O negativo de Mole excluído somente das análises de lead time por commit.
- Holm comparado com um exemplo pequeno de resultado conhecido.
- Cliff's delta com dois grupos claramente ordenados e efeito com sinal invertido quando trocar a ordem.
- Exportações com n, unidades, ausência e origem consistentes.
- Gráficos visualmente legíveis e script executando novamente a partir do CSV, sem token.

Não é necessário criar testes que apenas repetem linha a linha a implementação. Teste as decisões estatísticas e os casos que podem mudar as conclusões.

## 13. Publicar e repassar para o artigo

1. Execute o script completo e confira os arquivos gerados.
2. Rode os testes da sua análise e `npm test` para verificar a integração existente.
3. Registre no manifesto: hash do CSV, janela, n, exclusões, fatores, cortes, métodos, dependências e estado de validação do CFR (b).
4. Revise `git diff` e `git status`. Adicione apenas código, testes, relatórios, gráficos e documentação da sua entrega.
5. Não adicione ambiente virtual, tokens, caches ou dados brutos grandes. Esta pasta de orientação foi publicada separadamente para compartilhar o roteiro; não coloque nela resultados permanentes da análise.
6. Faça commit referenciando **#8**, por exemplo: `feat: analisar correlacoes e grupos das RQ05 e RQ06` e `Refs #8` na descrição.
7. Dê push e atualize o Projects com links do script e relatório. Não feche pendências como validadas se continuarem pendentes.
8. Entregue ao trio a seção de resultados/discussão para a **issue #10**, usando as mesmas unidades e ressalvas da análise de Leandro/Luis.

## Lista final de conferência

- [ ] Duas correlações Spearman, com rho, p e n.
- [ ] Pelo menos três fatores, com grupos e cortes documentados.
- [ ] Comparação das quatro dimensões, com variantes de lead time/CFR preservadas.
- [ ] Kruskal-Wallis ou Mann-Whitney conforme a quantidade de grupos.
- [ ] Holm aplicado à família planejada.
- [ ] Tamanhos de efeito e resumos por grupo.
- [ ] Gráficos, manifesto, script reproduzível e testes.
- [ ] CFR (b) exploratório e ausentes/valores inválidos explícitos.
- [ ] Resultados e discussão prontos para integrar ao artigo.
- [ ] Commit e push da #8; Projects atualizado.

## Fala simples para a daily

Antes de implementar:

> Minha parte é verificar se frequência de releases está associada à taxa de falha e se grupos de projetos apresentam diferenças nas métricas. Vou usar o CSV já coletado, calcular correlações e comparar grupos, com correção estatística e tamanho de efeito.

Depois de implementar e executar, adapte aos resultados reais:

> Na issue 8, analisei as correlações entre frequência e falhas e comparei as métricas entre grupos de projetos. Registrei os tamanhos de amostra, corrigi os testes múltiplos e gerei tabelas e gráficos. A variante de falha por releases continua identificada como exploratória até a validação do grupo.

## Depois de usar

Pode excluir **somente `data/temporario-issue-8-sprint3/`**. A pasta contém apenas este roteiro e não é entrada de nenhum script. Não exclua `data/dataset-s02-final`, a amostra-ouro, `scripts`, `tests`, `docs` ou os resultados permanentes de `output`.
