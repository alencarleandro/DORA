# Avaliação de Luis — amostra final 2025

## Revisão incorporada — 20/10/2026

Leandro informou que Luis revisou o rascunho preenchido e autorizou a incorporação das 300 decisões à [planilha oficial](../rotulos-luis.csv): 106 corretivas e 194 não corretivas. A confirmação, sua origem e os hashes estão em `confirmacao-revisao-humana.json`. A origem comum das sugestões de IA permanece explícita; não se afirma independência estrita. O material abaixo descreve a preparação e o histórico anterior à incorporação. O consenso e a calibração foram concluídos posteriormente; veja [o relatório atual](../../dataset-s02-final/validacao/cfr-b/REPORT.md).

São as mesmas **300 releases de 60 projetos**, cinco por projeto, de **01/01/2025 a 31/12/2025**, semente 42. Não é necessário coletar novamente ou sortear outra amostra.

## Rascunho preenchido por IA — 20/10/2026

[rotulos-luis-assistidos.csv](rotulos-luis-assistidos.csv) contém **300 propostas: 106 sim e 194 não**, com justificativas e referências. Foi preenchido a pedido do usuário, reutilizando as sugestões de IA do rascunho de Leandro. **Não é uma nova avaliação independente do Luis.** A planilha oficial permanece preservada até a revisão das respostas por ele.

Luis deve conferir as propostas nas fontes, corrigir o que discordar e registrar suas decisões. Há 38 julgamentos originalmente ambíguos; as justificativas e prioridades estão no material assistido de origem. O uso de respostas com origem comum deve ser informado na metodologia e limita a interpretação da concordância. A aprovação anterior do material de consulta não foi tratada como revisão deste rascunho, que só foi preenchido depois.

O arquivo `rascunho-assistido.json` registra origem, contagens, hashes e estado de revisão. Não houve cálculo de consenso ou F1.

1. Consulte as URLs de releases e as justificativas do CSV. A página `consulta-releases.html` é uma exportação local volumosa do cache e não é versionada.
2. Preencha [sua planilha oficial](../rotulos-luis.csv). Preserve cabeçalhos, ordem e as cinco colunas de referência. Salve como CSV UTF-8 separado por vírgulas.
3. Em project_type use biblioteca/framework, ferramenta CLI, aplicação/serviço ou outro. Em real_delivery use sim, não ou incerto. Mantenha essas duas respostas consistentes nas cinco releases de cada projeto, conforme o protocolo do grupo.
4. Em is_corrective use sim ou não: a finalidade predominante da release é corrigir defeito recente? Não basta ser patch nem mencionar um bug. Consulte notas, changelogs e commits; registre fonte e justificativa em notes. Dúvidas devem ser documentadas para discussão.
5. Conclua suas respostas antes de consultar avaliações dos colegas ou previsões do classificador. Registre eventual assistência de IA e limitações de independência.
6. Depois o grupo calcula concordância e resolve divergências para documentar o consenso. Os comandos estão no [guia da amostra](../README.md).

**Para uma criança:** todos recebem as mesmas 300 fichas. Veja se cada atualização serviu principalmente para consertar algo e escreva sua resposta com a pista usada. Depois o grupo compara.

Preparado em 20/10/2026. Esta preparação não preenche nem confirma a avaliação de Luis.
