// Finishes local A/B/C collection into repository folders. No ZIP or label overwrite.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {load} from '../lib/pipeline.mjs';
const id=process.argv[2]||'1deaa513-2c06-4949-bd54-2c591b0eef12';
const folder=path.resolve('data/jobs',id),partsFile=path.join(folder,'exports/parts.json');
const run=args=>{const result=spawnSync(process.execPath,args,{stdio:'inherit',env:{...process.env,GITHUB_TOKEN:''}});if(result.status!==0)throw Error(args[0]+' falhou.');};
try {
 const deadline=Date.now()+24*3600000;
 while(!fs.existsSync(partsFile)){
  const a=load(id);
  if(!process.argv.includes('--wait')||['failed','partial','paused'].includes(a.status))throw Error('A/B/C incompletos; dados preservados.');
  if(Date.now()>deadline)throw Error('Espera atingiu 24 horas; dados preservados.');
  await new Promise(resolve=>setTimeout(resolve,5000));
 }
 const gold=path.resolve('data/gold-standard-final-300-2025');
 const samplingFile=path.join(gold,'sampling-manifest.json');
 if(fs.existsSync(samplingFile)&&JSON.parse(fs.readFileSync(samplingFile)).source_job_id!==id)throw Error('A amostra-ouro existente pertence a outra coleta. Preserve-a e prepare uma nova pasta antes de finalizar.');
 run(['scripts/consolidate-dataset.mjs',id]);
 run(['scripts/assemble-isabella-dataset.mjs']);
 if(!fs.existsSync(path.join(gold,'gold_standard_sample.csv')))run(['scripts/sample-gold-standard.mjs','--job',id,'--n-repos','60','--n-releases','5','--seed','42','--require-comparisons','--out-dir',gold]);
 const result={status:'completed',rows:300,source_job_id:id,dataset:path.resolve('data/dataset-s02-final/dataset.csv'),gold_standard:gold,guide:path.resolve('docs/ESTRUTURA-DADOS-S02.md'),cfr_b_validation:'pending_independent_labels',completed_at:new Date().toISOString()};
 fs.writeFileSync(path.join(folder,'finalization.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}catch(error){
 if(fs.existsSync(folder))fs.writeFileSync(path.join(folder,'finalization.json'),JSON.stringify({status:'failed',message:error.message,at:new Date().toISOString()},null,2)+'\n');
 console.error(error.message);process.exitCode=1;
}
