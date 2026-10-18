# Validação da issue #8

Data: 18/10/2026. Entrada: `data/dataset-s02-final/dataset.csv`, 300 projetos, janela UTC de 2025.

## Análise e testes novos

- **26 testes Python passaram**, zero falhas. Saída em [validation-python.txt](validation-python.txt). Foram verificados Spearman positivo/negativo/constante, pares insuficientes, permutação bilateral reproduzível, zero versus ausente, quartis com empates, cortes fixos antes das exclusões, grupos vazios e a alternativa Mann–Whitney.
- Resultados conhecidos: Kruskal–Wallis H=7,2 e ε²=0,9 para três grupos sem empates; H=5 e ε²=1 no controle com empates; Mann–Whitney U=0, p bilateral=0,1 e δ=−1, invertendo o sinal ao trocar os grupos; Holm para [0,01; 0,04; 0,03] retorna [0,03; 0,06; 0,06].
- A coorte real foi conferida por fórmulas diretas adicionais nos testes: soma dos postos médios por grupo, correção de empates de Kruskal–Wallis e Holm por ordenação e máximo acumulado. Os resultados coincidiram com as bibliotecas, tolerância absoluta de 1e−10 para H.
- Controles reais: frequência, LT por release e ambos CFR têm n=300; LT por commit tem n=299; recuperação tem n=258. O negativo de `tw93/Mole` é excluído apenas de LT por commit. Os 42 ausentes de recuperação permanecem nas demais medidas.
- Foram geradas duas correlações e 18 testes RQ06 estimáveis, com oito rejeições após Holm a 5%. Nenhuma observação foi descartada por significância.
- Cinco figuras, cada uma em PNG e SVG, foram inspecionadas visualmente. Rótulos, unidades, n, limites e escalas estão explícitos. Os eixos de medidas não negativas começam em zero; os zeros permanecem visíveis em symlog. O CFR por releases aparece como exploratório.
- Python 3.12.14; NumPy 2.5.4, pandas 3.0.6, SciPy 1.18.1, statsmodels 0.15.0, Matplotlib 3.11.2 e pytest 9.1.1. As dependências diretas estão fixadas em `scripts/requirements-rq05-rq06.txt`.
- A análise não consultou a rede, não usou token e não acessou históricos de jobs. Houve instalação das bibliotecas em uma pasta temporária local ignorada pelo Git.

Execução da análise:

```powershell
python scripts/analyze-rq05-rq06.py
python -m pytest tests/test_rq05_rq06.py -q
```

Neste ambiente, o interpretador usado foi o Python 3.12 do runtime do Codex, com `PYTHONPATH` apontando para `tmp/rq05-rq06-deps`. Por uma restrição de criação de pastas temporárias do sandbox no Windows, os testes foram executados com `--basetemp tmp/rq05-rq06-tests/run3`, sob o workspace. Essa localização não interfere nos dados ou cálculos; em um ambiente Python normal os comandos acima são suficientes.

## Integridade

SHA-256 do dataset antes/depois: `c109078a7ba40e3c982749a5cdb638b700dd1d6bbe21d0e868287ae9115a8fc5`.

O hash coincide com o registrado na análise descritiva da issue #7. O script verifica os bytes da entrada antes e depois da geração; o teste da coorte também verifica a preservação. [manifest.json](manifest.json) registra hash do script, versões, plano, cortes e denominadores. O timestamp e o caminho absoluto dependem da máquina; os cálculos usam sementes fixas.

## Suíte Node existente: pendência

`npm test`: **123 passaram, uma falha, total 124**. A cobertura das bibliotecas medidas foi de 100% de linhas e funções e 96,19% de branches. A saída integral está em [validation-node.txt](validation-node.txt).

Falha: `tests/git-evidence.test.mjs`, teste “histórico Git recupera commits entre tags, datas do autor e tags anotadas”, linha 28. O teste espera que o clone parcial não contenha objetos `tree` ou `blob`, mas o Git local retornou `tree`, `commit`, `tag`, `commit`. Ambiente: Git 2.53.0.windows.1. O teste e as bibliotecas `lib/git-evidence.mjs` e `lib/raw-audit.mjs` não foram alterados nesta entrega. A análise RQ05/RQ06 usa somente o CSV e não depende de clonagem Git.

A causa dessa falha no ambiente não foi corrigida na issue #8. A suíte geral não está totalmente verde e essa pendência precisa acompanhar a revisão. O novo job Python de CI foi configurado, mas sua execução remota ainda não foi observada.

Esta validação confirma os cálculos e a integridade da entrega local. Não confirma causalidade, representatividade de todos os projetos open source ou validade final de CFR (b), que segue `pending_independent_labels`.
