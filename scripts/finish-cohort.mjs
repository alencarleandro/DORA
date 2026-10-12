// Finish A's raw datasets, then calculate B/C locally. Credentials stay in process memory.
import fs from 'node:fs';
import path from 'node:path';
import {GitHub} from '../lib/github.mjs';
import {collectDataset} from '../lib/datasets.mjs';
import {load,save,create,execute,exportJob,exportKinds} from '../lib/pipeline.mjs';
import {createHash} from 'node:crypto';
import {GitEvidence} from '../lib/git-evidence.mjs';
import {writeRawExports} from '../lib/export-files.mjs';
import {auditGitComparisons} from '../lib/raw-audit.mjs';
const id=process.argv[2]||'1deaa513-2c06-4949-bd54-2c591b0eef12';
const controller=new AbortController();process.on('SIGINT',()=>controller.abort());
let job,lock,ownsLock=false;
try {
 if(!process.env.GITHUB_TOKEN)throw new Error('GITHUB_TOKEN necessário para os dados faltantes.');
 job=load(id);lock=path.resolve('data/jobs',id,'finish.lock');
 const retryRuns=new Set(job.errors.filter(e=>/Paginação incompleta|dados alterados|duplicada/i.test(e.message)).map(e=>e.repository.toLowerCase()));
 if(fs.existsSync(lock)){const pid=Number(fs.readFileSync(lock,'utf8'));let alive=true;try{process.kill(pid,0);}catch{alive=false;}if(alive)throw new Error('Um coletor desta base já está em execução.');fs.unlinkSync(lock);}
 fs.writeFileSync(lock,String(process.pid),{flag:'wx'});ownsLock=true;
 job.collect_data=true;job.errors=[];save(job);
 const folder=path.resolve('data/jobs',id),cacheDir=path.resolve('data/jobs',job.cache_source_job_id||id,'cache');
 let lastLog=0;
 const api=new GitHub({token:process.env.GITHUB_TOKEN,cacheDir,signal:controller.signal,memoryCacheSize:30,maxRateLimitWaitMs:Infinity,
  onQuota:quota=>{job.quotas={...job.quotas,[quota.resource]:quota};},
  log:message=>{job.stage=message;save(job);if(Date.now()-lastLog>10000||/rate limit|cota|tentativa/i.test(message)){console.log(message);lastLog=Date.now();}},
  fetcher:async(url,options)=>{
   for(let n=0;n<5;n++){
    const response=await fetch(url,{...options,redirect:'manual'});
    if(![301,302,303,307,308].includes(response.status))return response;
    const location=response.headers.get('location');if(!location)throw new Error('Redirecionamento sem destino.');
    const target=new URL(location,url);if(target.origin!=='https://api.github.com')throw new Error('Redirecionamento fora da API GitHub.');url=target;
   }throw new Error('Redirecionamentos excessivos.');
  }});
 const originalGet=api.get.bind(api);
 const originalRuns=api.runs.bind(api),retryClients=new Map();
 job.dataset_retry_cache||={};
 for(const repository of retryRuns)job.dataset_retry_cache[repository]=path.join(folder,'cache-retry',encodeURIComponent(repository),String(Date.now()));
 save(job);
 api.runs=(repository,...args)=>{
  const key=repository.toLowerCase(),retryCache=job.dataset_retry_cache[key];
  if(!retryCache)return originalRuns(repository,...args);
  if(!retryClients.has(key)){
   console.log('Recolhendo paginação em cache separado: '+repository);
   retryClients.set(key,new GitHub({token:api.token,cacheDir:retryCache,signal:api.signal,log:api.log,onQuota:api.onQuota,fetcher:api.fetcher,memoryCacheSize:30,maxRateLimitWaitMs:Infinity}));
  }
  return retryClients.get(key).runs(repository,...args);
 };
 const gitEvidence=new GitEvidence({directory:path.join(folder,'git-evidence'),log:console.log});
 const large=new Set(job.results.filter(r=>r.releases_in_window>=20).map(r=>r.repository.toLowerCase()));
 api.get=async(url,...options)=>{
  const target=new URL(url,'https://api.github.com'),file=path.join(cacheDir,createHash('sha256').update(target.href).digest('hex')+'.json');
  if(target.origin!=='https://api.github.com')throw new Error('Endpoint fora da API GitHub.');
  const match=target.pathname.match(/^\/repos\/([^/]+\/[^/]+)\/compare\/(.+)$/),tags=target.pathname.match(/^\/repos\/([^/]+\/[^/]+)\/tags$/);
  let result;
  if(tags&&large.has(tags[1].toLowerCase())&&!target.searchParams.has('page')&&!fs.existsSync(file))result=gitEvidence.tags(tags[1]);
  else if(match&&!target.searchParams.has('page')&&((large.has(match[1].toLowerCase())&&!fs.existsSync(file))||(fs.existsSync(file)&&JSON.parse(fs.readFileSync(file,'utf8')).next))){
   const [base,head]=match[2].split('...').map(decodeURIComponent);result=gitEvidence.compare(match[1],base,head);
  }else {
   try{
    const response=await originalGet(url,...options);
    if(!match||target.searchParams.has('page')||!response.next)return response;
    const [base,head]=match[2].split('...').map(decodeURIComponent);result=gitEvidence.compare(match[1],base,head);
   }catch(error){
   if(!match||target.searchParams.has('page')||!/HTTP 422/.test(error.message))throw error;
   const [base,head]=match[2].split('...').map(decodeURIComponent);if(!base||!head)throw error;
   result=gitEvidence.compare(match[1],base,head);console.log('Comparação recuperada via Git: '+match[1]+' '+base+'...'+head);
   }
  }
  result.url=target.href;fs.writeFileSync(file,JSON.stringify(result));return result;
 };
 console.log('Dados completos antes: '+job.datasets.completed.length+'/'+job.results.length);
 const update=()=>save(job),log=message=>{job.stage=message;job.logs.push({at:new Date().toISOString(),message});job.logs=job.logs.slice(-200);save(job);if(!message.includes('comparando'))console.log(message);};
 await collectDataset(job,{api,folder,signal:controller.signal,update,log,concurrency:3});
 if(job.datasets.status==='completed'){
  console.log('Conferindo ancestralidade das comparações Git e registrando medições indisponíveis.');
  job.comparison_quality=auditGitComparisons(job,folder,gitEvidence);save(job);
 }
 const out=path.join(folder,'exports');fs.mkdirSync(out,{recursive:true});
 for(const kind of exportKinds('selection')){
  if(['release-data','runs','commits'].includes(kind))continue;
  if(['release-data','releases','commits','tags','runs'].includes(kind)&&job.datasets.status!=='completed')continue;
  fs.writeFileSync(path.join(out,kind+'.csv'),exportJob(job,kind));
 }
 if(job.datasets.status!=='completed'){console.log(JSON.stringify({status:'partial',completed:job.datasets.completed.length,errors:job.errors}));process.exitCode=2;}
 else {
  writeRawExports(job,folder,out);
  const local=()=>{throw new Error('Consultas ao GitHub proibidas no cálculo local.');};
  const denied=new Proxy({},{get:local});const parts=[];
  for(const mode of ['releases','collect']){
   const part=create({mode,sourceJobId:id});part.label=mode==='releases'?'Sprint 2 · B · 300 projetos':'Sprint 2 · C · 300 projetos';
   await execute(part,{github:denied,signal:controller.signal});
   const dest=path.resolve('data/jobs',part.id,'exports');fs.mkdirSync(dest,{recursive:true});
   for(const kind of exportKinds(mode)){
    if(kind==='runs'||kind==='commits'){fs.copyFileSync(path.join(out,kind+'.csv'),path.join(dest,kind+'.csv'));continue;}
    fs.writeFileSync(path.join(dest,kind+'.csv'),exportJob(part,kind));
   }
   parts.push({mode,id:part.id,status:part.status,results:part.results.length,exports:dest});
  }
  fs.writeFileSync(path.join(out,'parts.json'),JSON.stringify(parts,null,2));console.log(JSON.stringify({status:'completed',datasets:job.datasets.completed.length,parts}));
 }
}catch(error){if(job&&ownsLock){job.status=controller.signal.aborted?'paused':'failed';save(job);}console.error(error.message);process.exitCode=1;}
finally{if(ownsLock&&fs.existsSync(lock))fs.unlinkSync(lock);}
