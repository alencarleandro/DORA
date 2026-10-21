# Consenso operacional — amostra final 2025

Data: 20/10/2026. Janela 01/01/2025–31/12/2025. Amostra: 60 projetos × 5 releases, semente 42.

**300/300 referências conferidas.** 112 corretivas, 188 não corretivas.

## Protocolo e limites

O usuário autorizou o assistente a resolver divergências após conversar com o grupo. As decisões aqui são **adjudicação assistida por IA delegada**, não uma ata de discussão humana por item. Os rótulos originais foram preservados. Luis e Leandro partiram das mesmas sugestões de IA; portanto não se usou maioria de dois votos como evidência independente. Foram examinadas notas, commits e documentos oficiais previamente salvos, com justificativas em adjudication-log.json, sem consultar previsões/F1 para escolher respostas.

Há 14 divergências corretivas e 7 decisões no nível de projeto (3 de tipo, 4 de entrega), correspondendo a 49 células divergentes no CSV. Os 286 rótulos corretivos unânimes foram mantidos. A convenção para runtimes foi explicitada como outro; entregas a desenvolvedores contam como uso real, preservando incerteza no caso heterogêneo de Moby. Essas escolhas subjetivas limitam a interpretação.

## Concordância antes da adjudicação

| Dimensão | N | Concordância observada | Kappa de Fleiss |
|---|---:|---:|---:|
| project_type | 60 | 96.67% | 0.949023 |
| real_delivery | 60 | 95.56% | 0.405450 |
| is_corrective | 300 | 96.89% | 0.932112 |

Os números descrevem avaliações assistidas com origem compartilhada, não confiabilidade humana independente. Precisão, recall e F1 devem ser apresentados como **calibração nesta referência operacional**, sem alegação de teste externo. A seleção da melhor heurística no mesmo consenso não mede generalização.

## Reprodução

Execute node scripts/calculate-agreement.mjs --data-dir data/gold-standard-final-300-2025, depois node scripts/finalize-gold-consensus-2025.mjs. O segundo passo registra decisões e limitações. Para avaliar, use scripts/calculate-cfr-b.mjs com o consenso desta pasta. Nenhum rótulo individual é reescrito.
