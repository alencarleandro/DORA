# Sprint 1 — Isabella / Issue #1

**Integração no site:** o laboratório web executa A, B ou C separadamente, com transferência da amostra entre partes. O CLI também oferece execução integrada. Consulte [o fluxo integrado](INTEGRACAO.md). Os comandos abaixo continuam disponíveis para cada parte isolada.

Seleção e metadados via REST própria, reutilizando `lib/github.mjs`. Sem bibliotecas de acesso ao GitHub. Token somente em `GITHUB_TOKEN`; cache e saídas ficam em `data/`, fora do Git.

## Coletar candidatos e metadados

```powershell
node scripts/select-repos.mjs --config config.json --mode metadata
```

Primeiro lote técnico (10 projetos):

```powershell
node scripts/select-repos.mjs --config config.json --mode metadata --limit 10 --output data/selection-pilot
```

`config.json` usa stars >= 1001, exclui forks para evitar cópias e arquivados para priorizar projetos ativos. São decisões de amostragem ajustáveis, não requisitos universais da disciplina. O limite de candidatos é 100, ordenados por estrelas decrescentes e full_name no desempate. Esse lote é de candidatos, não garante 100 aptos: aumente candidateLimit para repor descartes.

Até 1.000 candidatos, a busca lê diretamente até o orçamento em páginas de 100. Para orçamentos maiores ou resultados incompletos, encontra o máximo de estrelas e divide recursivamente faixas inteiras sem sobreposição quando há mais de 1.000 resultados ou incomplete_results. Empates de estrelas são divididos por data de criação, em segundos. Páginas são percorridas seguindo Link, contagens verificadas e IDs deduplicados. A busca para depois de completar uma partição que preencha o orçamento de candidatos; não é censo de todos os projetos populares. queries.json registra consultas, contagens, incompletude e datas. Se o probe estiver incompleto, a execução falha explicitamente.

## Seleção com filtros

Por definição do grupo, config.json usa o ano civil completo de 2024: de 2024-01-01T00:00:00Z até 2024-12-31T23:59:59Z, inclusivo (366 dias). Essa escolha está registrada em windowSource e não é apresentada como confirmação do professor.

```powershell
node scripts/select-repos.mjs --config config.json --mode full --output data/selection-full
```

O comando executa A e consulta a evidência de releases e runs usando o cliente de C. Ordem: com Actions → pelo menos 5 releases não draft/não prerelease publicadas na janela → pelo menos 50 runs válidos (push, default branch, conclusões success/failure/timed_out/startup_failure) → primeiros sampleSize elegíveis. Este script isolado não calcula o lead time; a execução integrada do site e do CLI inclui a parte B.

Em modo metadata, repositories.csv contém candidatos coletados, com filtros pendentes. Em modo full, contém apenas selecionados. A existência do CSV no modo metadata não comprova elegibilidade. Erros são pendências de coleta, nunca exclusões nem zeros. A amostra abaixo da meta retorna código de saída 1. collection.json registra estado e contagens. Cada projeto atualiza as saídas; repetir o mesmo comando reaproveita respostas em cache. Para modificar configuração ou renovar fotografia, use outra pasta de saída. SIGINT preserva cache e resultados. O cliente já trata rede, 5xx, rate limit e paginação dos runs com subdivisão mensal.

Sem token, a coleta usa a cota pública. maxRateLimitWaitMs limita a espera a 60 segundos por resposta de rate limit nesta configuração; esperas maiores interrompem o comando com cache preservado, permitindo retomada após a renovação. Remova a opção para aguardar automaticamente sem limite. Para lotes maiores configure GITHUB_TOKEN no ambiente local, sem salvar o valor no código ou no arquivo config.

## Dicionário de saídas

CSV UTF-8 com BOM e cabeçalhos, compatível com a parte C. Nulos ficam vazios.

| Arquivo / coluna | Tipo, unidade e origem |
|---|---|
| repositories.csv: full_name, default_branch | Texto; API /repos; entrada de B/C |
| candidates.csv | id, full_name, default_branch, stargazers_count; fotografia da busca |
| metadata.csv: repository_id | Inteiro; id em /repos |
| full_name, default_branch | Texto; nome e branch real da API |
| stars | Inteiro; stargazers_count em /repos |
| language | Texto ou vazio; language em /repos |
| contributors_count | Inteiro ou vazio; GET contributors?per_page=1&anon=true, última página Link; lista vazia é 0, ausência de last com next usa paginação completa |
| contributors_status | available ou unavailable; contagem inclui anônimos, não soma commits; API tem cache e limitações de identificação |
| created_at, collected_at | ISO UTC; criação e horário em que resposta /repos foi obtida, preservado em cache |
| age_days | Número de dias fracionários, sem arredondamento; (fim inclusivo UTC da janela − created_at)/86400000; vazio sem janela ou se criação é posterior |
| age_reference | ISO UTC do fim inclusivo da janela; vazio sem janela |
| metadata_status, error | complete, partial ou created_after_window; erro explícito |
| selection_decisions.csv: actions_count | Inteiro ou vazio; total_count de actions/workflows |
| releases_count | Inteiro ou vazio; releases publicadas principais dentro da janela inclusiva |
| valid_runs_count | Inteiro ou vazio; apenas runs válidos; pode ser limite inferior quando a elegibilidade já foi comprovada |
| runs_count_complete | Booleano; false indica contagem parcial suficiente para inclusão, true indica contagem completa; saídas antigas podem não conter este campo |
| decision, reason, error | pending, error, excluded, selected, not_selected; motivo da primeira etapa reprovada ou não observada |
| selection_funnel.csv | stage, entered, excluded, errors, pending, not_selected, remaining: contagens exclusivas; entered é a soma das cinco colunas de resultados |
| queries.json / collection.json | Consultas e estado auditável; não contém credenciais |

Testes: `npm test`. Fixtures simulam teto da busca, duplicação, erro, incompletude, contagem de contribuidores, idade e conservação do funil. O CI existente executa todos os tests/*.test.mjs; a meta de cobertura de 80% permanece no módulo de métricas. Nenhum push, alteração de Issue ou Projects é feito pelo script.

## Limitação de coleta histórica

Na coleta de 2024 executada em outubro de 2026, repositórios com releases suficientes retornaram zero runs na janela. Esse resultado representa o que a API disponibilizou na data da coleta; não prova que o projeto não executou CI em 2024. Workflows atuais também não provam a configuração histórica. Conforme a [documentação de retenção do GitHub](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository), runs estão sujeitos a exclusão. A mudança de outubro de 2026 aplica as configurações de retenção também aos runs; a documentação informa que, anteriormente, eram retidos por 400+ dias. A ausência dos dados nesta amostra é compatível com perda do histórico, mas não identifica a causa da ausência de cada run.

Não transforme ausência de runs em CFR igual a zero ou recuperação perfeita. O mínimo de 50 runs observáveis continua obrigatório: sem essa evidência o repositório não entra na amostra operacional. Se não houver 100 aptos, registre a insuficiência; uma nova janela precisa ser uma decisão explícita do grupo/professor, e deve usar uma nova pasta para preservar os resultados de 2024.

Fontes: [busca REST](https://docs.github.com/en/rest/search/search) e [metadados e contribuidores](https://docs.github.com/en/rest/repos/repos).
