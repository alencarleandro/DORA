# Rastreabilidade da avaliação de Isabella

| Arquivo | Função |
|---|---|
| `rotulos-isabella-assistidos.csv` | rascunho de 300 propostas com uso de IA explícito |
| `evidencias-isabella.csv` | URLs, datas, hashes e justificativas por release |
| `decisoes.json` | decisões editoriais usadas para reproduzir o rascunho |
| `analise-isabella.json` | contagens e situação da análise/revisão |
| `revisao-isabella.json` | confirmação de Isabella e hashes dos arquivos aceitos |

A entrada oficial para concordância é `../rotulos-isabella.csv`. Esta pasta não contém consenso ou F1. A revisão assistida não deve ser apresentada como avaliação sem auxílio e às cegas.

Reprodução do rascunho, na raiz do projeto: `node scripts/build-isabella-labels.mjs`. O comando não sobrescreve o arquivo oficial.
