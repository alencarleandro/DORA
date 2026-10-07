# A → B → C no laboratório web

Abra o [laboratório público](https://arsenal.dev.br/dora/) e execute uma parte por vez nas abas **A · Seleção**, **B · Releases** e **C · Workflows**. Informe as datas oficiais do professor: o app não preenche uma janela presumida. Escolha buscar candidatos no GitHub ou enviar um CSV `full_name,default_branch` (branch opcional, conferido com a API). O CSV é tratado como lista de candidatos, mesmo quando foi exportado por uma coleta anterior: os filtros são verificados novamente na nova fotografia.

Na busca, o mínimo de estrelas é ajustável; forks e arquivados são excluídos. No CSV, os nomes fornecidos definem a lista, sem filtro adicional de popularidade. Ajuste o limite de candidatos (até 1.000) e a meta da amostra (100 para Sprint 1). O orçamento inicial de 300 candidatos não garante 100 elegíveis. Se a amostra ficar abaixo da meta, crie outra execução com mais candidatos; o app informa **amostra insuficiente**, sem completar artificialmente o lote.

1. **A — seleção e metadados:** reutiliza `lib/selection.mjs` para descobrir candidatos, coletar metadados e verificar Actions → ≥ 5 releases → ≥ 50 runs válidos. Os primeiros elegíveis, na ordem da busca ou do CSV, compõem a amostra. Erros e pendências aparecem separados de exclusões no funil.
2. **B — releases e commits:** selecione uma execução de A no campo **Repositórios para esta parte**, clique **Usar amostra em B** no resultado de A ou envie um CSV. Usar A preserva a janela e o default branch e reaproveita seu cache. Coleta releases principais e tags, compara commits com a release anterior (inclusive fora da janela), calcula frequência por semana e lead time por release e por commit. Uma comparação indisponível gera erro retomável; a primeira release histórica sem base é ignorada somente no lead time.
3. **C — workflows:** clique **Usar amostra em C**, selecione uma amostra de A ou envie um CSV. Usar A preserva seus nomes, default branches e janela. Reutiliza a coleta mensal com subdivisão, calcula CFR de CI, mediana/IQR da recuperação e censura. As consultas de seleção e métricas compartilham o cache para evitar baixar novamente a evidência de A.

A não executa comparações de commits ou calcula as métricas finais de B/C: consulta releases e runs apenas para validar a amostra. B não executa A/C; C não executa A/B. Cada parte possui seu histórico, pausa e retomada.

O painel exibe os resultados da parte executada, progresso, erros e logs. Os botões de exportação mostram apenas as saídas aplicáveis àquela parte: **Amostra A → B/C**, **Metadados A**, **Decisões A**, **Buscas A**, **Releases B**, **Commits B**, **Tags B**, **Runs**, **Episódios**, **Métricas** e **Funil**. Tags são inventário atual de nomes/SHAs, não evidência de deploy datado dentro da janela. Os CSVs de B e C incluem os repositórios concluídos em cada parte. A exporta a amostra, metadados, decisões, buscas e funil.

Dados e respostas paginadas ficam em `data/jobs/<id>/`; a configuração e a fronteira temporal da busca ficam fixadas no job. **Pausar** e **Retomar do cache** preservam projetos concluídos. O reinício do servidor converte execuções em andamento em pausadas. Rate limit, erros de rede e 5xx usam o cliente compartilhado. Um token opcional pode ser informado no formulário ou em `GITHUB_TOKEN`; nunca é salvo no job nem nos CSVs. Não é necessário banco de dados para este fluxo.

Na aba **C · Workflows**, escolha **Coletar workflows do GitHub** ou **Importar runs em CSV**. C e B, quando recebem CSV manual, não atestam sozinhas a amostra completa de A.

## Execuções pelo terminal

Substitua as datas abaixo pelas datas oficiais; os valores são um exemplo, não uma confirmação da janela:

```powershell
npm run pipeline -- --mode selection --start 2025-10-01 --end 2026-09-30 --candidate-limit 300 --sample-size 100
# Depois, use repositories.csv exportado por A:
npm run pipeline -- --mode releases --csv repositories.csv --start 2025-10-01 --end 2026-09-30
npm run pipeline -- --mode collect --csv repositories.csv --start 2025-10-01 --end 2026-09-30
```

Para partir de candidatos em CSV, acrescente `--csv candidatos.csv`. Para continuar uma execução: `npm run pipeline -- --resume ID`. O terminal exporta os CSVs correspondentes à parte executada em `data/jobs/<id>/exports`. Status parcial, pausado, falha ou amostra insuficiente retornam código de saída 1. Os scripts individuais de A e B seguem disponíveis. O modo `--mode integrated` permanece compatível no CLI e no histórico antigo, mas o formulário web executa somente a parte escolhida.

## Validação e publicação

`npm test` inclui testes de integração com a API simulada: filtros de A, amostra comum, branch/janela, release anterior fora da janela, exportações, erros, retomada, pausa, rate limit e insuficiência. Isso verifica o software, não comprova a coleta real de 100 projetos. A disponibilidade histórica de runs continua sendo uma limitação da API.

Depois de atualizar o backend, use **Reiniciar app** no cartão **DORA** do Arsenal e atualize a página. O laboratório é público, sem chave de acesso.
