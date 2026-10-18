# Validação da issue #7

Data: 18/10/2026.

- `npm test`: **124 testes passaram, zero falhas**. Saída em `validation-tests.txt`.
- Testes novos em `tests/descriptive.test.mjs`: interpolação de quartis, zero versus ausente, limites mensais em ano comum/bissexto, C1 completa/parcial, censura total, negativos, taxas fora de domínio, consistência com contagens, duplicatas, mistura de janelas e exportação sem rede.
- Execução real: 300 projetos processados; 258 com quatro dimensões da C1; 42 parciais; um valor inválido sinalizado.
- Conferência independente com Python `csv`, `statistics.quantiles(method="inclusive")` e `statistics.median`: n, Q1, mediana, Q3 e IQR das sete medidas coincidiram com os resultados JavaScript. Os 300 escores C1 completos/disponíveis também coincidiram.
- Alinhamento com RQ07: 300 classificações disponíveis coincidem, sem divergências. As cinco diferenças anteriores foram resolvidas compartilhando o limite mensal de 12 releases por ano civil. A réplica Python conferiu os seis kappas da sensibilidade com erro inferior a 1e-9.
- Fonte preservada: SHA-256 `c109078a7ba40e3c982749a5cdb638b700dd1d6bbe21d0e868287ae9115a8fc5`.
- Seis figuras geradas com Matplotlib 3.11.2, em PNG e SVG. Todas foram inspecionadas visualmente: rótulos legíveis, unidades, n, limites e escalas explícitos.
- O manifesto registra `plots_completed=true`. Não foram usados token, rede ou arquivos de jobs na análise dos dados. A instalação do Matplotlib foi feita em pasta temporária local.

A validação confirma implementação, integridade e reprodução numérica desta análise. Não comprova a validade da heurística CFR (b), a independência dos rótulos, causalidade ou representatividade de todo o universo open source. Essas limitações permanecem explícitas em `REPORT.md`.

- Atualização: teste das 38 resoluções assistidas confirma referências, preservação dos arquivos oficiais e repetição sem alterar o resultado. A suíte completa agora passa em 124 testes.
