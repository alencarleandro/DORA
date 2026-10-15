# Relatório do Bônus — RQ 08: Rework Rate

**Disciplina:** Experimentação em Engenharia de Software (PUC Minas)  
**Projeto:** Avaliação de Métricas DORA em Repositórios Open-Source  
**Métrica Avaliada:** *Deployment Rework Rate* (DORA State of DevOps Report 2024)

---

## 1. O que é o Rework Rate e como difere do CFR (b)?

Em 2024, o programa de pesquisa DORA incorporou uma quinta métrica-chave: a **Deployment Rework Rate** (Taxa de Retrabalho de Entrega).

### Distinção Conceitual:
- **Change Failure Rate — CFR (b):**
  Mede a proporção de entregas que **geraram falha**. O foco está na estabilidade do artefato entregue: *"Dentre as releases publicadas, qual porcentagem precisou de correção emergencial em até 7 dias?"*
  $$\text{CFR (b)} = \frac{\text{Releases com falha observada}}{\text{Releases avaliadas}}$$
- **Rework Rate:**
  Mede a proporção de entregas que **foram retrabalho**. O foco está na alocação de capacidade produtiva da equipe: *"Dentre todas as releases produzidas pela equipe, qual porcentagem do esforço de entrega foi consumida corrigindo defeitos anteriores?"*
  $$\text{Rework Rate} = \frac{\text{Releases corretivas}}{\text{Total de releases publicadas}}$$

---

## 2. Estatística Descritiva da Amostra (N = 300)

| Estatística | Valor |
|:---|:---:|
| **Média** | 30.30% |
| **Desvio Padrão** | 27.77% |
| **Mínimo** | 0.00% |
| **1º Quartil (Q1)** | 6.02% |
| **Mediana** | **25.00%** |
| **3º Quartil (Q3)** | 48.56% |
| **Intervalo Interquartil (IQR)** | 42.55% |
| **Máximo** | 99.77% |
| **Repositórios com 0% de Retrabalho** | 62 (20.7%) |

---

## 3. Correlações de Spearman (ρ)

| Variável Comparada | Coeficiente de Spearman (ρ) | Interpretação |
|:---|:---:|:---|
| **Rework Rate $\times$ CFR (b)** | **0.9992** | Correlação direta quase perfeita: repositórios com alta taxa de falha de release dedicam proporcionalmente mais entregas a correções. |
| **Rework Rate $\times$ CFR (CI)** | **0.1345** | Correlação fraca/moderada: falhas de compilação/teste em pipeline interno nem sempre se traduzem em retrabalho de release para o usuário. |
| **Rework Rate $\times$ Deployment Frequency** | **0.5746** | Relação com cadência de entrega: projetos com deploy frequente tendem a publicar hotfixes rápidos. |
| **Rework Rate $\times$ Lead Time (Release)** | **-0.5424** | Relação com tempo de desenvolvimento das mudanças. |

---

## 4. Síntese e Conclusão

1. A mediana do Rework Rate observada na coorte de 300 repositórios foi de **25.00%**, com IQR de **42.55%**.
2. O Rework Rate oferece uma perspectiva complementar essencial: enquanto o CFR (b) identifica o risco de instabilidade por entrega, o Rework Rate quantifica o custo oculto de manutenção não planejada na capacidade de desenvolvimento de software open-source.
