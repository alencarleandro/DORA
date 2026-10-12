// Finish the existing collection, retry incomplete projects, then build the local handoff.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {load} from '../lib/pipeline.mjs';
const id=process.argv[2]||'1deaa513-2c06-4949-bd54-2c591b0eef12';
const folder=path.resolve('data/jobs',id),lock=path.join(folder,'finish.lock'),deadline=Date.now()+24*3600000;
function active(){if(!fs.existsSync(lock))return false;try{process.kill(Number(fs.readFileSync(lock,'utf8')),0);return true;}catch{return false;}}
function run(args,token=''){const result=spawnSync(process.execPath,args,{stdio:'inherit',env:{...process.env,GITHUB_TOKEN:token}});return result.status;}
try{
 while(active()){if(Date.now()>deadline)throw new Error('Espera atingiu 24h. Dados preservados.');await new Promise(resolve=>setTimeout(resolve,5000));}
 for(let attempt=0;attempt<2&&!fs.existsSync(path.join(folder,'exports/parts.json'));attempt++){
  const job=load(id);if(job.status==='paused')throw new Error('Coleta pausada. Não retomar automaticamente.');
  if(!process.env.GITHUB_TOKEN)throw new Error('Token necessário para os projetos incompletos.');
  console.log('Retomando somente projetos pendentes: '+job.datasets.completed.length+'/300.');
  run(['--max-old-space-size=8192','scripts/finish-cohort.mjs',id],process.env.GITHUB_TOKEN);
 }
 if(!fs.existsSync(path.join(folder,'exports/parts.json')))throw new Error('Ainda há coleta incompleta; confira job.json.');
 if(run(['scripts/finalize-isabella.mjs',id])!==0)throw new Error('A validação da entrega falhou.');
}catch(error){console.error(error.message);process.exitCode=1;}
