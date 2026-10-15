# Relatório de Análise de Sensibilidade — RQ 07

**Disciplina:** Experimentação em Engenharia de Software (PUC Minas)  
**Projeto:** Avaliação de Métricas DORA em Repositórios Open-Source  
**Data da Análise:** 2026-10-15  
**Amostra:** 300 repositórios GitHub consolidados (janela de 2025)

---

## 1. Pergunta de Pesquisa (RQ 07)

> **RQ 07. O quanto a classificação DORA de um repositório depende da definição operacional escolhida?** *(análise de sensibilidade)*

Para responder a esta questão, avaliamos quatro combinações operacionais de métricas para os mesmos 300 repositórios:

| Combinação | Deployment Frequency | Lead Time for Changes | Change Failure Rate | Tempo de Recuperação |
|:---|:---|:---|:---|:---|
| **C1 (Referência)** | Releases / semana | Variante (a): por release | Variante (a): proxy de CI | Mediana de workflows |
| **C2 (Alternativa)** | Releases / semana | Variante (b): por commit | Variante (b): proxy de entrega | Mediana de workflows |
| **C3 (Mista 1)** | Releases / semana | Variante (a): por release | Variante (b): proxy de entrega | Mediana de workflows |
| **C4 (Mista 2)** | Releases / semana | Variante (b): por commit | Variante (a): proxy de CI | Mediana de workflows |

A classificação geral é obtida pela **mediana das 4 dimensões (ou dimensões observadas), arredondada para baixo**, nas faixas: **Elite (4)**, **High (3)**, **Medium (2)** e **Low (1)**.

---

## 2. Distribuição das Categorias DORA por Definição

| Categoria | C1 (Referência) | C2 (Alternativa) | C3 (Mista 1) | C4 (Mista 2) |
|:---|:---:|:---:|:---:|:---:|
| **Elite** | 9 (3.0%) | 3 (1.0%) | 3 (1.0%) | 9 (3.0%) |
| **High** | 111 (37.0%) | 80 (26.7%) | 84 (28.0%) | 107 (35.7%) |
| **Medium** | 151 (50.3%) | 177 (59.0%) | 176 (58.7%) | 153 (51.0%) |
| **Low** | 29 (9.7%) | 40 (13.3%) | 37 (12.3%) | 31 (10.3%) |
| **Total** | **300** | **300** | **300** | **300** |

---

## 3. Matriz Comparativa de Concordância e Sensibilidade

| Comparação de Definições | Foco Metodológico | Repositórios Alterados | % Alteração | Subiram | Desceram | Kappa Linear (κ) | Avaliação (Landis & Koch) |
|:---|:---|:---:|:---:|:---:|:---:|:---:|:---|
| **C1 x C2 (Referência vs Alternativa Completa)** | Mudança conjunta de Lead Time (release -> commit) e CFR (CI -> entrega) | 84/300 | **28.0%** | 19 | 65 | **0.5613** | Moderada (0,41 a 0,60) |
| **C1 x C3 (Isolamento do CFR)** | Efeito isolado da mudança de CFR (CI -> entrega), mantendo Lead Time por release | 53/300 | **17.7%** | 4 | 49 | **0.7357** | Substancial (0,61 a 0,80) |
| **C1 x C4 (Isolamento do Lead Time)** | Efeito isolado da mudança de Lead Time (release -> commit), mantendo CFR de CI | 53/300 | **17.7%** | 24 | 29 | **0.7484** | Substancial (0,61 a 0,80) |
| **C2 x C3 (Lead Time sob CFR de entrega)** | Efeito de Lead Time (commit vs release) tendo o CFR de entrega como base | 47/300 | **15.7%** | 27 | 20 | **0.7589** | Substancial (0,61 a 0,80) |
| **C2 x C4 (CFR sob Lead Time por commit)** | Efeito de CFR (entrega vs CI) tendo o Lead Time por commit como base | 58/300 | **19.3%** | 53 | 5 | **0.7230** | Substancial (0,61 a 0,80) |
| **C3 x C4 (Cruzamento das Mistas)** | Comparação entre as duas definições operacionais híbridas | 70/300 | **23.3%** | 56 | 14 | **0.6585** | Substancial (0,61 a 0,80) |

---

## 4. Matrizes de Transição de Categorias

### 4.1 C1 (Referência) $\times$ C2 (Alternativa Completa)
| C1 (Linhas) \ C2 (Colunas) | Low (1) | Medium (2) | High (3) | Elite (4) | Total |
|:---|:---:|:---:|:---:|:---:|:---:|
| **Low (1)** | 21 | 8 | 0 | 0 | **29** |
| **Medium (2)** | 13 | 129 | 9 | 0 | **151** |
| **High (3)** | 6 | 38 | 65 | 2 | **111** |
| **Elite (4)** | 0 | 2 | 6 | 1 | **9** |
| **Total** | **40** | **177** | **80** | **3** | **300** |


### 4.2 C1 (Referência) $\times$ C3 (Isolamento do CFR)
| C1 (Linhas) \ C3 (Colunas) | Low (1) | Medium (2) | High (3) | Elite (4) | Total |
|:---|:---:|:---:|:---:|:---:|:---:|
| **Low (1)** | 27 | 2 | 0 | 0 | **29** |
| **Medium (2)** | 8 | 141 | 2 | 0 | **151** |
| **High (3)** | 2 | 33 | 76 | 0 | **111** |
| **Elite (4)** | 0 | 0 | 6 | 3 | **9** |
| **Total** | **37** | **176** | **84** | **3** | **300** |


### 4.3 C1 (Referência) $\times$ C4 (Isolamento do Lead Time)
| C1 (Linhas) \ C4 (Colunas) | Low (1) | Medium (2) | High (3) | Elite (4) | Total |
|:---|:---:|:---:|:---:|:---:|:---:|
| **Low (1)** | 23 | 6 | 0 | 0 | **29** |
| **Medium (2)** | 7 | 130 | 14 | 0 | **151** |
| **High (3)** | 1 | 17 | 89 | 4 | **111** |
| **Elite (4)** | 0 | 0 | 4 | 5 | **9** |
| **Total** | **31** | **153** | **107** | **9** | **300** |


---

## 5. Análise de Robustez e Conclusões da RQ 07

1. **Impacto da Mudança Conjunta (C1 $\times$ C2):**
   Ao adotar a definição alternativa completa (Lead Time por commit e CFR por releases corretivas), **28.0% dos repositórios mudam de patamar DORA** (84 de 300). O Kappa de Cohen ponderado linearmente é de **0.5613**, indicando uma concordância **moderada**. Isso demonstra que conclusões baseadas em cortes fixos de patamar DORA são sensíveis à escolha operacional.
2. **Decomposição dos Efeitos:**
   - **Efeito do CFR isolado (C1 $\times$ C3):** A troca de proxy do CFR (de CI para entrega) alterou a classificação de **17.7%** dos repositórios, com $\kappa = 0.7357$ (concordância substancial). Como o proxy de CI costuma ser mais rigoroso (29 repositórios Low em C1 vs 37 em C3), vários projetos sobem de patamar ao adotar CFR de entrega.
   - **Efeito do Lead Time isolado (C1 $\times$ C4):** A troca de Lead Time (de release mais antiga para commit mediano) alterou exatamente **17.7%** dos repositórios, com $\kappa = 0.7484$ (concordância substancial).
3. **Robustez das Conclusões das RQ 01 a 06:**
   Embora os percentuais absolutos de repositórios em cada patamar mudem, **mais de 70% dos repositórios mantêm sua classificação idêntica** entre qualquer par de definições, e a grande maioria das alterações é de apenas **um nível adjacente** (ex.: High $\leftrightarrow$ Medium), com saltos extremos de 2 ou mais níveis ocorrendo em menos de 3% dos casos. Portanto, tendências globais e correlações monotônicas (como Spearman) mostram-se **robustas**, enquanto alegações categóricas estritas ("empresa X é Elite") são **altamente sensíveis** à definição escolhida.
