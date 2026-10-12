# Roteiro para Isabella — Sprint 2 / Issue #6

A coleta A e os cálculos B/C estão concluídos para **300 projetos**, janela UTC **2025-01-01 a 2025-12-31**. A base de origem no app é `Sprint 2 · 300 repositórios · 2025`, ID `1deaa513-2c06-4949-bd54-2c591b0eef12`. Os 100 selecionados anteriores foram preservados na história da coleta.

A entrega está nas pastas versionadas. Siga o [guia de organização e responsabilidades](ESTRUTURA-DADOS-S02.md), comum aos três integrantes.

## 1. Base única e fontes

Use `data/dataset-s02-final/dataset.csv`, com uma linha por repositório. As entradas para reprodução são:

- `selecao/repositories.csv`: lista de 300 projetos.
- `selecao/metadata.csv`, `decisions.csv`, `funnel.csv` e `queries.csv`: seleção e rastreabilidade de A.
- `metricas/metrics-b.csv`: releases, frequência, lead time e CFR (b).
- `metricas/metrics-c.csv`: workflows, CFR de CI e recuperação.
- `metricas/comparison-quality.json`: comparações indisponíveis.

Todas essas entradas ficam dentro de `data/dataset-s02-final/`. Os metadados incluem candidatos descartados; a lista de selecionados define a coorte. As duas partes usam os mesmos projetos e branches. Campos vazios não são zeros.

Não misture o consenso antigo de 2024 com a base de 2025. A [auditoria antiga](evidencias/cfr-b-reference-audit.csv) encontrou 89 datas divergentes e 211 tags de releases não encontradas. Os arquivos antigos em `data/gold-standard/` permanecem como histórico.

## 2. Rótulos da amostra final

Use a amostra já sorteada em `data/gold-standard-final-300-2025/`: **60 projetos × 5 releases reais**, semente 42. O manifesto registra 299 candidatos sorteáveis com comparação disponível na coorte de 300.

Cada integrante preenche o arquivo `rotulos-<pessoa>.csv` na raiz dessa pasta. Manter referências, cabeçalhos e ordem da amostra. A avaliação é feita sem consultar as respostas dos colegas nem previsões da heurística antes de concluir os próprios rótulos.

Isabella confirmou a revisão dos 300 rótulos assistidos por IA. O resultado está em `rotulos-isabella.csv`; as evidências, decisões, rascunho e registro de revisão ficam em `revisao-isabella/`. O uso de IA está explícito e precisa ser relatado na metodologia. Consulte [a entrega da #6](ISSUE-6-S02.md).

Não sortear novamente nem usar `--force` sobre esses arquivos. Para outra coorte ou janela, crie uma nova pasta e registre a nova origem. No sorteio de releases reais a partir de dados locais, use `--job` e `--require-comparisons`; dados gerados com `--demo` não servem à validação científica.

## 3. Concordância, consenso e CFR (b)

Após os três arquivos individuais completos, Luís executa:

```powershell
node scripts/calculate-agreement.mjs --data-dir data/gold-standard-final-300-2025
node scripts/consolidate-consensus.mjs --data-dir data/gold-standard-final-300-2025
```

Depois, Leandro valida a heurística frente ao novo `consensus.csv`, seguindo o [guia da equipe](ESTRUTURA-DADOS-S02.md#fluxo-para-a-equipe). Os relatórios novos ficam em `data/dataset-s02-final/validacao/cfr-b/`, quando forem gerados. A avaliação exige os dados brutos de releases e commits da coleta A, que não estão neste checkout.

O relatório só comprova calibração completa quando as referências correspondem à evidência. Se F1 ficar abaixo de 0,70, revisar falsos positivos/negativos e as versões da regra. Escolher uma versão na própria amostra é calibração; um teste independente exige uma amostra separada.

`cfr_ci` e `cfr_b` medem proxies distintos. Os contadores de CFR (b) têm prefixo `cfr_b_`. Não somar percentuais, preencher ausências com zero ou usar somente as cinco releases sorteadas para calcular métricas do período inteiro.

## 4. Reproduzir a consolidação

Na raiz do projeto, sem token e usando os exports versionados:

```powershell
node scripts/assemble-isabella-dataset.mjs
```

O comando confere os 300 projetos e gera o CSV, o dicionário completo das 55 colunas e `validacao/quality-report.json`. Ele verifica a igualdade com os valores entregues e não recalcula os eventos brutos.

O manifesto registra janela, IDs e hashes. O dicionário fica em `dictionary.csv` e [docs/DATA-DICTIONARY.md](DATA-DICTIONARY.md). O histórico dos testes está em `validacao/tests.txt`. Comparações indisponíveis, censura e um lead time negativo já presente continuam registrados.

Para finalizar novamente uma coleta completa disponível em `data/jobs`, use `node scripts/finalize-isabella.mjs ID_DA_COLETA`. O finalizador exporta para `selecao/` e `metricas/`, valida a base e preserva a amostra e os arquivos de rótulos existentes. Não gera ZIP.

## 5. Entrega no Git

Versionar os CSVs, manifestos, dicionário, relatórios e documentação nas pastas definidas. Cache, dados brutos e credenciais continuam locais. Cada commit deve referenciar a issue do responsável.

A base e os rótulos de Isabella estão preparados; consenso e validação de CFR (b) dependem das próximas entregas da equipe. Não declarar F1 validado nem encerrar essas pendências apenas pela existência do dataset.
