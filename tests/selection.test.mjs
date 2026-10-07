import {test} from 'node:test';
import assert from 'node:assert/strict';
import {discover,metadata,evidence,finalize,funnel,validateConfig} from '../lib/selection.mjs';
const config={minStars:1001,candidateLimit:10,sampleSize:1,start:'2025-10-01',end:'2026-09-30'};
test('busca particiona acima de mil, deduplica e ordena',async()=>{
  const calls=[];
  const api={get:async url=>{
    const q=new URL(url,'https://api.github.com').searchParams.get('q'); calls.push(q);
    if(q.includes('>=')) return {data:{total_count:2000,items:[{stargazers_count:1002}]}};
    if(q.includes('1001..1002')) return {data:{total_count:2000,items:[]}};
    return {data:{total_count:2,items:[{id:1,full_name:'a/a',stargazers_count:1002},{id:2,full_name:'b/b',stargazers_count:1001}]}};
  }};
  const rows=await discover(api,config);assert.equal(rows.length,2);assert.equal(rows[0].id,1);assert.equal(calls.length,4);
});
test('incompletude e paginação ausente não viram sucesso',async()=>{
  await assert.rejects(()=>discover({get:async()=>({data:{incomplete_results:true,items:[]}})},config),/incompleta/);
  let n=0; await assert.rejects(()=>discover({get:async()=>({data:++n===1?{items:[{stargazers_count:1001}]}:{total_count:2,items:[]}})},config),/Paginação/);
});
test('contribuidores última página; linguagem ausente e idade fixa',async()=>{
  const api={get:async url=>url.includes('contributors')?{data:[{}],last:'https://api.github.com/repos/a/b/contributors?per_page=1&page=17'}:{data:{id:1,full_name:'a/b',default_branch:'trunk',stargazers_count:1234,language:null,created_at:'2025-09-30T23:59:59Z'}}};
  const row=await metadata(api,{full_name:'a/b'},config);assert.equal(row.contributors_count,17);assert.equal(row.language,'');assert.equal(row.age_days,365);
});
test('contribuidores indisponíveis não são zero; sem janela não inventa idade',async()=>{
  const api={get:async url=>{if(url.includes('contributors'))throw new Error('HTTP 403');return {data:{full_name:'a/b',created_at:'2025-01-01'}};}};
  const row=await metadata(api,{full_name:'a/b'},{});assert.equal(row.contributors_count,'');assert.equal(row.age_days,'');assert.equal(row.metadata_status,'partial');
});
test('contribuidores vazio é zero e criação após janela é sinalizada',async()=>{
  const row=await metadata({get:async url=>url.includes('contributors')?{data:[]}:{data:{full_name:'a/b',created_at:'2026-10-01'}}},{full_name:'a/b'},config);
  assert.equal(row.contributors_count,0);assert.equal(row.age_days,'');assert.equal(row.metadata_status,'created_after_window');
});
test('filtros aplicam primeira exclusão; errors não são exclusões',async()=>{
  const noActions=await evidence({get:async()=>({data:{total_count:0}})},{full_name:'a/b'},config);assert.equal(noActions.reason,'sem_actions');
  const error=await evidence({get:async()=>{throw new Error('404');}},{full_name:'a/b'},config);assert.equal(error.decision,'error');
  const releases=await evidence({get:async()=>({data:{total_count:2}}),pages:async()=>[{draft:false,prerelease:true,published_at:'2026-01-01'}]},{full_name:'a/b'},config);assert.equal(releases.releases_count,0);assert.equal(releases.reason,'menos_de_5_releases');
});
test('funil conserva totais e separa pendentes, erros, não selecionados',()=>{
  const rows=finalize([{decision:'eligible'},{decision:'eligible'},{decision:'excluded',reason:'sem_actions'},{decision:'error',actions_count:''},{decision:'pending'}],1);
  assert.equal(rows[0].decision,'selected');assert.equal(rows[1].decision,'not_selected');
  const stages=funnel(rows); for(const row of stages)assert.equal(row.entered,row.excluded+row.errors+row.pending+row.not_selected+row.remaining);
  assert.equal(stages.at(-1).remaining,1);assert.equal(stages[1].excluded,1);assert.equal(stages[1].errors,1);
});
test('modo full exige datas oficiais e configuração válida',()=>{
  assert.throws(()=>validateConfig({...config,start:null,end:null},'full'));
  assert.throws(()=>validateConfig({...config,candidateLimit:NaN},'metadata'));
});

test('janela aceita todo o ano bissexto de 2024',()=>{
  assert.doesNotThrow(()=>validateConfig({...config,start:'2024-01-01',end:'2024-12-31'},'full'));
});
