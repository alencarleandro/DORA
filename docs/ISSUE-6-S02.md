# Sprint 2 — Isabella / Issue #6

## Entrega preparada

A base final tem **300 repositórios**, janela UTC **2025-01-01 a 2025-12-31**, e **55 colunas**. O dataset foi montado novamente a partir da lista e dos metadados de A e dos exports de métricas de B/C. A conferência confirmou igualdade de todos os valores com o CSV entregue por Leandro. Não houve nova coleta dos 300 projetos nem recálculo dos dados brutos.

- [Dataset](../data/dataset-s02-final/dataset.csv).
- [Dicionário CSV](../data/dataset-s02-final/dictionary.csv) e [documentação das colunas](DATA-DICTIONARY.md#dataset-consolidado--sprint-2--issue-6).
- [Manifesto e hashes dos inputs](../data/dataset-s02-final/manifest.json).
- [Relatório de qualidade](../data/dataset-s02-final/validacao/quality-report.json).
- [Lista, metadados, decisões, consultas e funil de A](../data/dataset-s02-final/selecao/).
- [Comparações indisponíveis](../data/dataset-s02-final/metricas/comparison-quality.json).

## Rotulação assistida da amostra-ouro

A amostra original foi preservada: **60 repositórios × 5 releases**, semente 42, sorteada de 299 projetos com comparações disponíveis na coorte de 300. Essa restrição da população sorteável deve constar na metodologia.

Foram consultadas as páginas públicas dos 60 repositórios e das 300 releases, com confirmação das tags e das datas de publicação. Changelogs e comparações de commits complementaram notas vagas. Os links, hashes do conteúdo consultado e justificativas estão no [registro de evidências](../data/gold-standard-final-300-2025/revisao-isabella/evidencias-isabella.csv).

O [rascunho de Isabella](../data/gold-standard-final-300-2025/revisao-isabella/rotulos-isabella-assistidos.csv) contém propostas nas três dimensões: tipo do projeto, entrega real ao usuário e release corretiva. Há **108 propostas de corretiva e 192 de não corretiva**. São resultados de análise assistida por IA, posteriormente revisados por Isabella, sem valor de consenso ou anotação humana sem auxílio.

Isabella confirmou a revisão e aceitação das propostas. Os 300 rótulos foram transferidos para `rotulos-isabella.csv`, com indicação de análise assistida por IA e revisão humana. `revisao-isabella/revisao-isabella.json` registra a confirmação e os hashes do rascunho revisado e do arquivo final. Os scripts de concordância e consenso usam o arquivo oficial por padrão. Os arquivos dos outros integrantes e o consenso antigo não foram usados para escolher os rótulos desta análise. Não foram usadas previsões da heurística para classificar a nova amostra.

### Critérios aplicados às propostas

- **Tipo do projeto:** finalidade principal de uso descrita no README. Ferramentas híbridas e runtimes exigem atenção. Tags de subpacotes não alteram automaticamente o tipo do repositório.
- **Entrega real:** disponibilidade de uma versão que o usuário consegue instalar ou executar, inclusive biblioteca usada por desenvolvedores. Isso não demonstra deploy em produção. Moby ficou `incerto`, pois suas tags misturam componentes de engine e biblioteca cliente.
- **Corretiva:** julgamento do objetivo principal da versão à luz das notas e mudanças. Regressões explícitas, hotfixes e manutenção focada em defeitos sustentam `sim`. Novas funcionalidades ou alterações amplas sustentam `não`, mesmo se houver correções na versão. Aumentar patch ou conter a palavra fix não decide o rótulo automaticamente.
- **Histórico nas notas:** não atribuir à versão atual novidades ou defeitos descritos para versões anteriores. Um aviso de defeito causado pela release não a torna corretiva.
- **Dependências e monorepos:** avaliar o pacote da tag. Mudanças em outro pacote do mesmo repositório não comprovam o propósito corretivo do pacote sorteado.

### Revisão humana registrada

Isabella informou que revisou as propostas e elas foram incorporadas ao arquivo oficial. O uso de IA continua explícito na documentação e nas notas. Esta revisão assistida não deve ser apresentada como anotação humana sem auxílio ou como cumprimento, por si só, do protocolo de três avaliações humanas cegas.

As notas com “revisar” destacam casos especialmente ambíguos para discussão no consenso: releases de propósito misto, notas cumulativas de CCXT, builds de CI/distribuição, subpacotes e runtimes. Os READMEs foram consultados no momento da análise e podem ter mudado desde 2025, especialmente em projetos que mudaram de nome ou finalidade.

Após as três avaliações humanas independentes, Luís calcula a concordância e conduz o consenso (#4). Leandro avalia a heurística (#5). **Não houve execução de Kappa, consenso ou F1 nesta entrega.** `cfr_b_validation` continua `pending_independent_labels`.

## Verificação do dataset

O montador confere chaves únicas, presença dos mesmos 300 projetos, default branch, mínimos de inclusão, igualdade dos valores com a entrega original, fórmulas de contagens e taxas, inventário de releases, unidades em horas/dias, ordem dos quartis, IQR e cobertura exata das 55 colunas pelo dicionário. Os limites da janela e IDs são herdados do manifesto original. Sem os dados brutos, o montador não reaudita a janela de cada evento nem a coleta da API.

Não houve divergência nessas verificações. Foram preservados:

- 42 repositórios com estatísticas de recuperação vazias.
- 37 repositórios com fração de censura vazia por ausência de episódios.
- Duas comparações indisponíveis registradas na entrega original.
- Um aviso de lead time por commit negativo em `tw93/Mole`. O valor deve ser discutido/revisado com B, sem correção silenciosa ou substituição por zero.

Na suíte existente, `npm test` executou 103 testes: **102 passaram e um falhou** em `tests/git-evidence.test.mjs:28`. O teste esperava um clone Git filtrado sem objetos tree/blob, mas o Git desta execução manteve um objeto tree. A falha fica registrada em `data/dataset-s02-final/validacao/tests.txt`. As funções de métricas, concordância e classificação tiveram cobertura de linhas de 100%. O módulo Git e esse teste não foram alterados nesta entrega. As verificações próprias dos CSVs passaram.

## Reprodução sem token

Na raiz do projeto:

```powershell
node scripts/build-isabella-labels.mjs
node scripts/assemble-isabella-dataset.mjs
```

O primeiro comando reaplica as decisões editoriais registradas em `data/gold-standard-final-300-2025/revisao-isabella/decisoes.json` sobre a amostra cujo hash foi fixado, usando o registro versionado de evidências quando o cache local não existe. Não realiza avaliação humana, não consulta a heurística e não sobrescreve o arquivo oficial revisado. Alterar a amostra exige revisar as decisões antes de gerar novos arquivos.

O segundo monta o dataset a partir dos exports versionados e escreve o relatório de qualidade e o dicionário. Falha se as verificações não passarem. Para recalcular métricas a partir de releases, commits e runs, é necessário obter os dados brutos locais de A; eles não estão neste checkout.

Para coletar novamente as páginas públicas e fontes complementares, use os scripts `collect-label-evidence.mjs` com `releases` e `repos`, `collect-label-supplement.mjs` e `collect-label-final-checks.mjs`. O cache fica em `data/issue-6-evidence`, fora do Git. GitHub pode limitar as chamadas não autenticadas e páginas atuais podem divergir das fotografias registradas.

## Fechamento da issue

A consolidação, o dicionário e os rótulos revisados de Isabella estão preparados. A equipe ainda precisa concluir as avaliações dos outros integrantes, o consenso e a validação de CFR (b). Os arquivos desta alteração estão disponíveis no checkout; não houve commit nem push. Ao registrar a entrega no Git, referenciar **#6** na mensagem do commit.

Os locais de cada artefato e as responsabilidades do grupo estão no [guia de pastas da Sprint 2](ESTRUTURA-DADOS-S02.md). A entrega está nas pastas versionadas, sem ZIP ou cópias em diretórios de empacotamento.
