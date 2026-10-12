// Reuse A's persisted selection and API cache; collect eligibility only.
import fs from 'node:fs';
import path from 'node:path';
import {GitHub} from '../lib/github.mjs';
import {load,create,save,exportJob} from '../lib/pipeline.mjs';
import {discover,metadata,evidence} from '../lib/selection.mjs';
const args=Object.fromEntries(process.argv.slice(2).reduce((a,v,i,s)=>v.startsWith('--')?[...a,[v.slice(2),s[i+1]]]:a,[]));
const controller=new AbortController();process.on('SIGINT',()=>controller.abort());
let job;
try {
 if(!process.env.GITHUB_TOKEN)throw new Error('GITHUB_TOKEN necessário para coletar os dados faltantes.');
 const original=load(args.base||'017950ac-806f-45b7-bc0d-eb9a9ae87605');
 job=args.resume?load(args.resume):create({mode:'selection',source:'search',start:original.start,end:original.end,minStars:original.config.minStars,candidateLimit:Number(args.limit||1000),sampleSize:Number(args.target||300),collectData:false});
 if(args.resume&&Number(args.limit)>job.config.candidateLimit){job.config.candidateLimit=Number(args.limit);job.selection.discovered=false;}
 if(!args.resume){job.selection=structuredClone(original.selection);job.config.searchUntil=original.config.searchUntil;job.selection.discovered=false;job.label='Sprint 2 · 300 repositórios · 2025';job.parent_job_id=original.id;}
 job.cache_source_job_id=original.id;
 const folder=path.resolve('data/jobs',job.id),cacheDir=path.resolve('data/jobs',original.id,'cache');
 job.status='running';save(job);console.log('Coleta '+job.id);
 const api=new GitHub({token:process.env.GITHUB_TOKEN,cacheDir,signal:controller.signal,maxRateLimitWaitMs:60000,memoryCacheSize:50,log:console.log,fetcher:async(url,options)=>{
  for(let n=0;n<5;n++){
   const response=await fetch(url,{...options,redirect:'manual'});
   if(![301,302,303,307,308].includes(response.status))return response;
   const location=response.headers.get('location');if(!location)throw new Error('Redirecionamento sem destino.');
   const target=new URL(location,url);if(target.origin!=='https://api.github.com')throw new Error('Redirecionamento fora da API GitHub.');url=target;
  }throw new Error('Redirecionamentos excessivos.');
 }});
 if(!job.selection.discovered){
  let candidates;
  try {candidates=await discover(api,job.config,job.selection.queries);}
  catch(error){
   if(!/Paginação da busca incompleta ou alterada/.test(error.message))throw error;
   // Cached old pages and new pages can overlap as star rankings change. Keep actual unique IDs.
   const q=job.selection.queries.at(-1).query;
   candidates=await api.pages('/search/repositories?'+new URLSearchParams({q,sort:'stars',order:'desc',per_page:'100'}),'items');
   job.discovery_warning='Paginação entre fotografias contém sobreposição; IDs duplicados removidos. Não é censo nem fotografia instantânea.';
  }
  const ids=new Set(job.selection.candidates.map(r=>r.id));
  for(const candidate of candidates)if(!ids.has(candidate.id)){job.selection.candidates.push(candidate);ids.add(candidate.id);}
  job.selection.discovered=true;save(job);
 }
 const state=job.selection;
 function finish(status='running') {
  const eligible=state.candidates.map(c=>state.decisions.find(d=>d.full_name.toLowerCase()===c.full_name.toLowerCase())).filter(d=>d?.decision==='eligible').slice(0,job.config.sampleSize);
  job.results=eligible.map(d=>{const m=state.metadata.find(r=>r.full_name.toLowerCase()===d.full_name.toLowerCase());return {...m,repository:d.full_name,releases_in_window:d.releases_count,runs_valid:d.valid_runs_count,runs_count_complete:d.runs_count_complete,selected:true};});
  job.progress=state.decisions.length;job.total=state.candidates.length;job.status=status;job.stage='A · '+job.results.length+'/'+job.config.sampleSize+' elegíveis · '+status;job.errors=state.decisions.filter(r=>r.decision==='error').map(r=>({repository:r.full_name,message:r.error}));save(job);
 }
 let cursor=0,processed=0;
 await Promise.all(Array.from({length:3},async()=>{
  while(cursor<state.candidates.length&&state.decisions.filter(r=>r.decision==='eligible').length<job.config.sampleSize){
   controller.signal.throwIfAborted();const candidate=state.candidates[cursor++],key=candidate.full_name.toLowerCase();
   const previous=state.decisions.find(r=>r.full_name.toLowerCase()===key);
   if(previous&&previous.decision!=='error')continue;
   try {
    const row=await metadata(api,candidate,job.config);
    // Public repository renames keep the same GitHub identity.
    if(candidate.id&&row.repository_id!==candidate.id)throw new Error('Identidade do repositório mudou.');
    candidate.full_name=row.full_name;candidate.default_branch=row.default_branch;
    state.metadata=state.metadata.filter(r=>r.full_name.toLowerCase()!==key&&r.full_name.toLowerCase()!==row.full_name.toLowerCase()).concat(row);
    const decision=await evidence(api,row,job.config);
    state.decisions=state.decisions.filter(r=>r.full_name.toLowerCase()!==key&&r.full_name.toLowerCase()!==row.full_name.toLowerCase()).concat(decision);
   }catch(error){controller.signal.throwIfAborted();if(error.code==='RATE_LIMIT_WAIT')throw error;state.decisions=state.decisions.filter(r=>r.full_name.toLowerCase()!==key).concat({full_name:candidate.full_name,actions_count:'',releases_count:'',valid_runs_count:'',decision:'error',reason:'erro_coleta',error:error.message});}
   processed++;finish();if(processed%10===0)console.log(JSON.stringify({processed_new:processed,verified:job.progress,selected:job.results.length,target:job.config.sampleSize,cache:api.getStats()}));
  }
 }));
 finish(job.results.length>=job.config.sampleSize?'completed':'insufficient_sample');
 // Preserve available raw data without copying the multi-gigabyte API cache.
 job.datasets={completed:[],status:'partial'};
 for(const r of job.results){for(const kind of ['releases','runs']){const name=encodeURIComponent(r.repository)+'.'+kind+'.json',source=path.resolve('data/jobs',original.id,name);if(fs.existsSync(source))fs.copyFileSync(source,path.join(folder,name));}if(original.datasets?.completed.includes(r.repository.toLowerCase()))job.datasets.completed.push(r.repository.toLowerCase());}
 const exportsDir=path.join(folder,'exports');fs.mkdirSync(exportsDir,{recursive:true});save(job);
 for(const kind of ['repositories','metadata','decisions','queries','funnel'])fs.writeFileSync(path.join(exportsDir,kind+'.csv'),exportJob(job,kind));
 fs.writeFileSync(path.join(exportsDir,'README.md'),`# Coorte Sprint 2\n\n${job.results.length}/${job.config.sampleSize} repositórios selecionados. Janela ${job.start} a ${job.end}. Dados completos A/B/C copiados: ${job.datasets.completed.length}/${job.results.length}. A elegibilidade não substitui a coleta completa de releases/commits/workflows. Cache reutilizado: data/jobs/${original.id}/cache.\n`);
 console.log(JSON.stringify({job_id:job.id,status:job.status,selected:job.results.length,target:job.config.sampleSize,exports:exportsDir,complete_datasets:job.datasets.completed.length}));
 if(job.results.length<job.config.sampleSize)process.exitCode=2;
}catch(error){if(job){job.status='paused';save(job);}console.error(error.message);process.exitCode=1;}
