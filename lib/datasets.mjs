import fs from 'node:fs';
import path from 'node:path';
import {parseCSV,toCSV} from './csv.mjs';
import {timestamp,windowDates} from './metrics.mjs';
import {collectReleasesAndCommits,getTags} from './releases.mjs';
export const RELEASE_DATA_HEADERS=['repository','default_branch','window_start','window_end','tag_name','published_at','base_tag','has_previous_release','compare_error','commits_json'];
const file=(folder,name,kind)=>path.join(folder,encodeURIComponent(name)+'.'+kind+'.json');
function atomic(filePath,data){fs.writeFileSync(filePath+'.tmp',JSON.stringify(data));fs.renameSync(filePath+'.tmp',filePath);}
export function requireDataset(job){
 const names=job.results.map(r=>r.repository.toLowerCase()),completed=new Set(job.datasets?.completed||[]);
 if(!names.length||!names.every(n=>completed.has(n)))throw new Error('A ainda precisa coletar os dados completos. Retome A para preparar os CSVs de B e C.');
}
export function validateCSVWindow(csv,start,end){
 for(const row of parseCSV(csv))if((row.window_start&&row.window_start!==start)||(row.window_end&&row.window_end!==end))throw new Error('A janela informada difere da janela de coleta do CSV.');
}
export function importReleaseData(csv,start,end){
 windowDates(start,end);validateCSVWindow(csv,start,end);
 const groups=new Map(),seen=new Set();
 for(const row of parseCSV(csv)){
  if(!/^[\w.-]+\/[\w.-]+$/.test(row.repository||'')||!row.default_branch||!row.tag_name)throw new Error('CSV de B exige repository, default_branch, tag_name e commits_json.');
  timestamp(row.published_at);
  if(!['true','false'].includes(row.has_previous_release))throw new Error('has_previous_release deve ser true ou false.');
  if(row.compare_error)throw new Error('CSV contém comparação incompleta. Retome A antes de calcular B.');
  const commits=JSON.parse(row.commits_json);if(!Array.isArray(commits))throw new Error('commits_json deve ser uma lista.');
  const shas=new Set();for(const c of commits){if(!c.sha||shas.has(c.sha))throw new Error('Commit sem SHA ou duplicado na release.');shas.add(c.sha);timestamp(c.author_date);}
  const key=row.repository.toLowerCase(),dedup=key+':'+row.tag_name;if(seen.has(dedup))throw new Error('Release duplicada no CSV.');seen.add(dedup);
  const group=groups.get(key)||{full_name:row.repository,default_branch:row.default_branch,releases:[],tags:[]};
  if(group.default_branch!==row.default_branch)throw new Error('Default branches divergentes no CSV.');
  group.releases.push({tag_name:row.tag_name,published_at:row.published_at,base_tag:row.base_tag,has_previous_release:row.has_previous_release==='true',compare_error:'',commits});groups.set(key,group);
 }
 return [...groups.values()];
}
export function exportReleaseData(job,folder){
 requireDataset(job);
 const rows=job.results.flatMap(repo=>JSON.parse(fs.readFileSync(file(folder,repo.repository,'releases'),'utf8')).releases.map(r=>({repository:repo.repository,default_branch:repo.default_branch,window_start:job.start,window_end:job.end,...r,commits_json:JSON.stringify(r.commits)})));
 return toCSV(rows,RELEASE_DATA_HEADERS);
}
export async function collectDataset(job,{api,folder,signal,update,log}){
 const dates=windowDates(job.start,job.end),state=job.datasets||={completed:[],status:'pending'};
 state.status='running';job.status='running';job.total=job.results.length;job.progress=state.completed.length;update();
 for(const repo of job.results){
  signal?.throwIfAborted();const name=repo.repository,key=name.toLowerCase();
  if(state.completed.includes(key))continue;
  try{
   const releaseFile=file(folder,name,'releases'),runFile=file(folder,name,'runs');
   if(!fs.existsSync(releaseFile)){
    log('A · Dados de B: releases e commits de '+name);
    const releases=await collectReleasesAndCommits(api,name,dates.start,dates.end,{log});
    if(releases.some(r=>r.compare_error))throw new Error('Comparação de commits incompleta. Retome A para tentar novamente.');
    const tags=await getTags(api,name);signal?.throwIfAborted();atomic(releaseFile,{releases,tags});
   }
   if(!fs.existsSync(runFile)){
    log('A · Dados de C: histórico mensal completo de '+name);
    const runs=await api.runs(name,repo.default_branch,dates.start,dates.end);signal?.throwIfAborted();
    atomic(runFile,runs.map(r=>({...r,repository:name,default_branch:repo.default_branch,window_start:job.start,window_end:job.end})));
   }
   state.completed.push(key);job.progress=state.completed.length;update();
  }catch(error){signal?.throwIfAborted();if(error.code==='RATE_LIMIT_WAIT')throw error;job.errors.push({repository:name,message:error.message});log(name+': '+error.message);}
 }
 state.status=state.completed.length===job.results.length?'completed':'partial';
 job.status=state.status==='completed'?(job.results.length<job.config.sampleSize?'insufficient_sample':'completed'):'partial';
 log('A · Dados completos para B/C: '+state.completed.length+'/'+job.results.length+'.');
}
