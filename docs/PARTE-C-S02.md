# Leandro — Sprint 2 / Issue #5

**Coleta final de 300 projetos:** A, B e C foram concluídos sobre a janela 2025-01-01 a 2025-12-31. Dataset local: data/dataset-s02-final/dataset.csv. Pacote para Isabella: data/entrega-isabella-s02.zip. A amostra final está em data/gold-standard-final-300-2025 e usa apenas releases com comparação disponível; os rótulos independentes e a validação F1 continuam pendentes. As medições piloto descritas abaixo são registros da etapa anterior.

Entrega de código para [CFR (b), issue #5](https://github.com/alencarleandro/DORA/issues/5): heurística de release corretiva, cálculo por repositório, auditoria e avaliação contra o consenso. A validação científica continua pendente da correção das referências da amostra-ouro.

## Executar com a coleta que já temos

Na raiz do projeto, execute:

```powershell
npm run cfr-b -- --job 017950ac-806f-45b7-bc0d-eb9a9ae87605 --output data/cfr-b/local-2025
```

É processamento local, sem token e sem rede. A janela é herdada da coleta. Somente arquivos de releases existentes são usados; um repositório sem arquivo não ganha resultado zero. Também é possível usar o CSV de entrada B exportado por A:

```powershell
npm run cfr-b -- --csv releases-data.csv --start 2025-01-01 --end 2025-12-31 --output data/cfr-b/importado
```

B no app agora inclui CFR (b) no CSV de métricas e na tabela, identificado como exploratório. Execuções antigas precisam ser recalculadas em uma nova execução B. O backend precisa carregar esta versão do código para exibir a coluna; editar o repositório não atualiza automaticamente a publicação.

## Regra implementada

Uma release publicada na janela é considerada falha quando alguma release corretiva posterior aparece em até **sete dias**, inclusive. Releases nos últimos sete dias da janela são censuradas e ficam fora do denominador. Uma comparação indisponível pode tornar o resultado desconhecido; desconhecidos também ficam fora do denominador. Drafts e prereleases são excluídos.

`CFR b = releases_failed / releases_evaluated`. Sem releases avaliáveis, o resultado é vazio/null, e não zero. O cálculo exige o inventário completo de releases da janela, por repositório. Cinco releases sorteadas para rotulação não substituem esse inventário. Trata-se de uma aproximação baseada em releases, não de uma medida direta de falhas em produção.

São comparadas três versões:

| Versão | Sinal de correção |
|---|---|
| `patch-v1` | Mesmo major/minor e incremento do patch SemVer |
| `patch-or-fix-v2` | Patch, mensagem de commit corretiva ou notas corretivas |
| `fix-majority-v3` | Pelo menos metade dos commits corretivos, ou notas corretivas |

As palavras consideradas são `fix`, `fixes`, `fixed`, `bugfix`, `hotfix`, `revert`, `reverts`, `reverted` e `regression`. Mensagens convencionais iniciadas por docs/style/test/chore e menções a typo/spelling/documentation only são descartadas. A regra é textual e em inglês; a avaliação humana é necessária para medir seus erros. A versão padrão é `fix-majority-v3`, provisória até a calibração completa. O comando permite `--heuristic patch-v1` ou outra versão para reproduzir uma comparação.

## Arquivos de saída

| Arquivo | Uso |
|---|---|
| `cfr-b.csv` | Métricas por repositório para Isabella integrar |
| `cfr-b-episodes.csv` | Release, resultado, tag corretiva e intervalo em horas |
| `reference-audit.csv` | Identidade e datas das referências confrontadas com evidência |
| `heuristic-versions.csv` | TP/FP/FN/TN, precisão, recall e F1 por versão |
| `predictions.csv` | Previsão e sinais utilizados, para revisar erros |
| `validation.json` / `REPORT.md` | Cobertura, situação e limites da avaliação |

O consenso usa `repository`, `release_tag`, `release_published_at`, `consensus_is_corrective` (`sim`/`nao`). Evidência JSON usa `repository`, `tag_name`, `published_at`, `base_tag`, `commits[].message` e, opcionalmente, `name`/`body`. `compare_error` impede tratar uma comparação incompleta como negativa. Dados explicitamente `synthetic_demo` não entram na avaliação.

F1 é calculado somente para referências com tag e data correspondentes e evidência disponível. Escolher a melhor versão no mesmo consenso é **calibração**, não avaliação independente. Um relatório parcial não comprova o requisito F1 ≥ 0,70. Use `--require-valid` para retornar código de saída 2 quando a referência estiver incompleta ou o limiar não for alcançado; os relatórios são preservados.

## Auditoria realizada em 11/10/2026

Primeiro, o cache persistente da coleta A permitiu consultar 11.981 registros de releases, sem rede: 42 referências tinham datas divergentes e 258 não tinham evidência local. Depois, usando o token fornecido somente em memória, conferimos na API as referências restantes. O resultado final das 300 linhas foi **89 datas divergentes e 211 releases não encontradas pela API nas tags informadas**. Nenhuma linha pôde entrar na avaliação. Uma release não encontrada não equivale a um rótulo humano negativo; sua referência precisa ser corrigida ou substituída.

Exemplo: [facebook/docusaurus v1.1.0](https://github.com/facebook/docusaurus/releases/tag/v1.1.0) está registrada no cache GitHub com publicação em `2018-05-21T15:40:09Z`; o consenso informa `2024-03-15T12:00:00Z`. A API também confirmou que [cli/cli v1.1.0](https://github.com/cli/cli/releases/tag/v1.1.0) foi publicada em `2020-10-06T13:13:29Z`, enquanto a referência informa 2024. Consulte a [auditoria preservada](evidencias/cfr-b-reference-audit.csv).

O gerador anterior preenchia slots simulados quando não obtinha releases. Agora ele falha explicitamente no modo normal, identifica simulações em `--demo` e aceita a coleta local com `--job`. Os rótulos existentes de todos os avaliadores foram preservados. A implementação não substitui a rotulação manual independente prevista na issue.

No cálculo exploratório, foram reutilizados os 99 arquivos locais de releases disponíveis em 2025. Isso não equivale à coorte final de pelo menos 300 repositórios da Sprint 2, nem à conclusão de todas as coletas de workflows.

Uma nova amostra piloto com 300 releases reais de 60 repositórios foi gerada em `data/gold-standard-real-2025/`, com semente 42, junto a três templates vazios para rotulação. Ela usa a base local de 100 selecionados e permanece local. Para a coleta final ampliada, a equipe deve confirmar se precisa sortear novamente a amostra.

## Explicando como para uma criança

Imagine que cada release é uma versão nova de um brinquedo. Se logo depois, em até sete dias, sai outra versão dizendo que consertou um defeito, marcamos a versão anterior como possível problema. Contamos quantas versões tiveram esse sinal e dividimos pelas versões que conseguimos acompanhar.

Se o acompanhamento termina amanhã, não podemos dizer se a versão de hoje precisará de conserto nos próximos sete dias. Ela fica de fora da conta. E, se a lista de referência traz a data errada, precisamos corrigir a lista antes de dizer que nosso detector acertou.

Para o próximo passo de Isabella, veja [o roteiro de integração](INTEGRACAO-ISABELLA-S02.md).
