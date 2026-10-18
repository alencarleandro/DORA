# Relatório de Análise de Sensibilidade — RQ 07

**Disciplina:** Experimentação em Engenharia de Software (PUC Minas)  
**Projeto:** Avaliação de Métricas DORA em Repositórios Open-Source  
**Data da Análise:** 2026-10-18  
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

**Alinhamento da C1:** este script compartilha o corte de frequência com RQ01-04: em ano civil completo, 12 releases atendem a uma por mês, sem arredondar o ano para 52,14 semanas. Esta C1 usa dimensões disponíveis nos 300 projetos; a C1 completa de RQ01-04 usa somente os 258 com quatro dimensões. O CFR (b) permanece exploratório enquanto a validação contra o consenso final estiver pendente.

---

## 2. Distribuição das Categorias DORA por Definição

| Categoria | C1 (Referência) | C2 (Alternativa) | C3 (Mista 1) | C4 (Mista 2) |
|:---|:---:|:---:|:---:|:---:|
| **Elite** | 9 (3.0%) | 3 (1.0%) | 3 (1.0%) | 9 (3.0%) |
| **High** | 114 (38.0%) | 83 (27.7%) | 87 (29.0%) | 110 (36.7%) |
| **Medium** | 150 (50.0%) | 178 (59.3%) | 176 (58.7%) | 152 (50.7%) |
| **Low** | 27 (9.0%) | 36 (12.0%) | 34 (11.3%) | 29 (9.7%) |
| **Total** | **300** | **300** | **300** | **300** |

---

## 3. Matriz Comparativa de Concordância e Sensibilidade

| Comparação de Definições | Foco Metodológico | Repositórios Alterados | % Alteração | Subiram | Desceram | Kappa Linear (κ) | Avaliação (Landis & Koch) |
|:---|:---|:---:|:---:|:---:|:---:|:---:|:---|
| **C1 x C2 (Referência vs Alternativa Completa)** | Mudança conjunta de Lead Time (release -> commit) e CFR (CI -> entrega) | 82/300 | **27.3%** | 18 | 64 | **0.5745** | Moderada (0,41 a 0,60) |
| **C1 x C3 (Isolamento do CFR)** | Efeito isolado da mudança de CFR (CI -> entrega), mantendo Lead Time por release | 53/300 | **17.7%** | 4 | 49 | **0.7377** | Substancial (0,61 a 0,80) |
| **C1 x C4 (Isolamento do Lead Time)** | Efeito isolado da mudança de Lead Time (release -> commit), mantendo CFR de CI | 51/300 | **17.0%** | 23 | 28 | **0.7555** | Substancial (0,61 a 0,80) |
| **C2 x C3 (Lead Time sob CFR de entrega)** | Efeito de Lead Time (commit vs release) tendo o CFR de entrega como base | 44/300 | **14.7%** | 25 | 19 | **0.7710** | Substancial (0,61 a 0,80) |
| **C2 x C4 (CFR sob Lead Time por commit)** | Efeito de CFR (entrega vs CI) tendo o Lead Time por commit como base | 56/300 | **18.7%** | 51 | 5 | **0.7290** | Substancial (0,61 a 0,80) |
| **C3 x C4 (Cruzamento das Mistas)** | Comparação entre as duas definições operacionais híbridas | 67/300 | **22.3%** | 54 | 13 | **0.6697** | Substancial (0,61 a 0,80) |

---

## 4. Matrizes de Transição de Categorias

### 4.1 C1 (Referência) $\times$ C2 (Alternativa Completa)
| C1 (Linhas) \ C2 (Colunas) | Low (1) | Medium (2) | High (3) | Elite (4) | Total |
|:---|:---:|:---:|:---:|:---:|:---:|
| **Low (1)** | 20 | 7 | 0 | 0 | **27** |
| **Medium (2)** | 12 | 129 | 9 | 0 | **150** |
| **High (3)** | 4 | 40 | 68 | 2 | **114** |
| **Elite (4)** | 0 | 2 | 6 | 1 | **9** |
| **Total** | **36** | **178** | **83** | **3** | **300** |


### 4.2 C1 (Referência) $\times$ C3 (Isolamento do CFR)
| C1 (Linhas) \ C3 (Colunas) | Low (1) | Medium (2) | High (3) | Elite (4) | Total |
|:---|:---:|:---:|:---:|:---:|:---:|
| **Low (1)** | 25 | 2 | 0 | 0 | **27** |
| **Medium (2)** | 8 | 140 | 2 | 0 | **150** |
| **High (3)** | 1 | 34 | 79 | 0 | **114** |
| **Elite (4)** | 0 | 0 | 6 | 3 | **9** |
| **Total** | **34** | **176** | **87** | **3** | **300** |


### 4.3 C1 (Referência) $\times$ C4 (Isolamento do Lead Time)
| C1 (Linhas) \ C4 (Colunas) | Low (1) | Medium (2) | High (3) | Elite (4) | Total |
|:---|:---:|:---:|:---:|:---:|:---:|
| **Low (1)** | 22 | 5 | 0 | 0 | **27** |
| **Medium (2)** | 6 | 130 | 14 | 0 | **150** |
| **High (3)** | 1 | 17 | 92 | 4 | **114** |
| **Elite (4)** | 0 | 0 | 4 | 5 | **9** |
| **Total** | **29** | **152** | **110** | **9** | **300** |


---

## 5. Análise de Robustez e Conclusões da RQ 07

1. **Impacto da Mudança Conjunta (C1 $\times$ C2):**
   Ao adotar a definição alternativa completa (Lead Time por commit e CFR por releases corretivas), **27.3% dos repositórios mudam de patamar DORA** (82 de 300). O Kappa de Cohen ponderado linearmente é de **0.5745**, indicando uma concordância **moderada**. Isso demonstra que conclusões baseadas em cortes fixos de patamar DORA são sensíveis à escolha operacional.
2. **Decomposição dos Efeitos:**
   - **Efeito do CFR isolado (C1 $\times$ C3):** A troca de proxy do CFR (de CI para entrega) alterou a classificação de **17.7%** dos repositórios, com $\kappa = 0.7377$ (concordância substancial). Há 27 projetos Low em C1 e 34 em C3. As matrizes mostram a direção das transições; as contagens marginais não demonstram que um proxy é sempre mais rigoroso.
   - **Efeito do Lead Time isolado (C1 $\times$ C4):** A troca de Lead Time (de release mais antiga para commit mediano) alterou exatamente **17.0%** dos repositórios, com $\kappa = 0.7555$ (concordância substancial).
3. **Robustez das Conclusões das RQ 01 a 06:**
   A permanência ou troca de categorias descreve a sensibilidade da classificação nesta coorte. Ela não comprova robustez das correlações de Spearman ou dos testes das RQ05/RQ06: isso exige recalcular esses resultados sob as variantes. As conclusões que usam CFR (b) são exploratórias até sua validação. A análise sobre dimensões disponíveis também não substitui a avaliação restrita aos casos completos.
