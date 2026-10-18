// Audit prerequisites only: never create labels, consensus or a fictitious F1.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {parseCSV} from '../lib/csv.mjs';
const folder='data/gold-standard-final-300-2025',output='data/dataset-s02-final/validacao/cfr-b';
const read=f=>parseCSV(fs.readFileSync(f,'utf8'),{spreadsheetEscapes:true});
const hash=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const sampleFile=path.join(folder,'gold_standard_sample.csv'),sample=read(sampleFile);
const key=r=>r.repository.toLowerCase()+'\0'+r.release_tag+'\0'+r.release_published_at;
const sampleKeys=new Set(sample.map(key));
if(sampleKeys.size!==sample.length)throw new Error('Referências duplicadas na amostra.');
const raters=['leandro','luis','isabella'].map(name=>{
 const file=path.join(folder,'rotulos-'+name+'.csv'),rows=read(file),keys=new Set(rows.map(key));
 const valid=r=>['sim','não','nao'].includes(r.is_corrective?.trim().toLowerCase());
 return {name,file,sha256:hash(file),rows:rows.length,matching_sample:rows.length===sample.length&&keys.size===sample.length&&rows.every(r=>sampleKeys.has(key(r))),corrective_filled:rows.filter(valid).length,corrective_missing_or_invalid:rows.filter(r=>!valid(r)).length,complete_dimensions:rows.filter(r=>valid(r)&&['sim','não','nao','incerto'].includes(r.real_delivery?.trim().toLowerCase())&&['biblioteca/framework','ferramenta cli','aplicação/serviço','outro'].includes(r.project_type?.trim().toLowerCase())).length};
});
const consensusFile=path.join(folder,'consensus.csv');
const consensus={exists:fs.existsSync(consensusFile),matching_sample:false,complete:false,sha256:null};
if(consensus.exists){const rows=read(consensusFile);consensus.sha256=hash(consensusFile);consensus.matching_sample=rows.length===sample.length&&new Set(rows.map(key)).size===sample.length&&rows.every(r=>sampleKeys.has(key(r)));consensus.complete=consensus.matching_sample&&rows.every(r=>['sim','não','nao'].includes(r.consensus_is_corrective?.trim().toLowerCase()));}
const manifest=JSON.parse(fs.readFileSync('data/dataset-s02-final/manifest.json','utf8'));
const localJob=path.join('data/jobs',manifest.source_job_id),cache=new Map();
let matching=0,missing=0,unavailable=0;
for(const r of sample){
 const file=path.join(localJob,encodeURIComponent(r.repository)+'.releases.json');
 if(!fs.existsSync(file)){missing++;continue;}
 if(!cache.has(r.repository))cache.set(r.repository,JSON.parse(fs.readFileSync(file)).releases);
 const release=cache.get(r.repository).find(x=>x.tag_name===r.release_tag&&x.published_at===r.release_published_at);
 if(!release){missing++;continue;}matching++;if(release.compare_error||!Array.isArray(release.commits))unavailable++;
}
const oldReports=['data/cfr-b/local-2025/validation.json','data/cfr-b/reference-validation/validation.json'].filter(f=>fs.existsSync(f)).map(file=>{const r=JSON.parse(fs.readFileSync(file));return {file,sha256:hash(file),status:r.status,reference_rows:r.reference_rows,verified_rows:r.verified_rows,belongs_to_final_sample:false};});
const blockers=[];
for(const r of raters){if(!r.matching_sample)blockers.push(r.name+': referências divergentes da amostra');if(r.corrective_missing_or_invalid)blockers.push(r.name+': '+r.corrective_missing_or_invalid+' rótulos corretivos ausentes/inválidos');}
if(!consensus.complete)blockers.push('Consenso completo correspondente à amostra final ausente');
if(missing||unavailable)blockers.push('Evidências locais insuficientes: '+missing+' ausentes e '+unavailable+' comparações indisponíveis');
const audit={status:blockers.length?'blocked_missing_prerequisites':'ready_for_calibration_not_yet_validated',issue:5,sample_file:sampleFile,sample_sha256:hash(sampleFile),sample_rows:sample.length,source_job_id:manifest.source_job_id,raters,consensus,local_evidence:{matching,missing,comparison_unavailable:unavailable},historical_reports:oldReports,blockers,f1:null,f1_calculated:false,dataset_validation_unchanged:manifest.cfr_b_validation,method:'Read-only prerequisite audit; no human labels inferred or changed'};
fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'prerequisite-audit.json'),JSON.stringify(audit,null,2)+'\n');
fs.writeFileSync(path.join(output,'STATUS.md'),`# CFR (b) - conferência da validação final\n\n**Estado: ${audit.status}.** Não há comprovação de F1 final validado. O dataset continua exploratório e não foi modificado.\n\nA amostra final tem ${sample.length} releases. Evidências locais correspondentes: ${matching}; ausentes: ${missing}; comparações indisponíveis: ${unavailable}.\n\n| Avaliador | Linhas | Corretiva preenchida | Corretiva ausente/inválida | Referências corretas |\n|---|---:|---:|---:|---|\n${raters.map(r=>`| ${r.name} | ${r.rows} | ${r.corrective_filled} | ${r.corrective_missing_or_invalid} | ${r.matching_sample} |`).join('\n')}\n\nConsenso da amostra final: ${consensus.exists?'presente':'ausente'}. Os relatórios históricos encontrados têm ${oldReports.map(r=>r.verified_rows+'/'+r.reference_rows+' referências verificadas').join('; ')||'nenhuma avaliação disponível'}; não validam a amostra final.\n\n## O que impede a execução\n\n${blockers.map(x=>'- '+x).join('\n')||'- Pré-requisitos presentes; falta executar e auditar a calibração.'}\n\n## Como concluir\n\n1. Cada avaliador conclui e revisa seu próprio arquivo oficial, preservando as referências. Sugestões de IA não substituem revisão humana independente.\n2. O grupo calcula concordância e discute divergências; gera consensus.csv na pasta da amostra final com rótulos e protocolo documentados.\n3. Execute: \`npm run cfr-b -- --job ${manifest.source_job_id} --consensus ${consensusFile.replaceAll('\\','/')} --output ${output} --require-valid\`.\n4. Confira reference-audit.csv, heuristic-versions.csv e validation.json. Selecionar a versão pelo F1 no mesmo consenso é calibração, não teste independente. Exija cobertura das referências e F1 >=0,70.\n5. Se a regra escolhida mudar, recalcule o CFR (b) e atualize explicitamente dataset e análises dependentes. Não altere só o campo de estado.\n\nEsta auditoria pode ser refeita com \`node scripts/audit-final-cfr-validation.mjs\`. Ela não altera os rótulos, a amostra, o consenso ou o dataset. Hashes e contagens estão em prerequisite-audit.json.\n`);
console.log(JSON.stringify({status:audit.status,raters:raters.map(({name,corrective_filled})=>({name,corrective_filled})),consensus:consensus.exists,local_evidence:audit.local_evidence,output},null,2));
