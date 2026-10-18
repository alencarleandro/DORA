import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {parseCSV,toCSV} from '../lib/csv.mjs';
import {analyzeDescriptive,MEASURES} from '../lib/descriptive.mjs';

const fmt=x=>x===null?'não disponível':Number(x).toLocaleString('pt-BR',{maximumFractionDigits:4});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export function runDescriptive({dataset='data/dataset-s02-final/dataset.csv',output='output/rq01-rq04',plots=true,python=process.env.DORA_PYTHON||'python'}={}){
 const source=fs.readFileSync(dataset),input=parseCSV(source.toString('utf8'),{spreadsheetEscapes:true});
 const required=['repository','default_branch','window_start','window_end','releases_in_window',...MEASURES.map(x=>x[0])];
 if(!input.length||required.some(k=>!(k in input[0])))throw new Error('CSV vazio ou sem as colunas obrigatórias.');
 const result=analyzeDescriptive(input);
 fs.mkdirSync(output,{recursive:true});
 const write=(name,content)=>fs.writeFileSync(path.join(output,name),content);
 write('analysis.json',JSON.stringify(result,null,2)+'\n');
 write('descriptive-summary.csv',toCSV(result.summary,Object.keys(result.summary[0])));
 write('c1-classifications.csv',toCSV(result.rows,['repository','default_branch','window_start','window_end','deployment_frequency','df_score','df_category','lead_time_release_median_hours','lt_release_score','lt_release_category','cfr_ci','cfr_ci_score','cfr_ci_category','recovery_median_hours','recovery_score','recovery_category','recovery_missing_reason','c1_dimensions_observed','c1_complete_score','c1_complete_category','c1_available_score','c1_available_category','c1_status']));
 write('quality-warnings.csv',toCSV(result.warnings,['repository','field','raw_value','reason','action']));
 write('c1-distribution.csv',toCSV(['complete','available'].flatMap(scope=>result.c1[scope+'_distribution'].map(r=>({scope,...r,denominator:scope==='complete'?result.c1.complete_n:result.n,percent:100*r.n/(scope==='complete'?result.c1.complete_n:result.n)||0}))),['scope','category','n','denominator','percent']));
 // Comparison is diagnostic only: never modify the colleague's files or use them as observations.
 const comparisonFile='output/rq07-rq08/rq07-classifications.csv';
 let comparison={available:false};
 if(fs.existsSync(comparisonFile)){
  const old=new Map(parseCSV(fs.readFileSync(comparisonFile,'utf8'),{spreadsheetEscapes:true}).map(r=>[r.repository.toLowerCase(),r]));
  const compared=result.rows.map(r=>({repository:r.repository,c1_available_score:r.c1_available_score,rq07_score:old.get(r.repository.toLowerCase())?.c1_score??'',difference:old.has(r.repository.toLowerCase())?r.c1_available_score-Number(old.get(r.repository.toLowerCase()).c1_score):''}));
  comparison={available:true,source:comparisonFile,source_sha256:sha(fs.readFileSync(comparisonFile)),matched:compared.filter(r=>r.rq07_score!=='').length,differences:compared.filter(r=>r.difference!==''&&r.difference!==0).length};
  write('c1-rq07-comparison.csv',toCSV(compared,['repository','c1_available_score','rq07_score','difference']));
 }
 const table='| Medida | n válido | Ausentes/inválidos | Q1 | Mediana | Q3 | IQR | Unidade |\n|---|---:|---:|---:|---:|---:|---:|---|\n'+result.summary.map(r=>`| ${r.label} | ${r.n} | ${r.missing} | ${fmt(r.q1)} | ${fmt(r.median)} | ${fmt(r.q3)} | ${fmt(r.iqr)} | ${r.unit} |`).join('\n');
 const s=field=>result.summary.find(r=>r.field===field),t=field=>result.counts[field];
 const distribution=result.c1.complete_distribution.map(r=>`${r.category}: ${r.n}`).join('; ');
 const cfrPending=result.cfr_b_validation.some(v=>v!=='validated');
 const text=`# Sprint 3 - Issue #7: RQ 01 a 04 e classificação C1

## Método

Análise local de **${result.n} repositórios**, janela UTC **${result.window.start} a ${result.window.end}**. Fonte: \`${dataset.replaceAll('\\','/')}\`; SHA-256: \`${sha(source)}\`.

Cada observação é um repositório e cada projeto tem o mesmo peso. Os quartis abaixo descrevem a distribuição das métricas por repositório. Para lead time e recuperação, são quartis das medianas dos projetos, não quartis de todas as durações individuais. Não é possível reconstruir a distribuição global de eventos apenas com este CSV agregado. Quartis: interpolação linear na posição (n-1)p, convenção tipo 7. Ausentes ficam ausentes; negativos e proporções fora de [0,1] são excluídos apenas da análise afetada e registrados em quality-warnings.csv. Nenhuma fonte foi alterada.

## Estatística descritiva

${table}

As taxas estão em proporção: 0,15 corresponde a 15%. O IQR de uma proporção pode ser convertido para pontos percentuais multiplicando-o por 100.

## Resultados e discussão para o artigo

### RQ 01 - Frequência de deploys

A frequência mediana foi **${fmt(s('deployment_frequency').median)} releases/semana**, com IQR **${fmt(s('deployment_frequency').iqr)}** (n=${s('deployment_frequency').n}). O inventário soma ${fmt(t('releases_in_window').total)} releases em ${t('releases_in_window').available} repositórios com contagem disponível. A frequência é uma proxy: publicar uma release no GitHub não comprova implantação ou uso em produção. Os resultados representam a coorte selecionada, não todos os projetos open source.

### RQ 02 - Lead time

A mediana das medianas por release foi **${fmt(s('lead_time_release_median_hours').median)} h**, e por commit **${fmt(s('lead_time_commit_median_hours').median)} h**. Na comparação pareada, a variante por release foi maior em **${result.paired.lead_time_release_minus_commit.a_greater}/${result.paired.lead_time_release_minus_commit.n}** projetos. Cada variante preserva os pesos definidos no coletor: commit mais antigo por release em (a), todos os commits de todas as releases por projeto em (b). Comparar os valores pareados evita atribuir a diferença apenas às medianas marginais. Não se presume que (a) sempre excede (b), porque a ponderação dos eventos é distinta.

Há ${result.warnings.filter(w=>w.field==='lead_time_commit_median_hours').length} valor(es) inválido(s) de lead time por commit. O valor negativo não foi convertido em zero nem valor absoluto: foi preservado na fonte e excluído das estatísticas desta variante. Datas de autoria/publicação e comparação entre branches exigem auditoria com B. A ausência de uma comparação não significa ausência de mudanças.

### RQ 03 - Taxa de falha

O CFR de CI tem mediana **${fmt(100*s('cfr_ci').median)}%**, e o proxy de entrega **${fmt(100*s('cfr_b').median)}%**, com n válido ${s('cfr_ci').n} e ${s('cfr_b').n}, respectivamente. Na comparação pareada há ${result.paired.cfr_ci_minus_delivery.n} projetos. Falha de testes/build não é falha em produção; o proxy de entrega relaciona uma release a uma posterior corretiva em até sete dias. São fenômenos e denominadores diferentes.

**Situação do CFR (b): ${cfrPending?'EXPLORATÓRIO - validação da heurística pendente':'conferir evidências de validação no manifesto'}.** Estados presentes no CSV: ${result.cfr_b_validation.join(', ')}. O fechamento de uma issue não comprova validação científica. Não foi calculado F1, consenso ou concordância nesta análise. As exclusões de releases no fim da janela (${fmt(t('cfr_b_releases_censored').total)} censuradas, contagens disponíveis em ${t('cfr_b_releases_censored').available} projetos) e resultados desconhecidos (${fmt(t('cfr_b_releases_unknown').total)}) permanecem separados. As médias por repositório não são taxas agregadas de todos os eventos.

### RQ 04 - Tempo de recuperação

A recuperação observada tem mediana de **${fmt(s('recovery_median_hours').median)} h** e IQR **${fmt(s('recovery_median_hours').iqr)} h**, com **${s('recovery_median_hours').n}/${result.n}** projetos observados. Os ${s('recovery_median_hours').missing} restantes não receberam recuperação zero nem nota Elite automaticamente. O motivo por projeto está em c1-classifications.csv: ausência de episódio observado, todos os episódios censurados ou outro dado ausente/inválido.

A fração censurada tem mediana **${fmt(100*s('censored_fraction').median)}%** nos **${s('censored_fraction').n}** projetos com denominador. Foram registrados ${fmt(t('episodes_total').total)} episódios e ${fmt(t('episodes_censored').total)} censurados (contagens disponíveis em ${t('episodes_total').available} e ${t('episodes_censored').available} projetos). A censura não foi tratada como recuperação concluída. A análise é descritiva de episódios recuperados; não estima uma curva de sobrevivência nem o tempo de recuperação dos episódios censurados. Falhas iniciais sem sucesso anterior (${fmt(t('initial_failures_without_success').total)}) são registradas à parte pelo coletor.

## Classificação DORA de referência C1

C1 usa frequência de releases, lead time por release (a), CFR do CI (a) e recuperação observada. Reutiliza os cortes de lib/sensitivity.mjs para duração e CFR. Frequência: Elite >=7/semana; High >=1/semana; Medium >=1/mês; Low abaixo disso. Para ano civil completo, 12 releases é exatamente o limite mensal, evitando o arredondamento 52,14 semanas do módulo legado.

Lead time: <24 h, <168 h, <720 h e >=720 h; CFR: <=15%, <=30%, <=45% e >45%; recuperação: <1 h, <24 h, <168 h e >=168 h. Notas Elite=4, High=3, Medium=2, Low=1. A categoria geral é floor(mediana das quatro notas).

**C1 completa:** ${result.c1.complete_n} projetos; ${distribution}. **Sem C1 completa:** ${result.c1.partial_n}. Publicamos separadamente c1_available_score, uma extensão exploratória baseada apenas nas dimensões observadas, para integração com RQ07. Ela não deve ser misturada com a C1 completa nem interpretada como quatro dimensões medidas. Não foi feita imputação.

Conferência do export de Luis: ${comparison.available?`${comparison.matched} chaves correspondentes; ${comparison.differences} diferenças na classificação disponível. Consulte c1-rq07-comparison.csv; diferenças de política/limiar não foram escondidas.`:'arquivo RQ07 não disponível; classificação reproduzível independe desse arquivo.'} Os resultados de RQ07 não foram recalculados ou sobrescritos por este script.

## Limites e integração

Não há inferência causal, teste de correlação, comparação entre grupos ou conclusão de robustez nesta entrega; RQ05/RQ06 pertencem à #8 e sensibilidade à #9. A análise parte de agregados previamente coletados e não reaudita eventos brutos, retenção do Actions ou a validade da heurística. A seleção por popularidade e mínimos de releases/runs restringe a generalização. A idade/linguagem dos projetos não são variáveis de ajuste aqui.

Para Isabella: use descriptive-summary.csv e analysis.json; preserve n por variante. Para Luis: use c1-classifications.csv e declare a política de ausentes usada na sensibilidade. Para o artigo (#10): esta seção fornece texto de resultados e discussão que deve ser revisado pelo trio; não declare o CFR (b) validado sem evidência.

## Artefatos

- descriptive-summary.csv: mediana, Q1, Q3, IQR, mínimo, máximo, zeros, n, ausentes e inválidos.
- c1-classifications.csv e c1-distribution.csv: notas por dimensão e classificações completa/parcial.
- quality-warnings.csv: dados inválidos ou inconsistentes, sem correção silenciosa.
- analysis.json e manifest.json: valores para gráficos e proveniência.
- figures/: ECDFs por RQ e distribuição C1, nos formatos PNG e SVG (quando gráficos habilitados).

Não requer token ou arquivos de data/jobs. Comando: npm run rq01 -- --dataset data/dataset-s02-final/dataset.csv --output output/rq01-rq04. Requer Python 3 com matplotlib para figuras; --python seleciona executável e --skip-plots permite gerar somente as análises.
`;
 write('REPORT.md',text);
 const manifest={issue:7,dataset:path.relative(process.cwd(),path.resolve(dataset)).replaceAll('\\','/'),dataset_sha256:sha(source),rows:result.n,window:result.window,cfr_b_validation:result.cfr_b_validation,quartiles:'Hyndman-Fan type 7, linear interpolation',analysis_unit:'repository; unweighted',missing_policy:'no imputation; strict C1 requires four valid metrics; available C1 exploratory',invalid_policy:'exclude affected metric, preserve source, emit warning',plots_requested:plots,plots_completed:false,rq07_comparison:comparison,scripts_sha256:Object.fromEntries(['lib/descriptive.mjs','lib/sensitivity.mjs','lib/metrics.mjs','scripts/analyze-rq01-rq04.mjs','scripts/plot-rq01-rq04.py'].map(f=>[f,sha(fs.readFileSync(new URL('../'+f,import.meta.url)))]))};
 write('manifest.json',JSON.stringify(manifest,null,2)+'\n');
 if(plots){
  const plotter=fileURLToPath(new URL('./plot-rq01-rq04.py',import.meta.url));
  const p=spawnSync(python,[plotter,path.resolve(output)],{encoding:'utf8',env:{...process.env,MPLBACKEND:'Agg'}});
  if(p.status!==0)throw new Error('Análise salva; geração de gráficos falhou. Instale matplotlib ou use --python. '+(p.error?.message||p.stderr));
  manifest.plots_completed=true;write('manifest.json',JSON.stringify(manifest,null,2)+'\n');
 }
 return {rows:result.n,c1_complete:result.c1.complete_n,warnings:result.warnings.length,output:path.resolve(output),plots:manifest.plots_completed};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 try{const options={};for(let i=2;i<process.argv.length;i++){const arg=process.argv[i];if(arg==='--skip-plots')options.plots=false;else if(['--dataset','--output','--python'].includes(arg)&&process.argv[i+1])options[arg.slice(2)]=process.argv[++i];else throw new Error('Argumento inválido: '+arg);}console.log(JSON.stringify(runDescriptive(options),null,2));}catch(error){console.error(error.message);process.exitCode=1;}
}
