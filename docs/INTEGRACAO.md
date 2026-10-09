# A → CSV → B/C no laboratório web

O site executa uma parte por vez. **A seleciona os repositórios e coleta os dados completos. B e C calculam as métricas localmente**, a partir dos arquivos de A ou de CSVs importados. O token é utilizado em A; não é necessário para B/C neste fluxo.

## A — seleção e coleta

Informe as datas da janela, a meta da amostra e o limite de candidatos. A busca por estrelas exclui forks e arquivados. A amostra exige Actions, pelo menos 5 releases principais publicadas na janela e 50 runs válidos de push no default branch. A verificação de elegibilidade pode parar ao confirmar 50 runs; essa contagem parcial não substitui o histórico completo.

Depois de selecionar, A coleta releases, tags, commits comparados com a release anterior (inclusive quando a base é anterior à janela) e workflows completos por mês. Intervalos com pelo menos mil runs são subdivididos para superar o teto de resultados. A usa as funções de coleta existentes de B/C, mas não calcula suas métricas finais.

A seleção e o histórico completo são etapas diferentes: os 100 selecionados permanecem preservados enquanto os dados são preparados. `datasets.completed` registra os repositórios com releases/commits e runs completos. Arquivos de entrada para B/C e a transferência automática ficam bloqueados enquanto algum selecionado não tiver esses dados. Falhas de comparação não são aceitas como commits vazios.

Para completar uma seleção insuficiente, aumente **Limite de candidatos** e use **Retomar do cache**. A mantém os candidatos anteriores, suas decisões e os aprovados; acrescenta candidatos únicos e para ao atingir a meta. Os dados completos também podem ser retomados: arquivos já prontos e páginas em cache não são baixados novamente.

## CSVs de A

- `repositories.csv`: lista da amostra; não contém os eventos necessários para calcular métricas.
- `metadata.csv`, `decisions.csv`, `queries.csv`, `funnel.csv`: metadados e auditoria da seleção.
- **`release-data.csv` / CSV de entrada B**: uma linha por release, com `repository`, `default_branch`, `window_start`, `window_end`, `tag_name`, `published_at`, `base_tag`, `has_previous_release`, `compare_error` e `commits_json`. A lista JSON guarda SHA, data do autor e mensagem de cada commit; uma lista vazia preserva a existência da release. Assim um único CSV contém todo o contrato de B.
- **`runs.csv` / Runs**: `repository`, `default_branch`, `id`, `workflow_id`, `event`, `head_branch`, `conclusion`, `created_at`, `run_started_at`, `updated_at`, `window_start`, `window_end`.
- `releases.csv`, `commits.csv`, `tags.csv`: saídas separadas para inspeção. Para importar em B, use `release-data.csv`, que preserva também releases sem commits.

Não edite `commits_json` manualmente; a biblioteca CSV aplica aspas e escape. B/C verificam a janela declarada no CSV e rejeitam divergências. B rejeita releases duplicadas, commits duplicados na mesma release e comparações incompletas. C valida os campos de runs e rejeita IDs duplicados.

## B — cálculos locais

Na aba B, escolha uma A com dados completos ou importe **CSV de entrada B**. B calcula frequência de releases por semana, lead time por release e por commit, mediana e IQR. Não consulta a API e não pede token. Uma primeira release histórica sem base é ignorada somente no lead time. O cache é desnecessário para o cálculo; os dados de entrada permanecem disponíveis em disco.

## C — cálculos locais

Na aba C, escolha uma A com dados completos ou importe **Runs**. C calcula CFR (a), mediana/IQR da recuperação e episódios censurados. Não consulta a API e não pede token. O branch e a janela de A são preservados na transferência automática.

## Terminal

Substitua as datas do exemplo pela janela definida para o trabalho:

```powershell
# A seleciona e prepara todos os dados; GITHUB_TOKEN somente para a coleta.
npm run pipeline -- --mode selection --start 2025-01-07 --end 2025-12-07 --candidate-limit 600 --sample-size 100
# B e C importam dados completos sem token.
npm run pipeline -- --mode releases --data-source csv --csv release-data.csv --start 2025-01-07 --end 2025-12-07
npm run pipeline -- --mode import --csv runs.csv --start 2025-01-07 --end 2025-12-07
# Ou use os arquivos locais de A, com janela herdada:
npm run pipeline -- --mode releases --source-job ID-DE-A
npm run pipeline -- --mode collect --source-job ID-DE-A
```

Para retomar: `npm run pipeline -- --resume ID`. Para seleção sem a coleta completa no CLI: `--selection-only true`. Os scripts individuais antigos de seleção/coleta e o modo integrado continuam disponíveis para compatibilidade; são alternativas ao novo fluxo web.

Dados, respostas paginadas e CSVs ficam em `data/jobs/<id>/`, fora do Git. O token não é salvo nos jobs/CSVs. Pausa e retomada preservam o progresso; não execute CLI e site simultaneamente sobre o mesmo ID. Coletar todos os commits e runs de 100 projetos pode exigir várias renovações da cota, mesmo após a seleção já ter terminado.

## Verificação e ativação

`npm test` verifica o caminho A → CSV → B/C com API indisponível nas duas análises, igualdade dos resultados entre arquivo local e CSV, retomada após falha e bloqueio de conjuntos incompletos. Os testes simulados não representam a coleta real dos 100 projetos.

Depois de atualizar o backend, reinicie somente o app **DORA** no Arsenal e atualize a página. O laboratório continua público. As alterações desta adaptação são locais; não foram enviadas ao GitHub.

## Persistência dos dados

O cache em data/jobs/ID/cache não é temporário: não há expiração automática ou limpeza ao fechar/reiniciar o app. Releases/commits e runs completos são salvos em arquivos JSON no mesmo job; B/C leem esses arquivos diretamente, sem token e sem rede. Reabrir a mesma amostra reaproveita os dados salvos. O token só é necessário para completar consultas que ainda não estão no cache ou atualizar a fotografia. Nunca é necessário um novo token apenas para ler ou recalcular dados completos já salvos.
