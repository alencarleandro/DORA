import {sortedQuantile,windowDates} from './metrics.mjs';
import {classifyLeadTime,classifyCfr,classifyRecovery,calculateOverallDora,CATEGORIES} from './sensitivity.mjs';

export const MEASURES=[
 ['deployment_frequency','RQ01','Frequência de releases','releases/semana'],
 ['lead_time_release_median_hours','RQ02a','Lead time por release','horas'],
 ['lead_time_commit_median_hours','RQ02b','Lead time por commit','horas'],
 ['cfr_ci','RQ03a','CFR do CI','proporção'],
 ['cfr_b','RQ03b','CFR de entrega (exploratório)','proporção'],
 ['recovery_median_hours','RQ04','Recuperação observada','horas'],
 ['censored_fraction','RQ04','Fração de episódios censurados','proporção'],
];
const COUNTS=['releases_in_window','releases_evaluated','releases_ignored','runs_total','runs_valid','runs_ignored','failures','successes','episodes_total','episodes_censored','initial_failures_without_success','cfr_b_releases_evaluated','cfr_b_releases_failed','cfr_b_releases_censored','cfr_b_releases_unknown'];
export function descriptiveStats(values){
 const x=values.filter(v=>typeof v==='number'&&Number.isFinite(v)).sort((a,b)=>a-b);
 if(!x.length)return {n:0,min:null,q1:null,median:null,q3:null,iqr:null,max:null,zeros:0};
 const q1=sortedQuantile(x,.25),q3=sortedQuantile(x,.75);
 return {n:x.length,min:x[0],q1,median:sortedQuantile(x,.5),q3,iqr:q3-q1,max:x.at(-1),zeros:x.filter(v=>v===0).length};
}
export function classifyFrequency(value,weeks){
 if(value===null)return null;
 if(value<0||!Number.isFinite(value)||!Number.isFinite(weeks)||weeks<=0)throw new Error('Frequência/janela inválida.');
 return value>=7?4:value>=1?3:value>=12/(365.25/7)?2:1;
}
// Exact annual/monthly conversion is handled below from each observation window.
export function classifyWindowFrequency(count,start,end){
 if(count===null)return null;
 const dates=windowDates(start,end),weeks=(dates.end-dates.start+1000)/(7*86400000);
 const rate=count/weeks;
 // For a full civil year one monthly release is exactly 12/year, including leap years.
 const fullYear=start.endsWith('-01-01')&&end===start.slice(0,4)+'-12-31';
 if(fullYear)return rate>=7?4:rate>=1?3:count>=12?2:1;
 return classifyFrequency(rate,weeks);
}
export function analyzeDescriptive(rows){
 if(!rows.length)throw new Error('Dataset vazio.');
 const warnings=[],seen=new Set(),windows=new Set();
 const normalized=rows.map((row,index)=>{
  if(!row.repository||!row.default_branch)throw new Error(`Linha ${index+1}: identidade ausente.`);
  const key=row.repository.toLowerCase();if(seen.has(key))throw new Error('Repositório duplicado: '+key);seen.add(key);
  const dates=windowDates(row.window_start,row.window_end);windows.add(row.window_start+'|'+row.window_end);
  const r={repository:row.repository,default_branch:row.default_branch,window_start:row.window_start,window_end:row.window_end,cfr_b_validation:row.cfr_b_validation||'unknown'};
  const number=(field,kind='measure')=>{
   const raw=row[field];if(raw===null||raw===undefined||String(raw).trim()==='')return null;
   const n=Number(raw);const rate=['cfr_ci','cfr_b','censored_fraction'].includes(field);
   if(!Number.isFinite(n)||n<0||rate&&n>1||kind==='count'&&!Number.isSafeInteger(n)){
    warnings.push({repository:row.repository,field,raw_value:raw,reason:'invalid_value_excluded',action:'Excluded from affected analysis; original CSV unchanged'});return null;
   }return n;
  };
  for(const [field] of MEASURES)r[field]=number(field);
  for(const field of COUNTS)r[field]=number(field,'count');
  const inconsistent=(field,expected)=>{if(r[field]!==null&&expected!==null&&Math.abs(r[field]-expected)>1e-7*Math.max(1,Math.abs(expected))){warnings.push({repository:r.repository,field,raw_value:row[field],reason:'inconsistent_with_counts',action:'Original preserved; excluded from analysis'});r[field]=null;}};
  inconsistent('deployment_frequency',r.releases_in_window===null?null:r.releases_in_window/((dates.end-dates.start+1000)/(7*86400000)));
  const ciDen=r.failures===null||r.successes===null?null:r.failures+r.successes;
  inconsistent('cfr_ci',ciDen? r.failures/ciDen:null);
  inconsistent('cfr_b',r.cfr_b_releases_evaluated?r.cfr_b_releases_failed/r.cfr_b_releases_evaluated:null);
  inconsistent('censored_fraction',r.episodes_total?r.episodes_censored/r.episodes_total:null);
  if(ciDen===0&&r.cfr_ci!==null)throw new Error('CFR CI definido com denominador zero: '+r.repository);
  if(r.cfr_b_releases_evaluated===0&&r.cfr_b!==null)throw new Error('CFR b definido com denominador zero: '+r.repository);
  const scores=[r.deployment_frequency===null?null:classifyWindowFrequency(r.releases_in_window,row.window_start,row.window_end),classifyLeadTime(r.lead_time_release_median_hours===null?null:r.lead_time_release_median_hours/24),classifyCfr(r.cfr_ci),classifyRecovery(r.recovery_median_hours)];
  ['df','lt_release','cfr_ci','recovery'].forEach((name,i)=>{r[name+'_score']=scores[i];r[name+'_category']=CATEGORIES[scores[i]]||'';});
  r.c1_dimensions_observed=scores.filter(x=>x!==null).length;
  r.c1_complete_score=r.c1_dimensions_observed===4?calculateOverallDora(scores):null;
  r.c1_complete_category=CATEGORIES[r.c1_complete_score]||'';
  r.c1_available_score=calculateOverallDora(scores);
  r.c1_available_category=CATEGORIES[r.c1_available_score]||'';
  r.c1_status=r.c1_dimensions_observed===4?'complete':'partial_not_comparable';
  r.recovery_missing_reason=r.recovery_median_hours!==null?'':r.episodes_total===0?'no_observed_episode':r.episodes_total!==null&&r.episodes_censored===r.episodes_total?'all_episodes_censored':'missing_or_invalid';
  return r;
 });
 if(windows.size!==1)throw new Error('Não misture janelas distintas.');
 const summary=MEASURES.map(([field,rq,label,unit])=>({field,rq,label,unit,...descriptiveStats(normalized.map(r=>r[field])),missing:normalized.filter(r=>r[field]===null).length,invalid:warnings.filter(w=>w.field===field).length}));
 const distribution=scope=>['Low','Medium','High','Elite'].map(category=>({category,n:normalized.filter(r=>r['c1_'+scope+'_category']===category).length}));
 const paired=(a,b)=>{const pairs=normalized.filter(r=>r[a]!==null&&r[b]!==null);return {n:pairs.length,a_greater:pairs.filter(r=>r[a]>r[b]).length,equal:pairs.filter(r=>r[a]===r[b]).length,a_less:pairs.filter(r=>r[a]<r[b]).length,difference:descriptiveStats(pairs.map(r=>r[a]-r[b]))};};
 const countSum=field=>({available:normalized.filter(r=>r[field]!==null).length,total:normalized.reduce((sum,r)=>sum+(r[field]??0),0)});
 const totals=Object.fromEntries(COUNTS.map(f=>[f,countSum(f)]));
 const validation=[...new Set(normalized.map(r=>r.cfr_b_validation))];
 return {rows:normalized,summary,warnings,window:{start:rows[0].window_start,end:rows[0].window_end},n:normalized.length,cfr_b_validation:validation,counts:totals,c1:{complete_n:normalized.filter(r=>r.c1_complete_score!==null).length,partial_n:normalized.filter(r=>r.c1_complete_score===null).length,complete_distribution:distribution('complete'),available_distribution:distribution('available')},paired:{lead_time_release_minus_commit:paired('lead_time_release_median_hours','lead_time_commit_median_hours'),cfr_ci_minus_delivery:paired('cfr_ci','cfr_b')}};
}
