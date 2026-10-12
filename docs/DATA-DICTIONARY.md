# Dicionário de dados — Pessoa C

CSV UTF-8 com BOM; taxas em fração 0–1; campos vazios indicam ausência de medição. Fórmulas de planilha potencialmente ativas recebem apóstrofo no export para evitar execução ao abrir em Excel.

Os importadores de B e dos rótulos removem esse apóstrofo de proteção dos CSVs exportados pelo projeto; isso preserva tags como `@scope/pkg@1.0.0` ao comparar com as referências reais. O parser genérico mantém o conteúdo literal por padrão.

Comparações indisponíveis por `not_found` ou `unrelated_histories` permanecem identificadas em `compare_error`, com lista de commits vazia que significa ausência de medição. B exclui essas releases do lead time e contabiliza `releases_ignored_compare_error`; CFR (b) trata uma release corretiva indeterminada como desconhecida quando isso afeta o episódio. C usa os runs e pode ser calculada independentemente. `comparison-quality.json` registra as comparações indisponíveis. Erros de rede, paginação truncada ou autenticação não são convertidos em comparações permanentemente indisponíveis.

## metrics.csv

| Coluna | Tipo / unidade | Origem ou fórmula |
|---|---|---|
| repository | texto | owner/repo |
| default_branch | texto | API de metadados ou CSV de runs |
| runs_total | inteiro | Runs únicos de push no branch/janela |
| runs_valid | inteiro | successes + failures |
| runs_ignored | inteiro | runs_total − runs_valid |
| failures | inteiro | failure + timed_out + startup_failure |
| successes | inteiro | conclusion=success |
| cfr_ci | fração | failures / runs_valid; vazio se denominador zero |
| recovery_median_hours | horas | Mediana de episódios encerrados |
| recovery_q1_hours | horas | Percentil 25, interpolação linear |
| recovery_q3_hours | horas | Percentil 75, interpolação linear |
| recovery_iqr_hours | horas | q3 − q1 |
| episodes_total | inteiro | Episódios encerrados + censurados |
| episodes_censored | inteiro | Sem recuperação dentro da janela |
| censored_fraction | fração | episodes_censored / episodes_total |
| initial_failures_without_success | inteiro | Falhas anteriores ao primeiro sucesso observado no workflow |
| eligible_runs | booleano | Pelo menos 50 runs válidos; filtro parcial |
| excluded_reason | texto | sem_actions / menos_de_50_runs_validos / vazio |

## runs.csv

`repository` e `default_branch` contextualizam cada execução. `id`, `workflow_id` vêm da API (IDs, mantidos como texto no CSV); `event`, `head_branch`, `conclusion` são campos originais. `created_at`, `run_started_at`, `updated_at` são datas ISO 8601 com timezone, sem conversão para horário local. Na coleta, preservam-se também runs com conclusões ignoradas.

## episodes.csv

| Coluna | Tipo / unidade | Origem ou fórmula |
|---|---|---|
| repository | texto | owner/repo |
| workflow_id | ID | Workflow que contém o episódio |
| failure_run_id | ID | Primeira falha após sucesso |
| recovery_run_id | ID | Primeiro sucesso seguinte; vazio se censurado |
| started_at | data ISO | run_started_at da primeira falha |
| ended_at | data ISO | updated_at do sucesso; vazio se censurado |
| hours | horas | (ended_at − started_at) ou limite inferior (fim da janela − started_at) se censurado |
| censored | booleano | true se sem recuperação observada |

## funnel.csv

`stage`: nome da etapa parcial (candidatos, processados, com_actions, 50_runs_validos, erros). `count`: inteiro com total da etapa. Erros não se confundem com exclusão por critério científico. Na importação, presença de runs serve como evidência de Actions; não existe consulta aos workflows.

---

# Dicionário de dados — Pessoa B (Lead Time & Releases)

## lead_time_metrics.csv

| Coluna | Tipo / unidade | Origem ou fórmula |
|---|---|---|
| repository | texto | owner/repo |
| default_branch | texto | Branch principal |
| releases_in_window | inteiro | Total de releases publicadas na janela inclusiva |
| releases_evaluated | inteiro | Releases com compare e commits válidos |
| releases_ignored | inteiro | Total de releases não avaliadas no lead time |
| releases_ignored_no_previous | inteiro | 1ª release da história (sem base para compare) |
| releases_ignored_compare_error | inteiro | Releases com compare retornando 404 |
| releases_ignored_no_commits | inteiro | Releases sem commits novos na comparação |
| commits_total | inteiro | Total de commits considerados |
| deployment_frequency | fração | releases_in_window / semanas_da_janela |
| lead_time_release_median_hours | horas | Mediana do lead time por release (variante a) |
| lead_time_release_iqr_hours | horas | IQR do lead time por release (variante a) |
| lead_time_release_median_days | dias | Mediana por release convertida para dias |
| lead_time_release_iqr_days | dias | IQR por release convertido para dias |
| lead_time_commit_median_hours | horas | Mediana do lead time por commit (variante b) |
| lead_time_commit_iqr_hours | horas | IQR do lead time por commit (variante b) |
| lead_time_commit_median_days | dias | Mediana por commit convertida para dias |
| lead_time_commit_iqr_days | dias | IQR por commit convertido para dias |
| eligible_releases | booleano | releases_in_window >= 5 |
| error | texto | Mensagem de erro de coleta ou vazio |

## CFR (b) nas métricas de B e no dataset consolidado

| Coluna | Tipo / unidade | Origem ou fórmula |
|---|---|---|
| cfr_b | fração | Releases com correção observada em até 7 dias / releases avaliáveis; vazio se denominador zero |
| cfr_b_releases_evaluated | inteiro | Denominador após excluir releases censuradas e indeterminadas |
| cfr_b_releases_failed | inteiro | Releases avaliáveis seguidas por uma release corretiva em até 7 dias |
| cfr_b_releases_censored | inteiro | Releases sem sete dias completos de acompanhamento até o fim da janela |
| cfr_b_releases_unknown | inteiro | Releases cujo resultado não pôde ser determinado com as evidências disponíveis |
| cfr_b_heuristic_version | texto | Versão da regra que classifica releases corretivas |
| cfr_b_validation | texto | `pending_independent_labels` enquanto faltarem rótulos independentes e validação da amostra real |

CFR (b) permanece exploratória até a validação; ela não substitui `cfr_ci`, calculada com as conclusões de CI. Veja `docs/PARTE-C-S02.md` para as versões da regra e o tratamento das comparações indisponíveis.

## Proveniência do dataset consolidado

`window_start` e `window_end` indicam a janela UTC inclusiva. `source_job_id`, `b_job_id` e `c_job_id` permitem recuperar os arquivos persistentes de cada etapa em `data/jobs`. Há uma linha por repositório, sem substituir medições ausentes por zero. Frequência de deploy é releases por semana; tempos com sufixo `_hours` são horas e `_days` são dias.

## releases.csv

| Coluna | Tipo / unidade | Descrição |
|---|---|---|
| repository | texto | owner/repo |
| tag_name | texto | Tag da release |
| published_at | data ISO | Data de publicação da release |
| base_tag | texto | Tag da release anterior usada como base |
| has_previous_release | booleano | Indica se havia release anterior |
| commits_count | inteiro | Quantidade de commits entre as duas releases |
| lead_time_hours | horas | Lead time da release (variante a) |
| lead_time_days | dias | Lead time da release em dias (variante a) |
| compare_error | texto | Código de erro caso o compare tenha falhado |

## commits.csv

| Coluna | Tipo / unidade | Descrição |
|---|---|---|
| repository | texto | owner/repo |
| release_tag | texto | Tag da release de destino |
| release_published_at | data ISO | Data de publicação da release de destino |
| commit_sha | texto | SHA do commit |
| author_date | data ISO | Data de autoria do commit (`commit.author.date`) |
| lead_time_hours | horas | Diferença entre published_at e author_date |
| lead_time_days | dias | Diferença entre published_at e author_date em dias |

<!-- dataset-s02-final-schema -->

# Dataset consolidado — Sprint 2 / Issue #6

Uma linha por repositório, chave `repository` normalizada em minúsculas para junção. Os 300 projetos e a janela 2025-01-01 a 2025-12-31 são preservados. Dicionário legível por máquina: `data/dataset-s02-final/dictionary.csv`.

O CSV final contém 55 colunas. Contagens ausentes e taxas sem denominador continuam vazias. Quartis usam interpolação linear em `(n − 1) × p`. Recuperação resume apenas episódios encerrados. As contagens de censura preservam os episódios não encerrados. Metadados de popularidade são uma fotografia da coleta, não uma medida histórica de 2025.

| Coluna | Tipo | Unidade | Origem ou fórmula |
|---|---|---|---|
| window_start | data ISO AAAA-MM-DD | UTC | Início da janela, inclusive às 00:00:00Z; manifesto da coleta A. |
| window_end | data ISO AAAA-MM-DD | UTC | Fim da janela, inclusive às 23:59:59Z; manifesto da coleta A. |
| repository | texto | owner/repo | Lista selecionada por A. Chave de junção, comparada em minúsculas. |
| default_branch | texto | nome de branch | A /repos/{owner}/{repo}; deve coincidir com os exports de B e C. |
| stars | inteiro | estrelas | A: stargazers_count na fotografia de metadados da coleta. |
| language | texto | linguagem principal | A: language da API; vazio se a API não informa linguagem. |
| contributors_count | inteiro | contribuidores | A: endpoint contributors com anon=true e paginação; inclui anônimos. Pode estar vazio se indisponível. |
| age_days | número real | dias | A: (fim da janela em UTC − created_at do repositório) / 86400000 milissegundos. |
| releases_in_window | inteiro | releases | B: releases publicadas na janela, sem draft e sem prerelease. |
| deployment_frequency | número real | releases/semana | B: releases_in_window / ((fim UTC − início UTC) / 604800000 milissegundos). |
| releases_evaluated | inteiro | releases | B: releases com base anterior, comparação disponível e commits para medir lead time. Diferente do denominador de CFR (b). |
| releases_ignored | inteiro | releases | B: soma de releases_ignored_no_previous, releases_ignored_compare_error e releases_ignored_no_commits. |
| releases_ignored_no_previous | inteiro | releases | B: releases sem release anterior para comparação. |
| releases_ignored_compare_error | inteiro | releases | B: comparações indisponíveis, como not_found ou unrelated_histories; excluídas do lead time. |
| releases_ignored_no_commits | inteiro | releases | B: comparações disponíveis sem commits novos. |
| commits_total | inteiro | observações de commits | B: soma de commits associados às releases avaliadas. Não é censo de SHAs únicos do repositório. |
| lead_time_release_median_hours | número real | horas | B: mediana de (published_at − menor commit.author.date) / 3600000, entre releases avaliadas. |
| lead_time_release_q1_hours | número real | horas | B: percentil 25 dos lead times por release, interpolação linear. |
| lead_time_release_q3_hours | número real | horas | B: percentil 75 dos lead times por release, interpolação linear. |
| lead_time_release_iqr_hours | número real | horas | B: lead_time_release_q3_hours − lead_time_release_q1_hours. |
| lead_time_release_median_days | número real | dias | B: lead_time_release_median_hours / 24. |
| lead_time_release_iqr_days | número real | dias | B: lead_time_release_iqr_hours / 24. |
| lead_time_commit_median_hours | número real | horas | B: mediana de todas as observações (release.published_at − commit.author.date) / 3600000 das releases avaliadas. |
| lead_time_commit_q1_hours | número real | horas | B: percentil 25 dos lead times por commit, interpolação linear. |
| lead_time_commit_q3_hours | número real | horas | B: percentil 75 dos lead times por commit, interpolação linear. |
| lead_time_commit_iqr_hours | número real | horas | B: lead_time_commit_q3_hours − lead_time_commit_q1_hours. |
| lead_time_commit_median_days | número real | dias | B: lead_time_commit_median_hours / 24. |
| lead_time_commit_iqr_days | número real | dias | B: lead_time_commit_iqr_hours / 24. |
| runs_total | inteiro | workflow runs | C: runs únicos de event=push no default branch, com created_at dentro da janela, inclusive conclusões ignoradas. |
| runs_valid | inteiro | workflow runs | C: failures + successes; conclusões success, failure, timed_out e startup_failure. |
| runs_ignored | inteiro | workflow runs | C: runs_total − runs_valid; outras conclusões não entram no CFR de CI. |
| failures | inteiro | workflow runs | C: quantidade com conclusion failure, timed_out ou startup_failure. |
| successes | inteiro | workflow runs | C: quantidade com conclusion success. |
| cfr_ci | número real | proporção 0–1 | C: failures / runs_valid; mede falha de pipeline, proxy CFR (a). Vazio sem denominador. |
| recovery_median_hours | número real | horas | C: mediana de (updated_at do sucesso − run_started_at da primeira falha) / 3600000, por episódios encerrados no mesmo workflow após sucesso anterior. |
| recovery_q1_hours | número real | horas | C: percentil 25 das recuperações encerradas, interpolação linear; censurados não entram. |
| recovery_q3_hours | número real | horas | C: percentil 75 das recuperações encerradas, interpolação linear; censurados não entram. |
| recovery_iqr_hours | número real | horas | C: recovery_q3_hours − recovery_q1_hours. |
| cfr_b | número real | proporção 0–1 | B: cfr_b_releases_failed / cfr_b_releases_evaluated. Release falha quando seguida por release considerada corretiva em até sete dias, inclusive. Exploratória até validação. |
| cfr_b_releases_evaluated | inteiro | releases | B: denominador após excluir censuradas e desconhecidas; diferente de releases_evaluated do lead time. |
| cfr_b_releases_failed | inteiro | releases | B: releases avaliáveis seguidas em até sete dias por release classificada como corretiva. |
| cfr_b_releases_censored | inteiro | releases | B: releases sem sete dias completos de acompanhamento até o fim da janela; ficam fora do denominador. |
| cfr_b_releases_unknown | inteiro | releases | B: resultado indeterminado por comparação indisponível que afete a classificação; fica fora do denominador. |
| cfr_b_heuristic_version | texto | identificador de versão | B: versão da heurística aplicada. Preservada do export, ainda sem validação humana completa. |
| episodes_total | inteiro | episódios | C: episódios de falha após sucesso anterior, encerrados ou censurados, agrupados por workflow. |
| episodes_censored | inteiro | episódios | C: episódios sem sucesso de recuperação observado até o fim da janela. |
| censored_fraction | número real | proporção 0–1 | C: episodes_censored / episodes_total; vazio se não há episódios. |
| initial_failures_without_success | inteiro | workflow runs | C: falhas antes do primeiro sucesso observado no workflow; não iniciam os episódios medidos. |
| eligible_releases | booleano true/false | sem unidade | B: releases_in_window >= 5. |
| eligible_runs | booleano true/false | sem unidade | C: runs_valid >= 50. |
| selected | booleano true/false | sem unidade | A: presença na lista de 300 repositórios selecionados após os filtros. |
| cfr_b_validation | texto | estado da validação | pending_independent_labels até revisão dos rótulos, consenso e avaliação da heurística. Rótulos assistidos não concluem a validação. |
| source_job_id | texto | UUID | Manifesto: identificador da coleta A que define a seleção e janela. |
| b_job_id | texto | UUID | Manifesto: identificador do processamento de releases, lead time e CFR (b). |
| c_job_id | texto | UUID | Manifesto: identificador do processamento de workflows e recuperação. |
