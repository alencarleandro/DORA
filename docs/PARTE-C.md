# DORA — Sprint 1 / Pessoa C

**Integração no site:** o laboratório web executa A, B ou C separadamente, com transferência da amostra entre partes. O CLI também oferece execução integrada. Consulte [o fluxo integrado](INTEGRACAO.md). Os comandos abaixo continuam disponíveis para cada parte isolada.

App web e pipeline independente para coleta de workflow runs, CFR de CI (RQ03 a) e recuperação (RQ04). Node.js 24, sem dependências externas ou banco de dados. As respostas são armazenadas em JSON local. A interface e a CLI usam o mesmo processamento.

## Executar

```powershell
npm start
```

Abra http://127.0.0.1:4117. O laboratório é público e abre diretamente, sem login, chave de acesso ou configuração de `DORA_ACCESS_KEY`. Os dados locais ficam fora do Git.

Na interface, selecione o modo, envie o CSV e informe as datas fixadas pelo professor. Nenhuma data presumida é preenchida. A API, o histórico e as exportações também são públicos. O token GitHub fornecido na interface fica em memória durante a execução e não é persistido; para retomar após reiniciar o servidor, informe-o novamente. Também pode ser lido da variável `GITHUB_TOKEN`.

## Contrato com a pessoa A

CSV UTF-8, vírgula ou ponto e vírgula, com cabeçalho:

```csv
full_name,default_branch
cli/cli,trunk
pytest-dev/pytest,main
```

`full_name` contém `owner/repo`. Também aceitamos `repository`, `owner` + `repo`, ou `repo` contendo owner/repo. `default_branch` é opcional: o coletor consulta e valida o branch principal pela API. Apenas projetos públicos são aceitos. O app não escolhe os candidatos; a pessoa A continua responsável pela seleção e seus metadados.

O coletor consulta a existência de Actions, coleta runs de `event=push` no branch principal e filtra por `created_at` na janela. Cada mês é paginado pelo cabeçalho Link. Intervalos com ≥ 1.000 runs são subdivididos recursivamente, em segundos, para evitar o teto da API. Se até um segundo atingir o teto, o repositório é sinalizado como erro em vez de apresentar métricas incompletas.

## Rodar com um único comando

```powershell
$env:GITHUB_TOKEN = 'seu-token'
npm run pipeline -- --csv examples/repositories.csv --start AAAA-MM-DD --end AAAA-MM-DD
```

Substitua as datas pelas do professor. Início e fim são inclusivos, em UTC; máximo de 366 dias. A CLI mostra o ID da coleta. Para retomar depois de Ctrl+C, queda de rede ou erro:

```powershell
npm run pipeline -- --resume ID-DA-COLETA
```

As páginas da API são salvas atomicamente em `data/jobs/ID/cache`. Ao retomar o mesmo ID, páginas já recebidas não são consultadas novamente e repositórios concluídos não são reprocessados. Um novo processamento cria outro ID/cache: isso permite uma nova fotografia dos dados. Runs ainda em andamento permanecem como foram observados; use nova coleta para atualizar. Não execute a CLI e a interface sobre o mesmo ID simultaneamente.

O cliente lê os cabeçalhos de rate limit/Retry-After, espera na cota primária ou secundária e repete erros de rede/5xx com backoff exponencial (1, 2, 4, 8, 16, 32 e 64 segundos). Após sete tentativas, o erro é registrado e pode ser retomado. Uma coleta com erros nunca é apresentada como completa.

## Importação de runs já coletados

CSV com `repository,default_branch,id,workflow_id,event,head_branch,conclusion,created_at,run_started_at,updated_at`. Datas devem ser ISO 8601 com timezone. IDs duplicados e campos obrigatórios ausentes são rejeitados. O exemplo é fictício, apenas para verificar o app:

```powershell
npm run pipeline -- --mode import --csv examples/runs.csv --start 2026-01-01 --end 2026-01-31
```

O exemplo deve resultar em cinco runs válidos, CFR 0,6, recuperação de 1h20 e um episódio censurado. Não constitui dataset acadêmico.

## Definições de métricas

- **CFR (a):** `falhas / (falhas + sucessos)`. `success` é sucesso; `failure`, `timed_out`, `startup_failure` são falhas; as demais conclusões são ignoradas. Retorna vazio quando não há runs válidos. É proxy de CI, não falha em produção.
- **Recuperação:** por workflow, ordenar por `run_started_at`; primeira falha após sucesso inicia episódio; falhas consecutivas continuam o mesmo episódio. O próximo sucesso o encerra em `updated_at`. Sucesso terminado após o fim da janela não encerra episódio. A mediana e o IQR usam apenas episódios encerrados. Os abertos são exportados como censurados, com duração observada até o fim da janela.
- **Início da janela:** falhas sem um sucesso anterior observado não atendem à definição de episódio da seção 5. São contabilizadas em `initial_failures_without_success`; entram no CFR, mas não na recuperação. Essa limitação deve constar nas ameaças à validade.
- **Funil parcial:** candidatos → processados → com Actions → ≥ 50 runs válidos. Não decide a amostra final: a pessoa B precisa aplicar também ≥ 5 releases.

## Saídas

Na web, baixe métricas, runs, episódios e funil. Na CLI, os mesmos CSVs são gerados em `data/jobs/ID/exports`. Repositórios abaixo do filtro permanecem no CSV com `eligible_runs=false` e motivo de exclusão. Erros são mantidos no histórico/JSON da coleta e não geram métricas inventadas. Veja [o dicionário de dados](DATA-DICTIONARY.md).

## Testes e CI

```powershell
npm test
```

Testes nativos Node.js, equivalente permitido pelo README para outra linguagem. Cobertura mínima de linhas e branches: 80% do módulo de métricas. Fixtures reproduzem o exemplo de 1h20 do enunciado e cobrem censura, conclusões ignoradas, diferentes workflows, dados vazios, filtros e datas. Cliente API testado com respostas simuladas para paginação, cache, rate limit, retries e teto de resultados. `.github/workflows/testes.yml` executa a suíte a cada push/PR. O workflow só será executado no GitHub após enviar o código.

## Publicação no A.R.S.E.N.A.L

Nome: DORA · Workflows. Rota: `dora`. Pasta: este repositório. Comando: `npm start`. Porta: `4117`. Modo: **remover prefixo**. Inicialização automática habilitada. Arquivos e requisições da interface usam URLs relativas, compatíveis com `/dora/`.

O servidor escuta em 127.0.0.1 e respeita `PORT`. Não requer alterações no código do Arsenal, dependências de npm, credenciais Postgres ou instalações de Python.

App publicado em https://arsenal.dev.br/dora/. Depois de alterar o backend, use **Reiniciar app** no cartão do DORA no Arsenal; não é necessário reiniciar os demais apps. O laboratório é público, sem chave de acesso.

Validação local: 19 testes passaram; cobertura do módulo de métricas 100% de linhas e 98,39% de branches. Importação e exportação verificadas pela API HTTP e pelo navegador. Smoke test real no GitHub em cli/cli, dia 30/09/2026: 21 workflows disponíveis e 12 runs coletados/validos. Essa janela é somente teste técnico, não a janela oficial do professor.

## Entrega acadêmica pendente

O módulo C está preparado para integrar ao pipeline A/B. A coleta real de 100 repositórios depende do CSV de candidatos, janela oficial e cota da API. Cada integrante deve ter suas Issues com assignee e commits referenciando seus números. Não há criação automática de Issues nem commits sem um número real fornecido pelo grupo. A introdução do artigo permanece entrega conjunta.
