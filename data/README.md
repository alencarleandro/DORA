# Dados do projeto

A entrega atual da Sprint 2 usa a janela UTC de **2025-01-01 a 2025-12-31**.

| Pasta | Conteúdo | Uso |
|---|---|---|
| [dataset-s02-final](dataset-s02-final/) | 300 repositórios, dicionário, seleção, métricas e validação | base comum para análise e reprodução da consolidação |
| [gold-standard-final-300-2025](gold-standard-final-300-2025/) | amostra real de 60 projetos × 5 releases e rótulos dos três integrantes | rotulação, concordância e consenso da Sprint 2 |
| [gold-standard](gold-standard/) | amostra e resultados anteriores | histórico; não usar como referência da base final de 2025 |

Siga o [guia de pastas e responsabilidades](../docs/ESTRUTURA-DADOS-S02.md) para saber onde salvar arquivos e quais comandos executar. A entrega está no repositório, sem ZIP.

`jobs/`, caches e fotografias brutas de evidências são locais e ignorados pelo Git. Eles não fazem parte destes exports. A consolidação dos CSVs funciona sem token; o recálculo das métricas exige os dados brutos da coleta original.
