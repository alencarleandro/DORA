import { timestamp } from './metrics.mjs';
export const HEURISTIC_VERSIONS=['patch-v1','patch-or-fix-v2','fix-majority-v3'];
export const CFR_B_HEADERS=['repository','releases_total','releases_evaluated','releases_failed','releases_censored','releases_unknown','cfr_b','heuristic_version'];
const week=7*86400000;
const version=tag=>String(tag||'').match(/^v?(\d+)\.(\d+)\.(\d+)(?:\+[\w.-]+)?$/);
export function isPatch(base,head){const a=version(base),b=version(head);return !!(a&&b&&a[1]===b[1]&&a[2]===b[2]&&Number(b[3])>Number(a[3]));}
function fixText(message){
 const text=String(message||'').toLowerCase();
 if(/^(?:docs?|style|test|chore)(?:\([^)]*\))?!?:/.test(text))return false;
 return /\b(?:fix(?:es|ed)?|bugfix|hotfix|revert(?:s|ed)?|regression)\b/.test(text)&&!/\b(?:typo|spelling|documentation only)\b/.test(text);
}
export function classifyCorrective(release,heuristic='fix-majority-v3'){
 if(!HEURISTIC_VERSIONS.includes(heuristic))throw new Error('Versão da heurística inválida.');
 if(release.compare_error||!Array.isArray(release.commits))return {corrective:null,reason:'comparison_unavailable'};
 const patch=isPatch(release.base_tag,release.tag_name),commits=release.commits||[];
 const fixes=commits.filter(c=>fixText(c.message)).length,notes=fixText((release.name||'')+'\n'+(release.body||''));
 const ratio=commits.length?fixes/commits.length:0;
 const corrective=heuristic==='patch-v1'?patch:heuristic==='patch-or-fix-v2'?patch||fixes>0||notes:ratio>=.5&&fixes>0||notes;
 return {corrective,reason:corrective?(heuristic==='patch-v1'||heuristic==='patch-or-fix-v2'&&patch?'patch':notes?'release_notes':'corrective_commits'):'no_corrective_signal',patch,fix_commits:fixes,commits_total:commits.length,fix_ratio:ratio};
}
export function calculateCfrB(releases,windowStart,windowEnd,heuristic='fix-majority-v3'){
 const start=typeof windowStart==='number'?windowStart:timestamp(windowStart),end=typeof windowEnd==='number'?windowEnd:timestamp(windowEnd);
 if(!HEURISTIC_VERSIONS.includes(heuristic))throw new Error('Versão da heurística inválida.');
 if(!Number.isFinite(start)||!Number.isFinite(end)||start>end)throw new Error('Janela inválida.');
 if(new Set(releases.map(r=>r.repository).filter(Boolean)).size>1)throw new Error('Calcule CFR b por repositório.');
 const seen=new Set(),ordered=releases.filter(r=>!r.draft&&!r.prerelease).map(r=>{const time=timestamp(r.published_at);if(!r.tag_name||seen.has(r.tag_name))throw new Error('Release sem tag ou duplicada.');seen.add(r.tag_name);return {...r,time};}).sort((a,b)=>a.time-b.time||a.tag_name.localeCompare(b.tag_name));
 const episodes=[];let evaluated=0,failed=0,censored=0,unknown=0;
 for(let i=0;i<ordered.length;i++){
  const r=ordered[i];if(r.time<start||r.time>end)continue;
  if(r.time>end-week){censored++;episodes.push({tag_name:r.tag_name,published_at:r.published_at,outcome:'censored',corrective_tag:'',hours_to_correction:''});continue;}
  // A release fails if any corrective published release follows within seven days.
  const followers=ordered.slice(i+1).filter(next=>next.time>r.time&&next.time<=Math.min(end,r.time+week));
  const classified=followers.map(next=>({next,prediction:classifyCorrective(next,heuristic)}));
  const correction=classified.find(c=>c.prediction.corrective===true);
  if(!correction&&classified.some(c=>c.prediction.corrective===null)){unknown++;episodes.push({tag_name:r.tag_name,published_at:r.published_at,outcome:'unknown',corrective_tag:'',hours_to_correction:''});continue;}
  evaluated++;if(correction)failed++;
  episodes.push({tag_name:r.tag_name,published_at:r.published_at,outcome:correction?'failure':'success',corrective_tag:correction?.next.tag_name||'',hours_to_correction:correction?(correction.next.time-r.time)/3600000:''});
 }
 return {releases_total:episodes.length,releases_evaluated:evaluated,releases_failed:failed,releases_censored:censored,releases_unknown:unknown,cfr_b:evaluated?failed/evaluated:null,heuristic_version:heuristic,episodes};
}
export function classificationMetrics(rows){
 let tp=0,fp=0,fn=0,tn=0;for(const row of rows){if(typeof row.predicted!=='boolean'||typeof row.expected!=='boolean')throw new Error('Rótulos binários obrigatórios.');if(row.predicted&&row.expected)tp++;else if(row.predicted)fp++;else if(row.expected)fn++;else tn++;}
 const precision=tp+fp?tp/(tp+fp):null,recall=tp+fn?tp/(tp+fn):null,f1=2*tp+fp+fn?2*tp/(2*tp+fp+fn):null;
 return {n:rows.length,tp,fp,fn,tn,precision,recall,f1};
}
export function auditReference(rows,evidence){
 const map=new Map();for(const r of evidence){const key=r.repository.toLowerCase()+':'+r.tag_name;if(map.has(key))throw new Error('Evidência duplicada.');map.set(key,r);}
 const seen=new Set();return rows.map(row=>{
  const key=String(row.repository).toLowerCase()+':'+row.release_tag;if(seen.has(key))throw new Error('Referência duplicada.');seen.add(key);
  const actual=map.get(key);let status='missing_evidence';
  if(actual)status=actual.lookup_error==='not_found'?'release_not_found':actual.source==='synthetic_demo'?'synthetic_evidence':timestamp(actual.published_at)!==timestamp(row.release_published_at)?'date_mismatch':actual.compare_error||!Array.isArray(actual.commits)?'comparison_unavailable':actual.draft||actual.prerelease?'excluded_release':'verified';
  return {repository:row.repository,release_tag:row.release_tag,reference_date:row.release_published_at,actual_date:actual?.published_at||'',status,release:status==='verified'?actual:null,expected:row.consensus_is_corrective==='sim'?true:['nao','não'].includes(row.consensus_is_corrective)?false:null};
 });
}
export function evaluateHeuristics(reference,evidence){
 const audit=auditReference(reference,evidence),usable=audit.filter(r=>r.status==='verified'&&r.expected!==null);
 const versions=HEURISTIC_VERSIONS.map(name=>({version:name,...classificationMetrics(usable.map(r=>({expected:r.expected,predicted:classifyCorrective(r.release,name).corrective})))}));
 const best=[...versions].filter(v=>v.f1!==null).sort((a,b)=>b.f1-a.f1||HEURISTIC_VERSIONS.indexOf(a.version)-HEURISTIC_VERSIONS.indexOf(b.version))[0];
 const predictions=usable.flatMap(r=>HEURISTIC_VERSIONS.map(version=>({repository:r.repository,release_tag:r.release_tag,expected:r.expected,version,...classifyCorrective(r.release,version)})));
 return {status:usable.length===reference.length&&usable.length>0?'calibration_complete':'reference_pending',reference_rows:reference.length,verified_rows:usable.length,coverage:reference.length?usable.length/reference.length:0,versions,chosen_version:best?.version||null,threshold_met:best?best.f1>=.70:false,evaluation_type:'calibration_on_consensus_not_independent_test',audit:audit.map(({release,...r})=>r),predictions};
}
