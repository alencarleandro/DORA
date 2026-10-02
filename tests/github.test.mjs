import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {GitHub} from '../lib/github.mjs';
async function client(t,fetcher,extra={}){const cacheDir=await fs.mkdtemp(path.join(os.tmpdir(),'dora-test-'));t.after(()=>fs.rm(cacheDir,{recursive:true,force:true}));return new GitHub({cacheDir,fetcher,sleep:async()=>{},...extra});}
test('cache preserva paginação e evita repetir chamadas',async t=>{
  let calls=0;const api=await client(t,async url=>{calls++;return new Response(JSON.stringify({workflow_runs:[{id:calls}]}),{headers:calls===1?{Link:'<https://api.github.com/page2>; rel="next"'}:{}});});
  assert.equal((await api.pages('/page1','workflow_runs')).length,2);await api.pages('/page1','workflow_runs');assert.equal(calls,2);
});
test('retries 5xx e rede e rate limit',async t=>{
  let n=0;const api=await client(t,async()=>{n++;if(n===1)throw new Error('network');if(n===2)return new Response('',{status:500});if(n===3)return new Response('',{status:403,headers:{'x-ratelimit-remaining':'0','x-ratelimit-reset':'1'}});if(n===4)return new Response('',{status:429,headers:{'retry-after':'1'}});return new Response('{}');});assert.deepEqual((await api.get('/retry')).data,{});assert.equal(n,5);
});
test('teto de 1.000 subdivide intervalo sem truncar',async t=>{
  const api=await client(t,async url=>{const interval=new URL(url).searchParams.get('created');return new Response(JSON.stringify(interval==='2026-01-01T00:00:00Z..2026-01-01T00:00:03Z'?{total_count:1000,workflow_runs:[]}:{total_count:1,workflow_runs:[{id:interval}]}));});
  assert.equal((await api.interval('demo/repo','main',Date.parse('2026-01-01T00:00:00Z'),Date.parse('2026-01-01T00:00:03Z'))).length,2);
});
test('janela dividida por mês e runs deduplicados',async t=>{
  const api=await client(t,async()=>new Response('{}'));const calls=[];api.interval=async(repo,branch,start,end)=>{calls.push([start,end]);return[{id:1}];};
  assert.equal((await api.runs('a/b','main',Date.parse('2026-01-15T00:00:00Z'),Date.parse('2026-02-10T23:59:59Z'))).length,1);assert.equal(calls.length,2);assert.equal(calls[0][1]+1000,calls[1][0]);
});
test('erros de acesso e paginação incompleta são explícitos',async t=>{
  const denied=await client(t,async()=>new Response('',{status:401}));await assert.rejects(()=>denied.get('/a'),/401/);await assert.rejects(()=>denied.get('https://evil.example'),/fora/);
  const incomplete=await client(t,async()=>new Response('{"total_count":2,"workflow_runs":[]}'));await assert.rejects(()=>incomplete.interval('a/b','main',0,1000),/incompleta/);
});
test('cancelamento interrompe espera',async t=>{const controller=new AbortController();controller.abort();const api=await client(t,async()=>new Response('{}'),{signal:controller.signal});await assert.rejects(()=>api.get('/a'));});
