from pathlib import Path
from xml.sax.saxutils import escape
from reportlab.pdfgen import canvas
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'output/pdf/roteiro-sprint-1-pessoa-a.pdf'
OUT.parent.mkdir(parents=True, exist_ok=True)
FONT = Path('C:/Windows/Fonts')
pdfmetrics.registerFont(TTFont('Guide', str(FONT/'arial.ttf')))
pdfmetrics.registerFont(TTFont('GuideBold', str(FONT/'arialbd.ttf')))
pdfmetrics.registerFont(TTFont('GuideMono', str(FONT/'consola.ttf')))
pdfmetrics.registerFontFamily('Guide',normal='Guide',bold='GuideBold',italic='Guide',boldItalic='GuideBold')
TEAL=colors.HexColor('#147968'); INK=colors.HexColor('#182F37'); MUTED=colors.HexColor('#536870'); PALE=colors.HexColor('#EAF5F0'); LINE=colors.HexColor('#D7E4DF')
styles=getSampleStyleSheet()
styles.add(ParagraphStyle(name='BodyGuide',fontName='Guide',fontSize=9.8,leading=14,textColor=INK,spaceAfter=7))
styles.add(ParagraphStyle(name='TitleGuide',fontName='GuideBold',fontSize=25,leading=29,textColor=INK,spaceAfter=14))
styles.add(ParagraphStyle(name='SubGuide',fontName='GuideBold',fontSize=13.5,leading=17,textColor=TEAL,spaceBefore=10,spaceAfter=7,keepWithNext=True))
styles.add(ParagraphStyle(name='SmallGuide',fontName='Guide',fontSize=8.3,leading=11.5,textColor=MUTED,spaceAfter=6))
styles.add(ParagraphStyle(name='CodeGuide',fontName='GuideMono',fontSize=8.3,leading=12,textColor=INK,spaceAfter=0))
styles.add(ParagraphStyle(name='Kicker',fontName='GuideBold',fontSize=9,leading=13,textColor=TEAL,spaceAfter=10))
story=[]
def p(text,style='BodyGuide'): return Paragraph(text,styles[style])
def add(text,style='BodyGuide'): story.append(p(text,style))
def title(number,text,sub):
    add(f'DORA / LAB03S01 / ISSUE #1  •  {number:02d}', 'Kicker')
    add(text,'TitleGuide'); add(sub,'BodyGuide'); story.append(Spacer(1,8))
def h(text): add(text,'SubGuide')
def bullet(text): add('• '+text)
def box(label,text):
    t=Table([[p(label,'Kicker')],[p(text)]],colWidths=[479])
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),PALE),('BOX',(0,0),(-1,-1),.6,LINE),('LEFTPADDING',(0,0),(-1,-1),13),('RIGHTPADDING',(0,0),(-1,-1),13),('TOPPADDING',(0,0),(-1,0),12),('BOTTOMPADDING',(0,-1),(-1,-1),9)]))
    story.append(t); story.append(Spacer(1,12))
def code(text):
    lines='<br/>'.join(escape(line).replace(' ','&nbsp;') for line in text.splitlines())
    t=Table([[p(lines,'CodeGuide')]],colWidths=[479]);t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),colors.HexColor('#F1F5F6')),('LEFTPADDING',(0,0),(-1,-1),12),('RIGHTPADDING',(0,0),(-1,-1),12),('TOPPADDING',(0,0),(-1,-1),10),('BOTTOMPADDING',(0,0),(-1,-1),10)]));story.append(t);story.append(Spacer(1,10))
def table(headers,rows,widths):
    data=[[p(escape(str(v)),'SmallGuide') for v in headers]]+[[p(str(v),'SmallGuide') for v in row] for row in rows]
    t=Table(data,colWidths=widths,repeatRows=1,hAlign='LEFT')
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),PALE),('VALIGN',(0,0),(-1,-1),'TOP'),('LINEBELOW',(0,0),(-1,0),.8,TEAL),('LINEBELOW',(0,1),(-1,-1),.4,LINE),('LEFTPADDING',(0,0),(-1,-1),8),('RIGHTPADDING',(0,0),(-1,-1),8),('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),6)]));story.append(t);story.append(Spacer(1,10))
def page(): story.append(PageBreak())

title(1,'Sua missão: encontrar<br/>os projetos da pesquisa','Roteiro para a pessoa A: seleção de repositórios, metadados e funil. Primeiro, uma explicação simples; depois, o passo a passo técnico.')
box('EXPLICANDO COMO PARA UMA CRIANÇA','Imagine que a turma vai estudar várias fábricas de brinquedos. Cada fábrica tem um nome, um endereço, uma idade e pessoas que trabalham nela. Antes de estudar como elas funcionam, alguém precisa escolher quais fábricas vão participar. <b>Essa é a sua missão.</b>')
h('Na pesquisa, as “fábricas” são repositórios')
bullet('<b>Repositório:</b> a pasta de um projeto no GitHub, com seu código e histórico.')
bullet('<b>Estrelas:</b> pessoas que marcaram o projeto como favorito. Ajudam a representar popularidade.')
bullet('<b>Linguagem:</b> a principal linguagem usada para escrever o projeto.')
bullet('<b>Contribuidores:</b> pessoas que ajudaram a construir o projeto.')
bullet('<b>Idade:</b> há quanto tempo o repositório existe.')
h('Você prepara a lista; os colegas investigam')
table(['PESSOA','O QUE FAZ NA ANALOGIA','NO LABORATÓRIO'],[
    ['A / você','Escolhe as fábricas e faz suas fichas.','Busca candidatos, coleta metadados e organiza o funil.'],
    ['B','Estuda os brinquedos entregues.','Coleta releases e commits; calcula lead time.'],
    ['C','Estuda as máquinas e suas falhas.','Coleta workflows; calcula CFR de CI e recuperação.']
],[55,193,231])
box('O FUNIL É UMA PENEIRA','Começamos com muitos projetos. Depois, ficam apenas os que passam pelas regras. Você registra quantos entraram, quantos ficaram e por que cada um saiu. Não basta escrever “escolhemos 100”: precisamos mostrar como chegamos a eles.')
add('Meta da Sprint 1: o grupo entregar um pipeline funcionando para 100 repositórios, com testes, CI e introdução do artigo.','SmallGuide')
page()

title(2,'Antes de programar','Etapa 1 / combine as regras e prepare uma implementação que encaixe no projeto do grupo.')
h('1. Leia o que realmente pertence à sua parte')
add('No README, a parte A é: <b>seleção de repositórios, funil e coleta de metadados (estrelas, linguagem, contribuidores e idade)</b>. A Issue correspondente é a <b>#1</b>. Releases e workflows ajudam a decidir quem entra na amostra, mas seus coletores são as partes B e C.')
h('2. Combine estas decisões com os colegas')
bullet('<b>Janela:</b> início e fim dos 12 meses fixados pelo professor. Use exatamente as mesmas datas nos três módulos; não invente a janela.')
bullet('<b>Popularidade:</b> documente o critério escolhido. O README sugere a busca <b>stars:&gt;1000</b> como exemplo; não apresenta esse número como um filtro mínimo universal obrigatório.')
bullet('<b>Escolhas adicionais:</b> se o grupo excluir forks ou projetos arquivados, registre a justificativa. São decisões de amostragem, não exigências extras do enunciado.')
bullet('<b>Contribuidores e idade:</b> defina como contar e qual data usar como referência. Guarde a origem e as limitações.')
h('3. Reaproveite a base já disponível')
add('O repositório usa Node.js e já tem um cliente REST próprio em <b>lib/github.mjs</b>, desenvolvido pela parte C. Ele recebe token, pasta de cache e função de log. Evite criar outro tratamento incompatível de rate limit e cache; combine seu reaproveitamento com C.')
add('O método <b>get()</b> devolve um objeto com <b>data</b> (resposta da API) e <b>next</b> (próxima página). Busca e metadados da parte A ainda precisam ser implementados.')
box('ESTRUTURA SUGERIDA, AINDA A CRIAR','<b>scripts/select-repos.mjs</b>: comando de seleção.<br/><b>lib/selection.mjs</b>: busca, filtros e metadados.<br/><b>tests/selection.test.mjs</b>: cenários relevantes com API simulada.<br/><b>config.json</b>: regras de busca e janela; sem token.<br/>Os nomes são uma sugestão, não arquivos já prontos.')
add('Trabalhe na Issue #1 e em uma branch própria. Guarde GITHUB_TOKEN no ambiente. Nunca inclua credenciais no código, no CSV ou em commits.','SmallGuide')
page()

title(3,'Encontrar os candidatos','Etapa 2 / faça uma busca reproduzível e trate o limite de resultados do GitHub.')
h('4. Consulte a busca de repositórios')
code('GET /search/repositories\nq=stars:>1000&sort=stars&order=desc&per_page=100')
add('Monte os parâmetros com <b>URLSearchParams</b>. Salve a consulta, a data da coleta e as páginas retornadas. A primeira resposta traz <b>total_count</b>, <b>incomplete_results</b> e a lista <b>items</b>. Percorra as páginas seguindo o cabeçalho Link.')
h('5. Divida buscas grandes em partes menores')
add('A API retorna no máximo <b>1.000 resultados por consulta</b>. Se a busca tiver mais de 1.000 resultados, divida a faixa de estrelas e consulte cada parte. Exemplo de faixas sem sobreposição:')
code('stars:1001..2000\nstars:2001..5000\nstars:5001..10000\nstars:>10000')
add('Essas faixas são apenas um começo. Se uma delas continuar acima do teto, divida novamente. Se muitos projetos tiverem o mesmo número de estrelas, use outro critério de partição, como intervalos de created, e registre a estratégia. Não trate uma lista truncada como a busca inteira.')
h('6. Confira a integridade da seleção')
bullet('<b>incomplete_results=true:</b> registre o problema e tente novamente ou refine a busca. Não declare completude sem verificar.')
bullet('<b>Duplicação:</b> deduplique pelo ID do repositório e mantenha full_name. Partições ou consultas por linguagens podem repetir projetos.')
bullet('<b>Ordem:</b> defina uma ordenação estável, por exemplo estrelas decrescentes e full_name para desempatar; registre o critério.')
bullet('<b>Quantidade:</b> busque candidatos suficientes para repor os descartados. Uma lista inicial de 100 não garante 100 após os filtros.')
box('EM LINGUAGEM SIMPLES','O GitHub mostra só um pedaço da lista quando ela é grande demais. Em vez de perguntar “mostre todas as fábricas”, você pergunta por grupos menores. Depois junta tudo e tira os nomes repetidos.')
add('Saída desta etapa: lista deduplicada de candidatos e registro das consultas usadas. Comece com um lote pequeno antes de expandir.','SmallGuide')
page()

title(4,'Montar a ficha de cada projeto','Etapa 3 / colete os campos, documente as unidades e produza CSVs compatíveis.')
h('7. Consulte os metadados')
code('GET /repos/{owner}/{repo}\nGET /repos/{owner}/{repo}/contributors?per_page=100&anon=true')
table(['CAMPO SUGERIDO','ORIGEM / COMO PREENCHER'],[
 ['repository_id','id da API; ajuda a evitar duplicação.'],
 ['full_name / default_branch','Nome owner/repo e branch principal retornados pela API. Não presuma main.'],
 ['stars / language','stargazers_count e language. Preserve language vazio se a API não informar.'],
 ['contributors_count','Contagem documentada de contribuidores; defina se inclui anônimos. Não some o número de commits.'],
 ['created_at / age_days','Data de criação; idade em dias até uma referência definida pelo grupo.'],
 ['collected_at','Data e hora UTC da coleta, para registrar a fotografia dos dados.']
],[145,334])
add('Para a idade, uma opção é usar o fim da janela como referência: <b>age_days = (fim_da_janela - created_at) / 86.400.000</b> em milissegundos. Documente arredondamento e referência; repositórios criados depois dela precisam de tratamento explícito. Não misture dias, meses e anos na mesma coluna.')
add('O README sugere contar contribuidores com per_page=1 e a última página de Link. Trate lista vazia, uma única página e respostas indisponíveis. O endpoint possui limitações de identificação/cache: registre o método e não prometa uma contagem perfeita de todas as pessoas da história do projeto.')
h('8. Exporte duas saídas com papéis claros')
bullet('<b>repositories.csv:</b> entrada mínima de B e C, contendo full_name e default_branch. Este formato já é aceito pelo app da parte C.')
bullet('<b>metadata.csv:</b> ficha completa, ligada aos resultados de B/C pelo mesmo full_name. Documente nome, tipo e unidade de cada coluna.')
code('full_name,default_branch\ncli/cli,trunk\npytest-dev/pytest,main')
add('O exemplo mostra o formato, não a seleção oficial. Use CSV UTF-8 com cabeçalho; não inclua token. Valores ausentes ficam vazios, com a ausência registrada; erro de API não vira automaticamente zero.','SmallGuide')
page()

title(5,'Organizar o funil com B e C','Etapa 4 / transforme os filtros em uma seleção rastreável, sem contar um projeto duas vezes.')
h('9. Deixe cada módulo produzir a evidência correta')
bullet('<b>A:</b> candidatos, metadados e coordenação da tabela de seleção.')
bullet('<b>B:</b> quantidade de releases publicadas, sem draft e sem prerelease, dentro da janela oficial.')
bullet('<b>C:</b> existência de Actions e quantidade de runs válidos, de push no default branch, dentro da mesma janela.')
add('O filtro mínimo obrigatório é: <b>pelo menos 5 releases e pelo menos 50 workflow runs válidos</b>. Releases corretivas ou falhas de CI não são critérios adicionais de inclusão. B e C devolvem os valores; A faz a junção e registra a decisão final.')
h('10. Defina uma sequência para os descartes')
add('Exemplo de sequência: candidato único → com Actions → com 5 releases → com 50 runs válidos → selecionado. A ordem deve ser fixa e documentada. Se o projeto falhar em mais de uma regra, atribua o descarte à primeira etapa que ele não passou.')
table(['ETAPA','ENTRARAM','DESCARTADOS','RESTARAM'],[
 ['Candidatos únicos','600','0','600'],
 ['Usam Actions','600','150','450'],
 ['Pelo menos 5 releases','450','200','250'],
 ['Pelo menos 50 runs válidos','250','80','170'],
 ['Amostra S01: regra documentada','170','70 não selecionados','100']
],[212,65,106,96])
add('Números acima são <b>fictícios</b>. Projetos elegíveis não escolhidos por um limite de amostra são “não selecionados”, não “inaptos”. Registre quais foram escolhidos e qual regra definiu os 100.','SmallGuide')
h('11. Salve também a decisão por repositório')
add('Além do resumo <b>selection_funnel.csv</b>, mantenha <b>selection_decisions.csv</b> com full_name, releases_count, valid_runs_count, decisão e motivo. Erros 403/404/5xx ficam como pendências/erros de coleta; não são prova de que o projeto descumpre um critério.')
box('CUIDADO COM O APP DA PARTE C','Seu CSV pode ser enviado ao app para coletar workflows. A saída de C indica o filtro de runs, mas <b>não substitui o filtro de releases de B</b>. O funil de C é parcial. A conclusão da amostra depende da combinação das três partes.')
page()

title(6,'Testar, integrar e entregar','Etapa 5 / prove que a seleção funciona e deixe outra pessoa conseguir repeti-la.')
h('12. Valide primeiro com poucos candidatos')
add('Comece com 5 a 10 projetos. Confira manualmente alguns nomes, branches, estrelas e datas. Veja se as saídas preservam os mesmos identificadores usados por B e C. Só amplie a coleta depois de corrigir os erros desse lote.')
h('13. Escreva testes dos riscos da seleção')
bullet('Busca acima de 1.000 resultados provoca subdivisão em vez de truncamento silencioso.')
bullet('Candidato repetido em duas consultas aparece uma única vez no resultado.')
bullet('Paginação incompleta ou erro da API não produz uma amostra “completa”.')
bullet('Ausência de linguagem, contribuidores indisponíveis e idade com referência fixa recebem tratamento documentado.')
bullet('Funil preserva as contagens e distingue descartados, não selecionados e erros.')
add('Use respostas pequenas e simuladas, sem gastar a API nos testes. Rode <b>npm test</b> e integre os novos testes ao CI existente. A exigência de 80% do README refere-se ao módulo de métricas; sua parte precisa de verificações adequadas da seleção, sem inventar outra meta obrigatória.')
h('14. Faça os módulos funcionarem juntos')
add('Combine um comando que execute A → B/C → consolidação, com a mesma configuração e janela. Seu seletor deve poder ser chamado por esse pipeline. O app web é uma interface útil; o grupo ainda precisa da execução por <b>um único comando documentado</b>.')
box('COMANDO PROPOSTO, A IMPLEMENTAR','<b>node scripts/select-repos.mjs --config config.json</b><br/>Esse comando é uma sugestão para seu módulo. Ele só funcionará depois de você criar o script e tratar o parâmetro. Documente também o comando final do grupo quando a integração estiver pronta.')
h('15. Use a Issue #1 como evidência de trabalho')
add('Mantenha a Issue com assignee, tarefas e estado atualizados no GitHub Projects. Faça commits que mencionem <b>#1</b>, por exemplo <b>feat: coleta candidatos e metadados (#1)</b>. Envie o código, a documentação e as evidências permitidas; cache e credenciais ficam fora do Git.')
add('A introdução do artigo e as hipóteses das RQs são uma entrega conjunta. Sua implementação de código é necessária para a contribuição individual; escrever o artigo sozinho não substitui os commits da Issue.','SmallGuide')
page()

title(7,'Checklist de conclusão','Use esta página para conferir o que falta antes de marcar a Issue #1 como concluída.')
for text in [
 'Critério de popularidade e escolhas de amostragem estão documentados.',
 'Janela oficial e formatos de entrada/saída foram combinados com B e C.',
 'Busca própria via REST/GraphQL funciona com paginação e partição.',
 'Candidatos estão deduplicados e erros/incompletude não ficam escondidos.',
 'Estrelas, linguagem, contribuidores e idade foram coletados e documentados.',
 'repositories.csv é aceito pelos coletores de B e C.',
 'metadata.csv usa nomes, tipos, unidades e referências de data claros.',
 'Funil e motivos por repositório foram gerados pelo código.',
 'Dados de releases e runs foram combinados para aplicar os filtros obrigatórios.',
 'Pipeline integrado atende o lote de 100 da Sprint 1 e é reexecutável.',
 'Testes relevantes passaram, inclusive no GitHub Actions.',
 'Issue #1 e GitHub Projects estão atualizados; commits referenciam #1.'
]: add('[  ] '+text)
box('O QUE ENTREGAR AOS COLEGAS','<b>1.</b> Código de busca, seleção e metadados.<br/><b>2.</b> repositories.csv + metadata.csv.<br/><b>3.</b> selection_funnel.csv + selection_decisions.csv.<br/><b>4.</b> Configuração sem segredos, comando de execução e dicionário.<br/><b>5.</b> Testes, commits ligados à Issue #1 e evidência do CI.')
h('Se travar, confira isto primeiro')
add('<b>Menos de 100 aptos?</b> Busque mais candidatos e registre os descartes.<br/><b>Branch diferente de main?</b> Use default_branch da API.<br/><b>“Zero contribuidores” após erro?</b> Corrija: indisponível é diferente de zero.<br/><b>Mais de 1.000 resultados?</b> Particione a consulta.<br/><b>Token/rate limit?</b> Reaproveite o cliente de C e preserve o cache.')
h('Fontes e limites deste roteiro')
add('Base principal: README do DORA, seções 3, 4, 7 e 10. Nomes de arquivos, sequência de implementação e critérios opcionais apresentados aqui são sugestões. A janela e decisões da turma devem prevalecer.', 'SmallGuide')
add('<link href="https://github.com/alencarleandro/DORA/blob/main/README.md" color="#147968">README do laboratório</link>  |  <link href="https://github.com/alencarleandro/DORA/issues/1" color="#147968">Issue #1</link>  |  <link href="https://github.com/alencarleandro/DORA/blob/main/docs/PARTE-C.md" color="#147968">Contrato e execução da parte C</link>', 'SmallGuide')
add('<link href="https://docs.github.com/en/rest/search/search#search-repositories" color="#147968">GitHub: busca e limite de resultados</link>  |  <link href="https://docs.github.com/en/rest/repos/repos#list-repository-contributors" color="#147968">GitHub: contribuidores e limitações</link>', 'SmallGuide')

def decorate(c,doc):
    w,h=A4; c.setFillColor(TEAL);c.rect(0,h-10,w,10,fill=1,stroke=0)
    c.setStrokeColor(LINE);c.line(58,43,w-58,43)
    c.setFont('Guide',8);c.setFillColor(MUTED);c.drawString(58,28,'DORA  /  Roteiro da pessoa A  /  Sprint 1')
    c.drawRightString(w-58,28,f'{doc.page}  |  02/10/2026')

doc=SimpleDocTemplate(str(OUT),pagesize=A4,rightMargin=58,leftMargin=58,topMargin=41,bottomMargin=59,title='DORA - Roteiro Sprint 1 - Pessoa A',author='Grupo DORA',pageCompression=1)
doc.build(story,onFirstPage=decorate,onLaterPages=decorate)
print(OUT)

