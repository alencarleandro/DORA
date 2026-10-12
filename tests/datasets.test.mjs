import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {collectDataset} from '../lib/datasets.mjs';
test('coleta concorrente limita chamadas e retoma somente o projeto incompleto',async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'dora-concurrent-'));
 try{
  const job={start:'2025-01-01',end:'2025-12-31',config:{sampleSize:4},results:Array.from({length:4},(_,n)=>({repository:'a/r'+n,default_branch:'main'})),errors:[]};
  for(const r of job.results)fs.writeFileSync(path.join(folder,encodeURIComponent(r.repository)+'.releases.json'),JSON.stringify({releases:[],tags:[]}));
  let active=0,maximum=0;const api={runs:async name=>{active++;maximum=Math.max(maximum,active);await new Promise(resolve=>setImmediate(resolve));active--;if(name==='a/r1')throw new Error('transient');return [];}};
  await collectDataset(job,{api,folder,update:()=>{},log:()=>{},concurrency:3});
  assert.equal(maximum,3);assert.equal(job.datasets.completed.length,3);assert.equal(new Set(job.datasets.completed).size,3);assert.equal(job.status,'partial');assert.equal(job.errors[0].repository,'a/r1');
  const retried=[];job.errors=[];
  await collectDataset(job,{api:{runs:async name=>{retried.push(name);return [];}},folder,update:()=>{},log:()=>{},concurrency:3});
  assert.deepEqual(retried,['a/r1']);assert.equal(job.status,'completed');assert.equal(job.datasets.completed.length,4);
 }finally{fs.rmSync(folder,{recursive:true,force:true});}
});
