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

test('rate limit com espera acima do limite permite retomada sem esperar',async t=>{
  const api=await client(t,async()=>new Response('',{status:429,headers:{'retry-after':'3600'}}),{maxRateLimitWaitMs:60000,sleep:async()=>{assert.fail('Não deveria aguardar');}});
  await assert.rejects(()=>api.get('/limited'),error=>error.code==='RATE_LIMIT_WAIT'&&/Cache preservado/.test(error.message));
});

test('resposta JSON interrompida é repetida e nunca salva como completa',async t=>{
  let calls=0;
  const api=await client(t,async()=>new Response(++calls===1?'{':'{"ok":true}'));
  assert.deepEqual((await api.get('/truncated')).data,{ok:true});
  assert.equal(calls,2);
  await api.get('/truncated'); assert.equal(calls,2);
});

function qualifiedRun(id,conclusion='success'){return {id,event:'push',head_branch:'main',conclusion,created_at:'2026-01-01T00:00:00Z'};}
test('A para ao confirmar 50 runs sem baixar o restante; contagem é limite inferior',async t=>{
 let calls=0;const api=await client(t,async()=>{calls++;return new Response(JSON.stringify({total_count:2000,workflow_runs:Array.from({length:100},(_,i)=>qualifiedRun(i))}),{headers:{Link:'<https://api.github.com/page2>; rel="next"'}});});
 assert.deepEqual(await api.qualifyRuns('a/b','main',Date.parse('2026-01-01T00:00:00Z'),Date.parse('2026-12-31T23:59:59Z')),{count:100,complete:false});assert.equal(calls,1);
});
test('A confirma ausência de runs em uma chamada para a janela inteira',async t=>{
 let calls=0;const api=await client(t,async()=>{calls++;return new Response(JSON.stringify({total_count:0,workflow_runs:[]}));});
 assert.deepEqual(await api.qualifyRuns('a/b','main',Date.parse('2026-01-01T00:00:00Z'),Date.parse('2026-12-31T23:59:59Z')),{count:0,complete:true});assert.equal(calls,1);
});
test('A não exclui projetos por runs ignorados na primeira página ou pelo teto de mil',async t=>{
 let calls=0;const api=await client(t,async()=>{calls++;return new Response(JSON.stringify({total_count:1000,workflow_runs:Array.from({length:100},(_,i)=>qualifiedRun(i,'cancelled'))}));});
 api.runs=async()=>{calls++;return Array.from({length:60},(_,i)=>qualifiedRun(i));};
 assert.deepEqual(await api.qualifyRuns('a/b','main',Date.parse('2026-01-01T00:00:00Z'),Date.parse('2026-12-31T23:59:59Z')),{count:60,complete:true});assert.equal(calls,2);
});
test('cota e autenticação são informadas; cache não inventa saldo atual',async t=>{
 const quotas=[];let calls=0;const api=await client(t,async(_url,options)=>{calls++;assert.equal(options.headers.Authorization,'Bearer fixture');return new Response('{}',{headers:{'x-ratelimit-resource':'core','x-ratelimit-limit':'5000','x-ratelimit-remaining':'4999','x-ratelimit-reset':'1800000000'}});},{token:'fixture',onQuota:q=>quotas.push(q)});
 await api.get('/quota');await api.get('/quota');assert.equal(calls,1);assert.equal(quotas.length,1);assert.equal(quotas[0].authenticated,true);assert.equal(quotas[0].remaining,4999);assert.ok(!JSON.stringify(quotas).includes('fixture'));
});

test('singleflight agrupa chamadas concorrentes à mesma URL em uma única requisição', async t => {
  let fetchCalls = 0;
  const api = await client(t, async () => {
    fetchCalls++;
    await new Promise(r => setTimeout(r, 10));
    return new Response(JSON.stringify({ repo: 'shared' }));
  });
  const [res1, res2, res3] = await Promise.all([
    api.get('/repos/foo/bar'),
    api.get('/repos/foo/bar'),
    api.get('/repos/foo/bar')
  ]);
  assert.equal(fetchCalls, 1);
  assert.deepEqual(res1.data, { repo: 'shared' });
  assert.deepEqual(res2.data, { repo: 'shared' });
  assert.deepEqual(res3.data, { repo: 'shared' });
});

test('cache L1 em memória evita I/O de disco para leituras subsequentes', async t => {
  let calls = 0;
  const api = await client(t, async () => {
    calls++;
    return new Response(JSON.stringify({ value: 42 }));
  });
  await api.get('/val');
  assert.equal(calls, 1);
  assert.equal(api.getStats().misses, 1);
  assert.equal(api.getStats().memoryHits, 0);

  const mem = await api.get('/val');
  assert.equal(mem.data.value, 42);
  assert.equal(calls, 1);
  assert.equal(api.getStats().memoryHits, 1);

  api.clearMemoryCache();
  const disk = await api.get('/val');
  assert.equal(disk.data.value, 42);
  assert.equal(calls, 1);
  assert.equal(api.getStats().hits, 1);
});

test('requisições com ETag retornam 304 Not Modified e atualizam metadados sem queimar cota', async t => {
  let calls = 0;
  let sentIfNoneMatch = null;
  const api = await client(t, async (_url, options) => {
    calls++;
    sentIfNoneMatch = options.headers?.['If-None-Match'] || null;
    if (calls === 1) {
      return new Response(JSON.stringify({ version: '1.0' }), {
        headers: { etag: '"etag-12345"', 'x-ratelimit-remaining': '5000' }
      });
    }
    if (calls === 2) {
      assert.equal(sentIfNoneMatch, '"etag-12345"');
      return new Response(null, {
        status: 304,
        headers: { etag: '"etag-12345"', 'x-ratelimit-remaining': '5000' }
      });
    }
  });

  const first = await api.get('/repos/test/version');
  assert.equal(calls, 1);
  assert.equal(first.data.version, '1.0');
  assert.equal(first.etag, '"etag-12345"');
  assert.equal(first.url, 'https://api.github.com/repos/test/version');

  const revalidated = await api.get('/repos/test/version', { revalidate: true });
  assert.equal(calls, 2);
  assert.equal(revalidated.data.version, '1.0');
  assert.equal(revalidated.etag, '"etag-12345"');
  assert.equal(api.getStats().revalidations304, 1);
});

test('escrita atômica concorrente em disco não colide nem corrompe arquivos', async t => {
  const api = await client(t, async url => {
    return new Response(JSON.stringify({ url: String(url) }));
  });
  const tasks = Array.from({ length: 20 }, (_, i) => api.get(`/page-${i}`));
  const results = await Promise.all(tasks);
  assert.equal(results.length, 20);
  for (let i = 0; i < 20; i++) {
    assert.equal(results[i].data.url, `https://api.github.com/page-${i}`);
  }
});

