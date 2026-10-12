import fs from 'node:fs';
import path from 'node:path';
import {replaceFile} from './atomic-file.mjs';
export function auditGitComparisons(job,folder,evidence){
 const missing=[];let checked=0;
 for(const repo of job.results){
  const file=path.join(folder,encodeURIComponent(repo.repository)+'.releases.json'),raw=JSON.parse(fs.readFileSync(file,'utf8'));let changed=false;
  for(const release of raw.releases){
   if(release.collection_method==='git-log-base-to-head'&&!release.compare_error){
    if(!release.base_sha||!release.head_sha)throw new Error('Comparação Git sem SHAs de proveniência.');
    try{evidence.checkAncestry(evidence.ensure(repo.repository),release.base_sha,release.head_sha);checked++;}
    catch(error){if(error.code!=='COMPARE_UNAVAILABLE')throw error;release.compare_error=error.compare_error;release.commits=[];changed=true;}
   }
   if(release.compare_error)missing.push({repository:repo.repository,tag_name:release.tag_name,base_tag:release.base_tag,error:release.compare_error});
  }
  if(changed){if(!fs.existsSync(file+'.before-ancestry-audit'))fs.copyFileSync(file,file+'.before-ancestry-audit');fs.writeFileSync(file+'.audit.tmp',JSON.stringify(raw));replaceFile(file+'.audit.tmp',file);}
 }
 const report={git_comparisons_checked:checked,unavailable_comparisons:missing.length,comparisons:missing,generated_at:new Date().toISOString()};
 fs.writeFileSync(path.join(folder,'comparison-quality.json'),JSON.stringify(report,null,2));return report;
}
