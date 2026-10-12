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
