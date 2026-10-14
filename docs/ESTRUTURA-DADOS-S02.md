# Organização dos dados - Sprint 2

Todos usam a coorte de **300 repositórios**, janela UTC **2025-01-01 a 2025-12-31**, e a mesma amostra-ouro de **60 projetos × 5 releases**.

```text
data/
├── README.md
├── dataset-s02-final/
│   ├── README.md
│   ├── dataset.csv                  # resultado: 300 linhas, 55 colunas
│   ├── dictionary.csv               # definição de cada coluna
│   ├── manifest.json                # janela, jobs e hashes das fontes
│   ├── selecao/                     # origem A
│   │   ├── repositories.csv         # lista dos 300 selecionados
│   │   ├── metadata.csv             # metadados dos candidatos
│   │   ├── decisions.csv            # decisões de inclusão/exclusão
│   │   ├── funnel.csv               # contagens do funil
│   │   └── queries.csv              # consultas que formaram a seleção
│   ├── metricas/                    # entradas para consolidação
│   │   ├── metrics-b.csv            # releases, frequência, lead time e CFR b
│   │   ├── metrics-c.csv            # runs, CFR CI e recuperação
│   │   └── comparison-quality.json  # comparações indisponíveis
│   └── validacao/
│       ├── quality-report.json      # consistência dos CSVs e avisos
│       └── tests.txt                # log da suíte executada
├── gold-standard-final-300-2025/
│   ├── README.md
│   ├── gold_standard_sample.csv     # amostra comum; não editar as referências
│   ├── sampling-manifest.json       # origem, seed e população sorteável
│   ├── rotulos-isabella.csv         # arquivo oficial de Isabella, revisado
│   ├── rotulos-luis.csv             # arquivo oficial de Luís
│   ├── rotulos-leandro.csv          # arquivo oficial de Leandro
│   └── revisao-isabella/            # rastreabilidade da análise assistida
│       ├── rotulos-isabella-assistidos.csv
│       ├── evidencias-isabella.csv
│       ├── decisoes.json
│       ├── analise-isabella.json
│       └── revisao-isabella.json
└── gold-standard/                  # amostra antiga; histórico preservado
```

`data/jobs/` e `data/issue-6-evidence/` são pastas locais ignoradas pelo Git. A primeira guarda releases, commits, runs e estado das execuções; a segunda guarda as fotografias públicas consultadas para a análise assistida. Não colocar token nesses diretórios nem versionar credenciais.

## Qual arquivo cada pessoa usa

| Pessoa / issue | Lê | Atualiza | Próximo entregável |
|---|---|---|---|
| Isabella / #6 | seleção e métricas B/C; amostra e suas evidências | `rotulos-isabella.csv`, dataset, dicionário e relatório de qualidade | base consolidada e rastreabilidade dos seus rótulos |
| Luís / #4 | amostra comum; seus rótulos; depois, os três arquivos concluídos | `rotulos-luis.csv`; relatórios de concordância e consenso | Kappa das três dimensões e consenso documentado |
| Leandro / #5 | amostra comum; seus rótulos; depois, consenso e dados brutos de releases | `rotulos-leandro.csv`; resultados de avaliação de CFR (b) | precisão, recall, F1 e versão da heurística |

## Fluxo

1. Atualizar o checkout da `main` antes de começar. Usar sempre a amostra em `gold-standard-final-300-2025/`.
2. Concluir cada `rotulos-<pessoa>.csv`. Tipo e entrega real são por repositório, repetidos nas cinco linhas; corretiva é por release. Registrar justificativas em `notes`.
3. Depois dos três arquivos completos, executar na raiz do projeto:

   ```powershell
   node scripts/calculate-agreement.mjs --data-dir data/gold-standard-final-300-2025
   node scripts/consolidate-consensus.mjs --data-dir data/gold-standard-final-300-2025
   ```

   Os relatórios e `consensus.csv` são gerados na própria pasta da amostra, após essa etapa. Não usar o consenso antigo de `data/gold-standard/` com a base de 2025.

4. Valida a heurística contra esse consenso. Os novos relatórios devem ficar em `data/dataset-s02-final/validacao/cfr-b/`, criada pelo comando quando houver resultado real:

   ```powershell
   npm run cfr-b -- --job 1deaa513-2c06-4949-bd54-2c591b0eef12 --consensus data/gold-standard-final-300-2025/consensus.csv --output data/dataset-s02-final/validacao/cfr-b --require-valid
   ```

   Esse passo exige os dados brutos locais. A pasta `data/jobs` não é distribuída pelo Git. Se ela estiver ausente, é necessário obter a coleta original antes de executar o comando.

5. Conferir e incorporar a versão validada das métricas à entrega, mantendo a mesma coorte e janela, e atualizar o estado de validação com o relatório correspondente. O montador atual verifica igualdade com o dataset entregue; uma mudança real de métricas deve ser revisada como nova versão, não mascarada para passar nessa comparação. Não alterar `cfr_b_validation` apenas porque um arquivo de rótulos foi preenchido.
6. Cada pessoa registra a alteração em um commit referenciando sua issue. Na `main`, atualizar com rebase antes de publicar; conflitos devem ser resolvidos antes do push.

## Reprodução dos artefatos atuais

Sem token e sem os dados brutos:

```powershell
node scripts/assemble-isabella-dataset.mjs
```

Esse comando lê `selecao/` e `metricas/`, confere os 300 projetos, gera `dataset.csv`, `dictionary.csv` e `validacao/quality-report.json`, e atualiza o manifesto. Não recalcula métricas a partir dos eventos.

Para reaplicar o rascunho:

```powershell
node scripts/build-isabella-labels.mjs
```

Ele escreve somente os artefatos de análise em `revisao-isabella/`. Não sobrescreve `rotulos-isabella.csv` nem outros arquivos. O registro de revisão só permanece confirmado se os hashes do rascunho e do arquivo final coincidirem com os aceitos.

Para finalizar novamente uma coleta A/B/C disponível em `data/jobs`:

```powershell
node scripts/finalize-isabella.mjs 1deaa513-2c06-4949-bd54-2c591b0eef12
```

O finalizador exporta para estas mesmas pastas, valida o dataset e preserva a amostra e os rótulos existentes. Não gera arquivo compactado.

## Regras de manutenção

- `dataset.csv` é o resultado consolidado; `metricas/` e `selecao/` são suas entradas. Não calcular métricas usando apenas as cinco releases da amostra-ouro.
- `metadata.csv` pode incluir candidatos descartados. A autoridade para os 300 projetos é `selecao/repositories.csv`.
- Manter vazios, censura e erros explícitos. Não substituir ausência de medição por zero.
- Se a janela ou coorte mudar, criar uma nova pasta e sortear uma nova amostra com manifesto. Não reaproveitar rótulos sem conferir as referências.
- Não guardar cópias da mesma entrega em pastas de empacotamento. As fontes de A, métricas e documentação têm os locais definidos acima.
- Relatórios novos de validação ficam em `validacao/`; não inventar relatórios para etapas que ainda não ocorreram.
