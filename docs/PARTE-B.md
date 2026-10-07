# DORA — Sprint 1 / Pessoa B (Luís Henrique)

Coleta de releases e tags, comparação paginada de commits entre releases consecutivas e cálculo das métricas DORA de **Deployment Frequency (RQ 01)** e **Lead Time for Changes (RQ 02 — variantes a e b)**. Issue referenciada: [#2](https://github.com/alencarleandro/DORA/issues/2).

Desenvolvido em Node.js (ES Modules nativo), sem bibliotecas externas de acesso ao GitHub. Token lido apenas de `GITHUB_TOKEN`; cache e saídas gravados na pasta de dados fora do Git.

---

## 1. Execução Rápida

Coletar releases e calcular lead time para os repositórios selecionados:

```powershell
node scripts/collect-releases.mjs --csv examples/repositories.csv --start 2024-01-01 --end 2024-12-31 --output data/releases-pilot
```

Parâmetros suportados:
* `--csv`: caminho para o CSV de repositórios (`full_name,default_branch`). Se omitido, busca em `config.outputDir/repositories.csv` ou `examples/repositories.csv`.
* `--start` e `--end`: datas da janela em formato `AAAA-MM-DD` (UTC inclusivo). Caso omitidos, utiliza as datas configuradas em `config.json`.
* `--limit`: limita o processamento aos primeiros $N$ repositórios (ideal para testes piloto).
* `--output`: pasta de saída para arquivos gerados e cache. Padrão: `data/releases-2024`.

---

## 2. Contrato e Integração com as Partes A e C

* **Entrada (Parte A):** Consome a lista de repositórios gerada pela seleção de A (`repositories.csv`), contendo `full_name` e `default_branch`.
* **Critério de Inclusão da Disciplina:** A disciplina exige pelo menos **5 releases** e **50 workflow runs** válidos dentro da janela. Este módulo avalia a condição de $\ge 5$ releases na janela (`eligible_releases`).
* **Cache e Rate Limit (Parte C):** Utiliza a mesma camada `lib/github.mjs` com cache SHA-256 em disco, retries automáticos com backoff exponencial (1 a 64s) e tratamento limpo de rate limit (`RATE_LIMIT_WAIT`).

---

## 3. Definições Operacionais e Armadilhas Contornadas

### Deployment Frequency (RQ 01)
* **Definição:** número de releases publicadas no default branch dentro da janela dividido pelo número de semanas da janela ($\approx 52{,}1$).
* **Filtros:** apenas releases com `draft = false` e `prerelease = false`.

### Lead Time for Changes (RQ 02)
Para cada release $R$ publicada dentro da janela, seus commits são obtidos comparando-a com a release imediatamente anterior na linha do tempo (`/repos/{owner}/{repo}/compare/{base}...{head}`):
* **Variante (a) Por Release:** $R.\text{published\_at} - \text{data do commit mais antigo}$. O valor do repositório é a **mediana** entre suas releases avaliadas.
* **Variante (b) Por Commit:** para cada commit $c \in R$, $R.\text{published\_at} - c.\text{author\_date}$. O valor do repositório é a **mediana de todos os commits de todas as suas releases**.
* **Data do Commit:** utiliza obrigatoriamente `commit.author.date` (quando a mudança foi escrita).
* **Release Anterior fora da Janela:** a release anterior pode ter sido publicada antes da janela (ex.: em 2023). O coletor identifica e preserva essa release cronológica para servir de base ao compare da primeira release da janela.
* **Primeira Release da História:** se $R$ for a primeiríssima release do repositório (sem nenhuma release anterior), não há base de comparação. $R$ é descartada do cálculo de lead time e registrada em `releases_ignored_no_previous`.
* **Limite de 250 commits no Compare:** a API REST do GitHub limita a resposta padrão a 250 commits. O módulo implementa paginação ativa através do parâmetro `per_page=100` e do cabeçalho `Link: rel="next"`, coletando todos os commits mesmo em releases volumosas.
* **Tratamento de 404 em Compare:** conforme a Seção 11 do README, quando uma tag de release foi reescrita ou apagada, o compare retorna 404. O erro é capturado sem abortar a execução, a release é ignorada no lead time e contabilizada em `releases_ignored_compare_error`.

---

## 4. Dicionário de Saídas da Parte B

Todos os arquivos CSV são exportados em **UTF-8 com BOM**, com aspas devidamente escapadas e proteção contra injeção de fórmulas em planilhas (`'`, `=`, `+`, `@`).

### `lead_time_metrics.csv`
| Coluna | Tipo / Unidade | Descrição |
|---|---|---|
| `repository` | texto | `owner/repo` |
| `default_branch` | texto | Branch principal |
| `releases_in_window` | inteiro | Total de releases publicadas na janela |
| `releases_evaluated` | inteiro | Releases com compare e commits válidos |
| `releases_ignored` | inteiro | Total de releases não avaliadas no lead time |
| `releases_ignored_no_previous` | inteiro | Releases que eram a 1ª da história |
| `releases_ignored_compare_error` | inteiro | Releases cujo compare retornou 404 |
| `releases_ignored_no_commits` | inteiro | Releases sem commits novos na comparação |
| `commits_total` | inteiro | Total de commits analisados |
| `deployment_frequency` | fração | Releases na janela por semana |
| `lead_time_release_median_hours` | horas | Mediana da variante (a) por release |
| `lead_time_release_iqr_hours` | horas | IQR da variante (a) por release |
| `lead_time_release_median_days` | dias | Mediana da variante (a) em dias |
| `lead_time_release_iqr_days` | dias | IQR da variante (a) em dias |
| `lead_time_commit_median_hours` | horas | Mediana da variante (b) por commit |
| `lead_time_commit_iqr_hours` | horas | IQR da variante (b) por commit |
| `lead_time_commit_median_days` | dias | Mediana da variante (b) em dias |
| `lead_time_commit_iqr_days` | dias | IQR da variante (b) em dias |
| `eligible_releases` | booleano | `true` se $\ge 5$ releases na janela |
| `error` | texto | Mensagem de erro em caso de falha de coleta |

### `releases.csv`
| Coluna | Descrição |
|---|---|
| `repository` | `owner/repo` |
| `tag_name` | Nome da tag da release |
| `published_at` | Data ISO 8601 da publicação da release |
| `base_tag` | Tag da release anterior usada no compare |
| `has_previous_release` | `true` se havia release anterior |
| `commits_count` | Total de commits entre as duas releases |
| `lead_time_hours` | Lead time da release em horas (variante a) |
| `lead_time_days` | Lead time da release em dias (variante a) |
| `compare_error` | Código de erro caso o compare tenha falhado |

### `commits.csv`
| Coluna | Descrição |
|---|---|
| `repository` | `owner/repo` |
| `release_tag` | Tag da release de destino |
| `release_published_at` | Data ISO 8601 da release |
| `commit_sha` | Hash SHA do commit |
| `author_date` | Data de autoria do commit (`commit.author.date`) |
| `lead_time_hours` | Lead time individual do commit em horas |
| `lead_time_days` | Lead time individual do commit em dias |

---

## 5. Testes e Cobertura

Os testes unitários e de integração com fixtures simuladas são executados com o test runner nativo do Node.js:

```powershell
npm test
```

A cobertura de testes cumpre com folga a exigência da disciplina ($\ge 80\%$):
* `lib/metrics.mjs`: **100% de linhas** e **98,10% de branches**.
* `lib/releases.mjs`: **100% de linhas** e **86,11% de branches**.
