# DORA — Sprint 2 / Validação Manual (Amostra-Ouro, Concordância e Consenso)

> **Responsável:** Luís Henrique (`BGLuis`)  
> **Issue vinculada:** [#4 — Rotular a Amostra-Ouro de Forma Independente + Cálculo de Concordância e Consolidação do Consenso](https://github.com/alencarleandro/DORA/issues/4)  
> **Artefatos gerados:** `data/gold-standard/` (`rotulos-luis.csv`, `consensus.csv`, `agreement_report.md`, `agreement_report.json`)

---

## 1. Visão Geral e Contexto Metodológico

Conforme a **Seção 6** do `README.md`, qualquer heurística automática de mineração (como classificar se uma release é corretiva por mudança de patch ou mensagens de commit) pode falhar. Para aferir e calibrar a qualidade dessas inferências frente ao padrão humano (*gold standard*), a Sprint 2 (Lab03S02) exige:

1. **Sorteio reproduzível** de 60 repositórios da amostra e 5 releases sorteadas por repositório (totalizando 300 releases).
2. **Rotulagem independente** pelos 3 integrantes do grupo (Luís, Leandro e Isabella), sem comunicação prévia e sem acesso prévio à heurística automática.
3. **Cálculo da concordância inter-observador** utilizando o **Kappa de Fleiss** para as 3 dimensões nominais.
4. **Consolidação do consenso** a partir de protocolo formal de desempate, gerando o dataset de referência que desbloqueia a **Issue #5** (Leandro — cálculo de Precisão, Recall e F1 da heurística de CFR b) e a **RQ 06** (tipo de projeto).

---

## 2. Protocolo de Amostragem Reproduzível

O sorteio é realizado de forma 100% determinística através de gerador pseudoaleatório baseado em Mulberry32 (`lib/agreement.mjs:createRNG` e `sampleArray`):

* **Semente fixa:** `seed = 42` (documentada e auditável).
* **Repositórios:** 60 projetos populares de código aberto que utilizam CI/CD no GitHub Actions.
* **Releases por repositório:** 5 releases publicadas na janela de observação (2024-01-01 a 2024-12-31).
* **Links Diretos:** A planilha gerada inclui hiperlinks diretos para a página do repositório no GitHub (`https://github.com/:repo`) e para a página da respectiva release (`https://github.com/:repo/releases/tag/:tag`), otimizando o processo de inspeção humana.

### Execução da amostragem:
```bash
node scripts/sample-gold-standard.mjs --seed 42 --n-repos 60 --n-releases 5
```

---

## 3. Dimensões de Rotulagem Independente

Cada avaliador inspecionou as evidências públicas no GitHub e anotou suas decisões em sua planilha individual:

| Dimensão | Nível | Categorias | Descrição / Critério |
|---|---|---|---|
| **Tipo do Projeto** | Repositório ($N=60$) | `biblioteca/framework`<br>`ferramenta CLI`<br>`aplicação/serviço`<br>`outro` | Natureza primária de consumo do projeto pelo usuário/desenvolvedor. |
| **Entregas Reais ao Usuário** | Repositório ($N=60$) | `sim`<br>`não`<br>`incerto` | Se a publicação de release no GitHub corresponde a uma entrega efetiva de artefato executável/instalável ao usuário. |
| **Release Corretiva (CFR b)** | Release ($N=300$) | `sim`<br>`não` | Se o objetivo principal da release foi correção de defeito/hotfix recente (verificado via notas de versão, changelog e mensagens de commit). |

Os arquivos de anotação de cada integrante estão commitados na pasta `data/gold-standard/`:
* `rotulos-luis.csv` — Avaliação independente de Luís Henrique (Issue #4);
* `rotulos-leandro.csv` — Avaliação independente de Leandro Alencar (Issue #5);
* `rotulos-isabella.csv` — Avaliação independente de Isabella Dias (Issue #6).

---

## 4. Resultados do Kappa de Fleiss (Concordância Inter-Observador)

A concordância entre os 3 avaliadores foi calculada utilizando o algoritmo clássico do Kappa de Fleiss (1971) implementado em `lib/agreement.mjs` e verificado via script Python (`scripts/calculate_agreement.py`):

$$\kappa = \frac{\bar{P} - \bar{P}_e}{1 - \bar{P}_e}$$

### Tabela Resumo da Amostra-Ouro

| Dimensão | Sujeitos ($N$) | Avaliadores ($n$) | Categorias ($k$) | Concordância Observada ($\bar{P}$) | Concordância Casual ($\bar{P}_e$) | Kappa de Fleiss ($\kappa$) | Enquadramento (Landis & Koch, 1977) |
|---|---|---|---|---|---|---|---|
| **Tipo de Projeto** | 60 | 3 | 4 | 94,44% | 37,87% | **0,9106** | **Quase perfeita** |
| **Entregas Reais ao Usuário** | 60 | 3 | 3 | 97,78% | 95,64% | **0,4908** | **Moderada** |
| **Release Corretiva (CFR b)** | 300 | 3 | 2 | 92,67% | 50,19% | **0,8528** | **Quase perfeita** |

> **Nota sobre o Kappa de Entregas Reais:** O valor de $\kappa = 0{,}4908$ em "Entregas Reais", apesar da elevadíssima concordância absoluta (97,78%), é uma manifestação clássica do *paradoxo de prevalência do Kappa* (Feinstein & Cicchetti, 1990): como quase todos os repositórios avaliados foram rotulados como `sim`, a probabilidade de concordância por mero acaso ($\bar{P}_e$) sobe para 95,64%, reduzindo a amplitude do coeficiente. Esse comportamento é cientificamente relevante e deve ser reportado nas Ameaças à Validade do artigo.

---

## 5. Protocolo de Consolidação do Consenso

Para produzir o gabarito final consolidado da amostra-ouro, o script `scripts/consolidate-consensus.mjs` aplica o seguinte protocolo de desempate:

1. **Unanimidade (3 vs 0):** Decisão consensual imediata.
2. **Maioria Simples (2 vs 1):** O rótulo da maioria (2 votos) prevalece como rótulo de consenso.
3. **Empate Tripartite (1 vs 1 vs 1):** Para dimensões com $>2$ categorias (como Tipo de Projeto), desempate baseado no critério de finalidade preponderante do artefato, registrado no log de consenso.
4. **Releases Corretivas:** Como a escala é binária (`sim`/`não`), todo caso divergente possui resolução estrita por maioria simples (2 contra 1).

### Síntese do Dataset de Consenso (`data/gold-standard/consensus.csv`):
* **Total de repositórios:** 60
  * Ferramenta CLI: 28 repositórios (46,7%)
  * Biblioteca / Framework: 23 repositórios (38,3%)
  * Aplicação / Serviço: 9 repositórios (15,0%)
* **Entregas reais confirmadas:** 59 repositórios (98,3%), 1 incerto (1,7%).
* **Total de releases avaliadas:** 300
  * Releases corretivas consensuais (`sim`): **141** (47,0%)
  * Releases de melhoria/recurso (`não`): **159** (53,0%)
  * Concordância unânime: 267 releases (89,0%)
  * Decisão por maioria: 33 releases (11,0%)

---

## 6. Integração com as Demais Issues da Sprint 2

* **Desbloqueio da Issue #5 (Leandro):** A Pessoa B consome o arquivo `data/gold-standard/consensus.csv` para comparar a coluna `consensus_is_corrective` contra a heurística automática de release corretiva, calculando:
  $$\text{Precisão} = \frac{VP}{VP + FP}, \quad \text{Recall} = \frac{VP}{VP + FN}, \quad F_1 = \frac{2 \cdot P \cdot R}{P + R}$$
  Caso $F_1 < 0{,}70$, a heurística é refinada e reavaliada contra este mesmo consenso.
* **Insumo para a RQ 06:** A coluna `consensus_project_type` categoriza os 60 repositórios da amostra-ouro nos três grupos para aplicação do teste não-paramétrico de Kruskal-Wallis frente às métricas DORA.

---

## 7. Como Reproduzir e Executar os Comandos

```bash
# 1. Rodar a suíte completa de testes automatizados com cobertura
npm test

# 2. Sortear ou atualizar a amostra-ouro (seed 42)
node scripts/sample-gold-standard.mjs

# 3. Calcular a concordância (Kappa de Fleiss) em Node.js
node scripts/calculate-agreement.mjs

# 4. Validar o cálculo de forma cruzada em Python
python3 scripts/calculate_agreement.py

# 5. Gerar a consolidação final do consenso
node scripts/consolidate-consensus.mjs
```
