# Atualização do consenso e da calibração CFR (b)

Atualização de 20/10/2026, referente às issues #4, #5 e #10.

- [Word editável atualizado](Relatorio-Lab03-atualizado.docx): 10 páginas com consenso, concordância, precisão, recall, F1 e limitações.
- [PDF correspondente](Relatorio-Lab03-atualizado.pdf).
- [Somente as páginas alteradas](Paginas-alteradas.pdf): páginas 2, 6, 7, 8, 9 e 10 da versão atualizada; a página 10 é um novo apêndice.
- [Protocolo e consenso operacional](../../data/gold-standard-final-300-2025/consensus_summary.md).
- [Calibração e reprodução](../../data/dataset-s02-final/validacao/cfr-b/REPORT.md).

## Prioridade da versão do grupo

O relatório de 12 páginas já enviado pelo grupo em `docs/Relatorio - Laboratório de Experimentação de Software.pdf`, trazido pelo commit 2b05c22, foi preservado sem alteração e contém os dez gráficos. Os arquivos desta pasta foram preparados a partir do PDF de nove páginas fornecido na conversa, que tinha as legendas sem as imagens dos gráficos. Não substituem a versão do grupo; fornecem o texto atualizado e um Word editável para incorporar a calibração ao documento com gráficos.

## Resultado

As 300 referências foram verificadas. Consenso operacional: 112 corretivas e 188 não corretivas. Concordância observada para finalidade corretiva: 96,89%; kappa de Fleiss 0,9321. Melhor heurística: fix-majority-v3; precisão 46,34%, recall 67,86%, F1 55,07%, abaixo do mínimo de 70%. O CFR (b) e a RQ08 permanecem exploratórios.

O uso de sugestões de IA comuns por Luis/Leandro e a adjudicação delegada por IA estão documentados; os resultados não constituem validação humana independente. Não foram alterados os valores do dataset para melhorar o resultado. Os rótulos individuais e os registros de revisão foram preservados como entradas do consenso.
