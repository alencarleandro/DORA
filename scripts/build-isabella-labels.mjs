// Replays editorial AI-assisted decisions; does not run the CFR heuristic or read other raters.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {parseCSV,toCSV} from '../lib/csv.mjs';
const dir='data/gold-standard-final-300-2025';
const reviewDir=dir+'/revisao-isabella';fs.mkdirSync(reviewDir,{recursive:true});
const hash=buffer=>createHash('sha256').update(buffer).digest('hex');
const sampleBytes=fs.readFileSync(dir+'/gold_standard_sample.csv');
if(hash(sampleBytes)!=='1b912e772066c477bdf8dc686a2e6afdf43bc4809026dd9daaa90cc869a3e686')throw Error('A amostra mudou. Revisar as decisões antes de reaplicá-las.');
const sample=parseCSV(sampleBytes.toString('utf8'),{spreadsheetEscapes:true});
const decisions=JSON.parse(fs.readFileSync(reviewDir+'/decisoes.json'));
const types={cli:'ferramenta CLI',app:'aplicação/serviço',lib:'biblioteca/framework',outro:'outro'};
const auditPath=reviewDir+'/evidencias-isabella.csv';
const source='data/issue-6-evidence';
const raw=fs.existsSync(source)?fs.readdirSync(source).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(fs.readFileSync(source+'/'+f))):[];
const prior=fs.existsSync(auditPath)?parseCSV(fs.readFileSync(auditPath,'utf8'),{spreadsheetEscapes:true}):[];
const counts=new Map(),audit=[],rows=[];
const key=r=>r.repository.toLowerCase()+'\0'+r.release_tag;
if(sample.length!==300||new Set(sample.map(key)).size!==300)throw Error('Amostra inválida.');
for(const row of sample){
 const choice=decisions[row.repository];if(!choice||choice[3].length!==5)throw Error('Decisão ausente ou inválida: '+row.repository);
 const i=counts.get(row.repository)||0;counts.set(row.repository,i+1);
 const [label,reason]=choice[3][i];if(!['sim','não',''].includes(label))throw Error('Categoria corretiva inválida.');
 const e=raw.find(x=>key(x)===key(row)),old=prior.find(x=>key(x)===key(row));
 if(!e&&!old)throw Error('Evidência ausente: '+row.repository+' '+row.release_tag);
 if(e&&(e.status!==200||e.dates[0]!==row.release_published_at))throw Error('Referência não confirmada: '+key(row));
 const notes=`Análise assistida por IA; revisão humana pendente. ${choice[2]} ${reason} Fonte: ${row.release_url}`;
 rows.push({...row,project_type:types[choice[0]],real_delivery:choice[1],is_corrective:label,notes});
 const supplemental=[e?.supplemental,e?.final_check].filter(x=>x?.status===200);
 audit.push({repository:row.repository,release_tag:row.release_tag,release_published_at:row.release_published_at,release_url:row.release_url,
  repository_url:row.repo_url,reference_status:'tag_and_date_verified',retrieved_at:e?.retrieved_at||old.retrieved_at,
  notes_sha256:e?hash(e.notes):old.notes_sha256,html_sha256:e?.html_sha256||old.html_sha256,
  supplementary_urls:e?supplemental.map(x=>x.url).join(' '):old.supplementary_urls,
  supplementary_sha256:e?supplemental.map(x=>hash(x.content)).join(' '):old.supplementary_sha256,
  comparison_urls:e?e.compare_urls.join(' '):old.comparison_urls,
  decision:label,decision_reason:reason,project_type_reason:choice[2],review_status:label?'pending_human_review':'insufficient_evidence'});
}
if(counts.size!==60||[...counts.values()].some(n=>n!==5))throw Error('A amostra exige 60 projetos e cinco releases por projeto.');
// Explicit filename keeps provisional decisions out of the consensus tools' default rater input.
fs.writeFileSync(reviewDir+'/rotulos-isabella-assistidos.csv',toCSV(rows,['repository','repo_url','release_tag','release_url','release_published_at','project_type','real_delivery','is_corrective','notes']));
fs.writeFileSync(auditPath,toCSV(audit));
const summary={issue:6,method:'AI-assisted editorial review of public evidence',human_review:'pending',independent_human_labels:false,other_raters_consulted:false,heuristic_predictions_consulted:false,sample_sha256:hash(sampleBytes),repositories:60,releases:300,
 references_verified:300,corrective_proposals:rows.filter(x=>x.is_corrective==='sim').length,non_corrective_proposals:rows.filter(x=>x.is_corrective==='não').length,undecided:rows.filter(x=>!x.is_corrective).map(x=>({repository:x.repository,release_tag:x.release_tag})),
 official_rater_file:'rotulos-isabella.csv',assisted_draft:'revisao-isabella/rotulos-isabella-assistidos.csv',sources:'revisao-isabella/evidencias-isabella.csv',consensus_status:'pending_other_independent_raters_and_human_review'};
const reviewPath=reviewDir+'/revisao-isabella.json';
if(fs.existsSync(reviewPath)){
 const review=JSON.parse(fs.readFileSync(reviewPath));
 const draftHash=hash(fs.readFileSync(reviewDir+'/rotulos-isabella-assistidos.csv'));
 const finalHash=hash(fs.readFileSync(dir+'/rotulos-isabella.csv'));
 if(review.reviewed_draft_sha256===draftHash&&review.final_labels_sha256===finalHash){summary.human_review='reviewed_by_isabella';summary.review_record='revisao-isabella/revisao-isabella.json';summary.consensus_status='pending_other_independent_raters_and_consensus';}
}
fs.writeFileSync(reviewDir+'/analise-isabella.json',JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary));
