import fs from 'node:fs';
import path from 'node:path';
import { GitHub } from '../lib/github.mjs';
import { toCSV } from '../lib/csv.mjs';
import { validateConfig, discover, metadata, evidence, finalize, funnel, METADATA_HEADERS, DECISION_HEADERS } from '../lib/selection.mjs';

const args={};
for(let i=2;i<process.argv.length;i+=2) {
  const key=process.argv[i];
  if (!['--config','--mode','--limit','--output'].includes(key)||!process.argv[i+1]) throw new Error(`Argumento inválido: ${key}`);
  args[key.slice(2)]=process.argv[i+1];
}
try {
  const config=JSON.parse(fs.readFileSync(args.config || 'config.json','utf8'));
  if(args.limit) config.candidateLimit=Number(args.limit);
  if(args.output) config.outputDir=args.output;
  const mode=args.mode||'metadata';
  if(!['metadata','full'].includes(mode)) throw new Error('Modo deve ser metadata ou full.');
  validateConfig(config,mode);
  const folder=path.resolve(config.outputDir); fs.mkdirSync(folder,{recursive:true});
  const snapshotFile=path.join(folder,'config.snapshot.json');
  const previous=fs.existsSync(snapshotFile)?JSON.parse(fs.readFileSync(snapshotFile,'utf8')):null;
  const {searchUntil:previousUntil,...previousConfig}=previous||{};
  const snapshot={...config,mode};
  if(previous&&JSON.stringify(previousConfig)!==JSON.stringify(snapshot)) throw new Error('Configuração mudou: use --output com uma nova pasta para preservar a fotografia anterior.');
  // Fix the search boundary so rerunning the command uses identical cache keys.
  const oldQueries=fs.existsSync(path.join(folder,'queries.json'))?JSON.parse(fs.readFileSync(path.join(folder,'queries.json'),'utf8')):[];
  const oldBoundary=oldQueries.find(q=>q.query?.includes(' created:'))?.query.split('..').at(-1);
  config.searchUntil=previousUntil ?? (oldBoundary?Date.parse(oldBoundary)/1000:Math.floor(Date.now()/1000));
  snapshot.searchUntil=config.searchUntil;
  fs.writeFileSync(snapshotFile,JSON.stringify(snapshot,null,2));
  const controller=new AbortController(); process.on('SIGINT',()=>controller.abort());
  const api=new GitHub({token:process.env.GITHUB_TOKEN||'',cacheDir:path.join(folder,'cache'),signal:controller.signal,log:console.log,maxRateLimitWaitMs:config.maxRateLimitWaitMs??Infinity});
  const queries=[], rows=[], decisions=[];
  let candidates=[], discoveryComplete=false;
  function save(status,error='') {
    const pending=candidates.filter(c=>!decisions.some(d=>d.full_name===c.full_name)).map(c=>({full_name:c.full_name,actions_count:'',releases_count:'',valid_runs_count:'',decision:'pending',reason:'aguarda_coleta',error:''}));
    const final=finalize([...decisions,...pending],config.sampleSize), selected=rows.filter(r=>final.some(d=>d.full_name===r.full_name&&d.decision==='selected'));
    for (const [file,data,headers] of [
      ['candidates.csv',candidates,['id','full_name','default_branch','stargazers_count']],
      ['repositories.csv',mode==='full'?selected:rows,['full_name','default_branch']],
      ['metadata.csv',rows,METADATA_HEADERS],['selection_decisions.csv',final,DECISION_HEADERS],['selection_funnel.csv',funnel(final),undefined]
    ]) fs.writeFileSync(path.join(folder,file),toCSV(data,headers));
    fs.writeFileSync(path.join(folder,'queries.json'),JSON.stringify(queries,null,2));
    fs.writeFileSync(path.join(folder,'collection.json'),JSON.stringify({status,error,mode,discovery_complete:discoveryComplete,scope:'Top candidateLimit por estrelas entre partições visitadas; não é censo de todos os projetos.',candidate_count:candidates.length,processed:decisions.length,selected:selected.length,window_confirmed:Boolean(config.start&&config.end),updated_at:new Date().toISOString()},null,2));
  }
  try {
    candidates=await discover(api,config,queries); discoveryComplete=true; save('running');
    for(const candidate of candidates) {
      controller.signal.throwIfAborted();
      console.log(`Metadados ${decisions.length+1}/${candidates.length}: ${candidate.full_name}`);
      try {
        const row=await metadata(api,candidate,config); rows.push(row);
        decisions.push(mode==='full'?await evidence(api,row,config):{full_name:row.full_name,actions_count:'',releases_count:'',valid_runs_count:'',decision:'pending',reason:'aguarda_filtros_janela',error:''});
      } catch(error) {
        controller.signal.throwIfAborted();
        if(error.code==='RATE_LIMIT_WAIT') throw error;
        decisions.push({full_name:candidate.full_name,actions_count:'',releases_count:'',valid_runs_count:'',decision:'error',reason:'erro_metadados',error:error.message});
      }
      save('running');
    }
    const partial=decisions.some(r=>r.decision==='error')||rows.some(r=>r.metadata_status!=='complete');
    const insufficient=mode==='full'&&finalize(decisions,config.sampleSize).filter(r=>r.decision==='selected').length<config.sampleSize;
    save(partial?'partial':insufficient?'insufficient_sample':mode==='full'?'completed':'metadata_completed');
    console.log(`Saídas: ${folder}. ${rows.length} metadados; ${mode==='full'?finalize(decisions,config.sampleSize).filter(r=>r.decision==='selected').length+' selecionados':'filtros da amostra pendentes'}.`);
    if(partial || mode==='full'&&finalize(decisions,config.sampleSize).filter(r=>r.decision==='selected').length<config.sampleSize) process.exitCode=1;
  } catch(error) {save(controller.signal.aborted?'paused':error.code==='RATE_LIMIT_WAIT'?'rate_limited':'failed',error.message);throw error;}
} catch(error) {console.error(error.message);process.exitCode=1;}
