// Offline assembly from versioned A/B/C exports. Does not replace missing measurements with zero.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {parseCSV,toCSV} from '../lib/csv.mjs';
import {INTEGRATED_HEADERS} from '../lib/integration.mjs';
import {windowDates} from '../lib/metrics.mjs';
const dir='data/dataset-s02-final',read=file=>parseCSV(fs.readFileSync(dir+'/'+file,'utf8'),{spreadsheetEscapes:true});
const manifest=JSON.parse(fs.readFileSync(dir+'/manifest.json'));
const repos=read('selecao/repositories.csv'),metadata=read('selecao/metadata.csv'),b=read('metricas/metrics-b.csv'),c=read('metricas/metrics-c.csv');
const key=row=>(row.repository||row.full_name).toLowerCase();
function index(rows,name){const map=new Map();for(const row of rows){if(map.has(key(row)))throw Error('Duplicação em '+name+': '+key(row));map.set(key(row),row);}return map;}
const am=index(metadata,'A'),bm=index(b,'B'),cm=index(c,'C'),rm=index(repos,'seleção');
if(repos.length!==300||b.length!==300||c.length!==300)throw Error('A, B e C precisam ter 300 linhas.');
for(const map of [bm,cm])for(const name of map.keys())if(!rm.has(name))throw Error('Projeto fora da seleção: '+name);
const rows=repos.map(repo=>{
 const name=key(repo),a=am.get(name),br=bm.get(name),cr=cm.get(name);if(!a||!br||!cr)throw Error('Projeto ausente em A/B/C: '+name);
 if([a,br,cr].some(x=>x.default_branch!==repo.default_branch))throw Error('Branch divergente: '+name);
 if(br.eligible_releases!=='true'||cr.eligible_runs!=='true'||Number(br.releases_in_window)<5||Number(cr.runs_valid)<50)throw Error('Projeto não elegível: '+name);
 return {repository:repo.full_name,default_branch:repo.default_branch,stars:a.stars,language:a.language,contributors_count:a.contributors_count,age_days:a.age_days,...br,...cr,
 window_start:manifest.window_start,window_end:manifest.window_end,selected:'true',cfr_b_validation:'pending_independent_labels',source_job_id:manifest.source_job_id,b_job_id:manifest.b_job_id,c_job_id:manifest.c_job_id};
});
const headers=['window_start','window_end',...INTEGRATED_HEADERS,'cfr_b_validation','source_job_id','b_job_id','c_job_id'];
const dates=windowDates(manifest.window_start,manifest.window_end),weeks=(dates.end-dates.start)/(7*86400000);
const failures=[],warnings=[],missing={};
const eq=(name,l,r,repo)=>{if(!Number.isFinite(l)||!Number.isFinite(r)||Math.abs(l-r)>1e-10*Math.max(1,Math.abs(l),Math.abs(r)))failures.push({repository:repo,check:name,left:l,right:r});};
for(const row of rows){
 const name=row.repository;
 for(const col of headers){if(row[col]==null)throw Error('Coluna ausente: '+col+' em '+name);if(row[col]==='')missing[col]=(missing[col]||0)+1;}
 eq('runs_valid',Number(row.runs_valid),Number(row.failures)+Number(row.successes),name);
 eq('runs_total',Number(row.runs_total),Number(row.runs_valid)+Number(row.runs_ignored),name);
 eq('cfr_ci',Number(row.cfr_ci),Number(row.failures)/Number(row.runs_valid),name);
 eq('releases_inventory',Number(row.releases_in_window),Number(row.releases_evaluated)+Number(row.releases_ignored),name);
 eq('releases_ignored',Number(row.releases_ignored),Number(row.releases_ignored_no_previous)+Number(row.releases_ignored_compare_error)+Number(row.releases_ignored_no_commits),name);
 eq('deployment_frequency',Number(row.deployment_frequency),Number(row.releases_in_window)/weeks,name);
 eq('cfr_b_inventory',Number(row.releases_in_window),Number(row.cfr_b_releases_evaluated)+Number(row.cfr_b_releases_censored)+Number(row.cfr_b_releases_unknown),name);
 if(Number(row.cfr_b_releases_evaluated)>0)eq('cfr_b',Number(row.cfr_b),Number(row.cfr_b_releases_failed)/Number(row.cfr_b_releases_evaluated),name);
 else if(row.cfr_b!=='')failures.push({repository:name,check:'cfr_b_zero_denominator'});
 if(Number(row.episodes_total)>0)eq('censored_fraction',Number(row.censored_fraction),Number(row.episodes_censored)/Number(row.episodes_total),name);
 else if(row.censored_fraction!=='')failures.push({repository:name,check:'censored_fraction_zero_denominator'});
 for(const measure of ['lead_time_release','lead_time_commit','recovery']){
  const values=['q1','median','q3','iqr'].map(stat=>row[measure+'_'+stat+'_hours']);
  if(values.every(x=>x!=='')){const [q1,median,q3,iqr]=values.map(Number);eq(measure+'_iqr',iqr,q3-q1,name);if(q1>median||median>q3)failures.push({repository:name,check:measure+'_quantile_order'});if(q1<0)warnings.push({repository:name,check:measure+'_negative_observed',message:'Valor do export original preservado; revisar datas de autoria e publicação.'});}
  if(measure.startsWith('lead_time'))for(const stat of ['median','iqr'])if(row[measure+'_'+stat+'_hours']!==''&&row[measure+'_'+stat+'_days']!=='')eq(measure+'_'+stat+'_days',Number(row[measure+'_'+stat+'_days']),Number(row[measure+'_'+stat+'_hours'])/24,name);
 }
 for(const rate of ['cfr_ci','cfr_b','censored_fraction'])if(row[rate]!==''&&(Number(row[rate])<0||Number(row[rate])>1))failures.push({repository:name,check:rate+'_range'});
}
// Compare against the delivered consolidated file before writing, preserving every measured value.
const original=read('dataset.csv'),om=index(original,'dataset entregue');
for(const row of rows)for(const col of headers)if(row[col]!==om.get(key(row))?.[col])failures.push({repository:row.repository,check:'export_parity',column:col,assembled:row[col],delivered:om.get(key(row))?.[col]});
const schema=JSON.parse(fs.readFileSync('docs/dataset-s02-schema.json'));
if(headers.length!==Object.keys(schema).length||headers.some(h=>!schema[h]))throw Error('Dicionário não cobre exatamente as colunas.');
const hashes=Object.fromEntries(['selecao/repositories.csv','selecao/metadata.csv','selecao/decisions.csv','selecao/funnel.csv','selecao/queries.csv','metricas/metrics-b.csv','metricas/metrics-c.csv'].map(file=>[file,createHash('sha256').update(fs.readFileSync(dir+'/'+file)).digest('hex')]));
const report={issue:6,status:failures.length?'failed':'passed',rows:rows.length,unique_repositories:rm.size,columns:headers.length,window_start:manifest.window_start,window_end:manifest.window_end,assembly:'offline_from_versioned_exports',raw_metrics_recomputed:false,source_hashes:hashes,missing_values:missing,warnings,failures,cfr_b_validation:'pending_independent_labels'};
fs.mkdirSync(dir+'/validacao',{recursive:true});
fs.writeFileSync(dir+'/validacao/quality-report.json',JSON.stringify(report,null,2)+'\n');
if(failures.length)throw Error('Falha na consolidação: consultar validacao/quality-report.json ('+failures.length+' divergências). Dataset não alterado.');
fs.writeFileSync(dir+'/dataset.csv',toCSV(rows,headers));
const dictionary=headers.map(column=>({column,...schema[column],missing_value:'campo vazio preservado; não substituir por zero'}));
fs.writeFileSync(dir+'/dictionary.csv',toCSV(dictionary));
fs.writeFileSync(dir+'/manifest.json',JSON.stringify({...manifest,assembly_method:report.assembly,source_hashes:hashes,quality_report:'validacao/quality-report.json',dictionary:'dictionary.csv',comparison_quality:'metricas/comparison-quality.json'},null,2)+'\n');
const table=['| Coluna | Tipo | Unidade | Origem ou fórmula |','|---|---|---|---|',...dictionary.map(x=>`| ${x.column} | ${x.type} | ${x.unit} | ${x.source_or_formula.replaceAll('|','/')} |`)].join('\n');
const doc='docs/DATA-DICTIONARY.md',text=fs.readFileSync(doc,'utf8'),marker='<!-- dataset-s02-final-schema -->';
fs.writeFileSync(doc,text.split(marker)[0].trimEnd()+'\n\n'+marker+'\n\n# Dataset consolidado — Sprint 2 / Issue #6\n\nUma linha por repositório, chave `repository` normalizada em minúsculas para junção. Os 300 projetos e a janela 2025-01-01 a 2025-12-31 são preservados. Dicionário legível por máquina: `data/dataset-s02-final/dictionary.csv`.\n\nO CSV final contém '+headers.length+' colunas. Contagens ausentes e taxas sem denominador continuam vazias. Quartis usam interpolação linear em `(n − 1) × p`. Recuperação resume apenas episódios encerrados. As contagens de censura preservam os episódios não encerrados. Metadados de popularidade são uma fotografia da coleta, não uma medida histórica de 2025.\n\n'+table+'\n');
console.log(JSON.stringify({status:report.status,rows:report.rows,columns:report.columns,warnings:warnings.length,failures:0}));
