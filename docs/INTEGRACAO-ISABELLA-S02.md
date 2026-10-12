# Roteiro para Isabella — Sprint 2 / Issue #6

Objetivo: coletar a coorte final, reunir as métricas e entregar um dataset com dicionário. A parte de Leandro já fornece o cálculo de CFR (b); você pode executá-lo sobre arquivos locais e juntar o CSV resultante aos seus resultados.

**Atualização de 11/10/2026:** a seleção de 300 elegíveis foi concluída. A base no app é `Sprint 2 · 300 repositórios · 2025`, ID `1deaa513-2c06-4949-bd54-2c591b0eef12`. O pacote local `data/cohort-300-2025.zip` contém a lista, metadados, funil, decisões e novos templates de rotulação. A amostra-ouro sorteada dessa coorte está em `data/gold-standard-final-300-2025/` (60 projetos × 5 releases reais, semente 42).

Os 100 selecionados anteriores foram preservados. A coleta completa e os cálculos locais B/C estão concluídos para os 300 projetos. O dataset consolidado está em data/dataset-s02-final/dataset.csv e o pacote atualizado em data/entrega-isabella-s02.zip. Comece pela rotulação independente da nova amostra; depois gere o consenso e valide CFR (b). O pacote inclui métricas e documentação; os arquivos brutos volumosos continuam nas pastas persistentes de A.

## 1. Definir a base única

Combine uma única janela UTC para a equipe e preserve a seleção de A. Temos uma base local de 100 selecionados em 2025; a Sprint 2 pede pelo menos 300 repositórios elegíveis. Ampliar candidatos não garante 300 aprovados. Exporte também as decisões e o funil, para explicar exclusões e erros.

Não misture o consenso recebido com datas de 2024 com a coleta de 2025. Primeiro escolha a janela oficial e confira as tags e datas reais. A [auditoria](evidencias/cfr-b-reference-audit.csv) encontrou 89 datas divergentes e 211 releases não encontradas na API pelas tags informadas. Os rótulos antigos devem ser preservados para rastreabilidade; corrigir uma amostra exige revisar suas referências e refazer o consenso com os avaliadores.

## 2. Completar os dados em A

Retome a base salva em A para obter releases, commits e workflows completos. Os arquivos persistem em `data/jobs/ID/` e não expiram automaticamente. Token pode ser necessário para buscar o que falta; calcular B/C sobre dados locais completos não utiliza token.

Para cada release mantenha `tag_name`, `published_at`, `base_tag`, `has_previous_release`, `compare_error`, `commits` e, quando disponíveis, `name` e `body`. Cada commit precisa de SHA, data do autor e mensagem. O CSV de entrada B encapsula os commits em `commits_json`; use o exportador do app para preservar as aspas. Notas antigas ausentes permanecem vazias; não invente texto para preencher lacunas.

Guarde o inventário inteiro de releases da janela. A amostra de cinco por repositório serve para rotular e validar, não para calcular a frequência ou CFR de todo o período. Preserve todos os runs que servem a C. Erros de coleta devem continuar identificados, sem virar zeros.

## 3. Preparar uma amostra-ouro real, sem refazer chamadas

Para a amostra final, use `--require-comparisons` com `--job`: entram apenas projetos com pelo menos cinco releases que têm base anterior e comparação disponível. O manifesto de sorteio registra essa restrição e a quantidade de candidatos elegíveis. Os modelos anteriores permanecem preservados; a pasta final é `data/gold-standard-final-300-2025/`.

Após obter os dados locais, crie uma nova pasta para preservar os rótulos recebidos:

```powershell
node scripts/sample-gold-standard.mjs --job ID_DA_COLETA --n-repos 60 --n-releases 5 --seed 42 --out-dir data/gold-standard-real
```

O comando herda a janela de A, sorteia somente repositórios com pelo menos cinco releases disponíveis e gera templates vazios para cada avaliador. Não utiliza token nem rede no modo `--job`. Se faltarem repositórios, ele falha. `--demo` produz dados demonstrativos, que não servem à validação científica. Não use `--force` sobre os arquivos originais: ele sobrescreve amostra e rótulos.

Já deixei uma versão piloto pronta em `data/gold-standard-real-2025/`, com 300 releases reais e os três templates vazios. Ela foi gerada com a coleta de 100 selecionados e semente 42. Pode servir ao piloto; para a entrega final, confirme se a coorte ampliada exige novo sorteio. Essa pasta local não foi enviada ao GitHub.

Cada pessoa preenche seu próprio template sem copiar os demais. Registrem as evidências e discutam divergências para construir o consenso. Sigam [as instruções de concordância e consenso](PARTE-AMOSTRA-OURO.md) apontando os comandos para a nova pasta. Uma coorte ainda abaixo de 300 deve ser descrita como piloto.

Depois da rotulação, os comandos são:

```powershell
node scripts/calculate-agreement.mjs --data-dir data/gold-standard-real
node scripts/consolidate-consensus.mjs --data-dir data/gold-standard-real
```

## 4. Calcular e validar CFR (b)

```powershell
npm run cfr-b -- --job ID_DA_COLETA --consensus data/gold-standard-real/consensus.csv --output data/cfr-b/final --require-valid
```

O relatório só marca calibração completa quando todas as referências têm evidência correspondente. Confira `validation.json`, `heuristic-versions.csv` e `predictions.csv`. Se F1 ficar abaixo de 0,70, revisem falsos positivos/negativos e alterem a regra com testes. Mesmo acima do limiar, documentem que a escolha da versão foi feita na amostra de calibração; um teste independente exige uma amostra separada.

## 5. Juntar as métricas

Na interface, execute B e C sobre a mesma base de A. Exporte as métricas das duas partes. `data/cfr-b/final/cfr-b.csv` pode ser combinado com elas pela chave `repository`, normalizada em minúsculas, sempre na mesma janela. Não some percentuais nem trate valores vazios como zero. Valide que há uma única linha por repositório em cada arquivo e liste os repositórios que faltam em qualquer parte.

| Campo do CSV CFR (b) | Significado / tipo |
|---|---|
| `repository` | Identificador owner/repo, texto |
| `releases_total` | Releases publicadas na janela, inteiro |
| `releases_evaluated` | Denominador após censura e desconhecidos, inteiro |
| `releases_failed` | Releases com correção em até sete dias, inteiro |
| `releases_censored` | Últimos sete dias sem acompanhamento completo, inteiro |
| `releases_unknown` | Resultado indeterminado por comparação indisponível, inteiro |
| `cfr_b` | Proporção entre 0 e 1; vazio se denominador zero |
| `heuristic_version` | Regra usada, texto |

Na saída B do app, os contadores levam o prefixo `cfr_b_`: `cfr_b_releases_evaluated`, `cfr_b_releases_failed`, `cfr_b_releases_censored`, `cfr_b_releases_unknown`, `cfr_b_heuristic_version`. CFR (a) continua sendo `cfr_ci`, a medida baseada em workflows. Não confunda as duas.

Entregue junto ao CSV final: janela, regras de A, versão da heurística, relatório de validação, lista de erros/pendências, funil, dicionário de colunas e comandos para reprodução. Dados brutos são grandes e podem continuar na pasta persistente; não é necessário enviá-los ao GitHub para calcular localmente.

## Versão bem simples

A monta a caixa com os dados. B calcula a velocidade das versões. C observa as falhas e os consertos. Seu trabalho é conferir que os três olharam para os mesmos projetos e datas, juntar os resultados e explicar o significado de cada coluna. Se falta uma peça, marque que falta; não coloque zero para fingir que a caixa está completa.
