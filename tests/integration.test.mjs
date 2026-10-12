import {fake} from './fixtures/integration-api.mjs';
import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
const temporary = fs.mkdtempSync(path.join(os.tmpdir(),'dora-integrated-'));
process.env.DORA_DATA_DIR=temporary;
const {create,execute,summary,exportJob,load,save,flush,saveImmediate} = await import('../lib/pipeline.mjs');
const {parseCSV} = await import('../lib/csv.mjs');
test('B calcula CFR b e preserva notas ao importar CSV sem rede',async()=>{
 const {toCSV}=await import('../lib/csv.mjs');const {RELEASE_DATA_HEADERS}=await import('../lib/datasets.mjs');
 const rows=['2026-01-01','2026-01-03','2026-01-30'].map((date,i)=>({repository:'a/local',default_branch:'main',window_start:'2026-01-01',window_end:'2026-01-31',tag_name:'v1.0.'+i,published_at:date+'T12:00:00Z',base_tag:'v1.0.'+(i-1),has_previous_release:true,compare_error:'',name:'Release',body:i===1?'Hotfix for a crash':'',commits_json:JSON.stringify([{sha:'sha'+i,author_date:date+'T00:00:00Z',message:'feat: update'}])}));
 const b=create({mode:'releases',dataSource:'csv',csv:toCSV(rows,RELEASE_DATA_HEADERS),start:'2026-01-01',end:'2026-01-31'});
 const denied=new Proxy({},{get(){throw new Error('API proibida no processamento local');}});await execute(b,{github:denied});
 assert.equal(b.status,'completed');assert.equal(b.results[0].cfr_b,.5);assert.equal(b.results[0].cfr_b_releases_censored,1);
 assert.equal(parseCSV(exportJob(b,'metrics'))[0].cfr_b,'0.5');assert.equal(JSON.parse(fs.readFileSync(path.join(temporary,'jobs',b.id,'a%2Flocal.releases.json'),'utf8')).releases[1].body,'Hotfix for a crash');
});
after(()=>fs.rmSync(temporary,{recursive:true,force:true}));
const input={collectData:false,mode:'integrated',source:'csv',start:'2026-01-01',end:'2026-01-31',candidateLimit:10,sampleSize:1,csv:'full_name,default_branch\na/good,trunk\na/other,trunk\na/noactions,trunk\na/fewreleases,trunk\na/fewruns,trunk'};
test('A seleciona; B/C usam mesma amostra, branch e janela; exports combinam os dados',async()=>{
  const api=fake(),job=create(input);await execute(job,{github:api});
  assert.equal(job.status,'completed');assert.equal(job.results.length,1);
  const r=job.results[0];assert.equal(r.repository,'a/good');assert.equal(r.default_branch,'trunk');assert.equal(r.releases_in_window,5);assert.equal(r.runs_valid,50);assert.equal(r.cfr_ci,.02);assert.ok(r.lead_time_commit_median_hours>0);
  assert.ok(api.calls.some(u=>u.includes('v0...v1')),'release anterior fora da janela é usada');
  assert.ok(!api.calls.some(u=>u.includes('/other/compare/')||u.includes('/fewruns/compare/')),'B não coleta excluídos ou acima do limite');
  assert.equal(summary(job).funnel.selected,1);
  const decisions=parseCSV(exportJob(job,'decisions'));
  assert.equal(decisions.find(d=>d.full_name==='a/noactions').reason,'sem_actions');
  assert.equal(decisions.find(d=>d.full_name==='a/fewreleases').reason,'menos_de_5_releases');
  assert.equal(decisions.find(d=>d.full_name==='a/fewruns').reason,'menos_de_50_runs_validos');
  assert.equal(decisions.find(d=>d.full_name==='a/other').decision,'not_selected');
  assert.deepEqual(parseCSV(exportJob(job,'repositories')),[{full_name:'a/good',default_branch:'trunk'}]);
  assert.equal(parseCSV(exportJob(job,'releases')).length,5);assert.equal(parseCSV(exportJob(job,'commits')).length,10);assert.equal(parseCSV(exportJob(job,'tags'))[0].commit_sha,'head');
  assert.equal(parseCSV(exportJob(job,'metrics'))[0].releases_in_window,'5');assert.equal(parseCSV(exportJob(job,'runs')).length,50);
  for(const stage of summary(job).funnel.stages) assert.equal(stage.entered,stage.excluded+stage.errors+stage.pending+stage.not_selected+stage.remaining);
  const restored=load(job.id),before=api.calls.length;await execute(restored,{github:api});assert.equal(api.calls.length,before,'retomada não repete repositórios concluídos');
});
test('busca da parte A está disponível sem CSV e preserva fotografia e consultas',async()=>{
  const job=create({...input,source:'search',csv:''}),api=fake();await execute(job,{github:api});
  assert.equal(job.status,'completed');assert.equal(job.source,'search');assert.equal(job.selection.queries.length,1);assert.ok(job.config.searchUntil);
  assert.equal(parseCSV(exportJob(job,'queries')).length,1);
});
test('amostra insuficiente é explícita e erros não viram exclusões',async()=>{
  const job=create({...input,sampleSize:3}),api=fake();await execute(job,{github:api});assert.equal(job.status,'insufficient_sample');assert.equal(summary(job).funnel.selected,2);
  const errorJob=create({...input,csv:'full_name\na/broken'}),bad=fake();bad.get=async()=>{throw new Error('GitHub HTTP 500');};
  await execute(errorJob,{github:bad});assert.equal(errorJob.status,'partial');assert.equal(summary(errorJob).funnel.stages[1].errors,1);assert.equal(summary(errorJob).funnel.stages[1].excluded,0);
});
test('falha de B é retomável sem repetir A; pausa e rate limit preservam estado',async()=>{
  const job=create({...input,csv:'full_name\na/good'});await execute(job,{github:fake({failCompare:true})});assert.equal(job.status,'partial');assert.equal(job.results.length,0);
  const good=fake();await execute(load(job.id),{github:good});assert.equal(load(job.id).status,'completed');assert.ok(!good.calls.some(u=>u.includes('contributors')));
  const paused=create({...input,csv:'full_name\na/good'}),controller=new AbortController();await execute(paused,{github:fake({onCompare:()=>controller.abort()}),signal:controller.signal});assert.equal(paused.status,'paused');assert.equal(summary(paused).funnel.selected,1);
  await execute(load(paused.id),{github:fake()});assert.equal(load(paused.id).status,'completed');
  const limited=create({...input,source:'search'}),rate=fake();rate.get=async()=>{const e=new Error('Rate limit');e.code='RATE_LIMIT_WAIT';throw e;};await execute(limited,{github:rate});assert.equal(limited.status,'paused');assert.equal(limited.selection.discovered,false);
});
test('branch incorreto do CSV é erro explícito e não alimenta B/C',async()=>{
  const job=create({...input,csv:'full_name,default_branch\na/good,main'}),api=fake();await execute(job,{github:api});
  assert.equal(job.status,'partial');assert.equal(job.results.length,0);assert.match(job.errors[0].message,/default_branch/);assert.ok(!api.calls.some(u=>u.includes('/compare/')));
});
test('valida limites antes de iniciar ou persistir uma coleta',()=>{
  assert.throws(()=>create({...input,sampleSize:11}),/amostra/);
  assert.throws(()=>create({...input,candidateLimit:1001}),/1.000/);
  assert.throws(()=>create({...input,source:'csv',csv:''}),/CSV/);
  assert.throws(()=>create({...input,end:'2028-01-01'}),/janela/);
});
test('A isolada exporta a amostra sem executar comparações ou métricas de B/C',async()=>{
  const job=create({...input,mode:'selection'}),api=fake();await execute(job,{github:api});
  assert.equal(job.status,'completed');assert.equal(job.results.length,1);assert.equal(job.results[0].lead_time_release_median_hours,undefined);assert.equal(job.results[0].cfr_ci,undefined);
  assert.ok(!api.calls.some(c=>c.includes('/compare/')||c.includes('/tags')));
  assert.equal(parseCSV(exportJob(job,'repositories'))[0].full_name,'a/good');assert.throws(()=>exportJob(job,'runs'),/dados completos/);
});
test('B e C usam a amostra e a janela de A, sem executar as outras partes',async()=>{
  const a=create({...input,mode:'selection',collectData:true});await execute(a,{github:fake()});
  const b=create({mode:'releases',sourceJobId:a.id,start:'2020-01-01',end:'2020-02-01'}),bAPI=fake();await execute(b,{github:bAPI});
  assert.equal(b.start,a.start);assert.equal(b.end,a.end);assert.equal(b.total,1);assert.equal(b.source_job_id,a.id);assert.equal(b.status,'completed');assert.equal(b.results[0].releases_in_window,5);
  assert.ok(!bAPI.calls.some(c=>c.startsWith('runs:')||c.includes('/actions/')||c.includes('/contributors')));
  assert.equal(parseCSV(exportJob(b,'commits')).length,10);assert.throws(()=>exportJob(b,'metadata'),/indisponível/);
  const c=create({mode:'collect',sourceJobId:a.id}),cAPI=fake();await execute(c,{github:cAPI});
  assert.equal(c.start,a.start);assert.equal(c.status,'completed');assert.equal(c.results[0].runs_valid,50);assert.equal(c.results[0].cfr_ci,.02);
  assert.ok(!cAPI.calls.some(u=>u.includes('/releases')||u.includes('/compare/')||u.includes('/tags')||u.includes('/contributors')));
  assert.throws(()=>create({mode:'releases',sourceJobId:b.id}),/seleção A/);
});
test('B isolada continua erros sem repetir repositórios concluídos',async()=>{
  const job=create({...input,mode:'releases',csv:'full_name,default_branch\na/good,trunk'});
  await execute(job,{github:fake({failCompare:true})});assert.equal(job.status,'partial');assert.equal(job.results.length,0);
  await execute(load(job.id),{github:fake()});const restored=load(job.id);assert.equal(restored.status,'completed');
  const api=fake();await execute(restored,{github:api});assert.equal(api.calls.length,0);
});

test('ampliação preserva os aprovados e processa somente candidatos novos até completar a amostra',async()=>{
 const {expandSelection}=await import('../lib/pipeline.mjs');
 const job=create({...input,mode:'selection',source:'search',candidateLimit:1,sampleSize:1});await execute(job,{github:fake()});
 const original=job.results[0];job.config.sampleSize=2;expandSelection(job,3);
 const api=fake();const get=api.get;api.get=async u=>u.includes('/search/')?{data:{total_count:3,items:[{id:1,full_name:'a/good'},{id:2,full_name:'a/other'},{id:3,full_name:'a/unused'}]}}:get(u);
 await execute(job,{github:api});assert.equal(job.results.length,2);assert.deepEqual(job.results[0],original);assert.equal(job.selection.candidates.length,3);assert.ok(!api.calls.some(u=>u.includes('/a/good')||u.includes('/a/unused')));
 assert.throws(()=>expandSelection(job,3),/maior/);assert.equal(job.status,'completed');
});

test('A exporta CSVs completos; B e C calculam com API indisponível, sem token',async()=>{
 const a=create({...input,mode:'selection',collectData:true});await execute(a,{github:fake()});
 assert.equal(a.datasets.status,'completed');assert.equal(a.results[0].cfr_ci,undefined);
 const csvB=exportJob(a,'release-data'),csvC=exportJob(a,'runs');assert.equal(parseCSV(csvB).length,5);assert.equal(parseCSV(csvC).length,50);
 const denied={get:()=>{throw new Error('API proibida');},pages:()=>{throw new Error('API proibida');},runs:()=>{throw new Error('API proibida');}};
 const b=create({mode:'releases',dataSource:'csv',csv:csvB,start:a.start,end:a.end});await execute(b,{github:denied});assert.equal(b.status,'completed');assert.equal(b.results[0].releases_in_window,5);assert.equal(b.results[0].commits_total,10);
 const c=create({mode:'import',csv:csvC,start:a.start,end:a.end});await execute(c,{github:denied});assert.equal(c.status,'completed');assert.equal(c.results[0].cfr_ci,.02);
 const linkedB=create({mode:'releases',sourceJobId:a.id}),linkedC=create({mode:'collect',sourceJobId:a.id});await execute(linkedB,{github:denied});await execute(linkedC,{github:denied});assert.equal(linkedB.status,'completed');assert.equal(linkedC.status,'completed');
 assert.equal(linkedB.results[0].lead_time_release_median_hours,b.results[0].lead_time_release_median_hours);assert.equal(linkedC.results[0].recovery_median_hours,c.results[0].recovery_median_hours);
 assert.throws(()=>create({mode:'releases',dataSource:'csv',csv:csvB,start:'2026-02-01',end:'2026-02-28'}),/janela/);
});
test('coleta completa de A retoma arquivos prontos e bloqueia CSVs incompletos',async()=>{
 const a=create({...input,mode:'selection',collectData:true});const api=fake();api.runs=async()=>{throw new Error('Falha de rede');};
 // Qualificação independente da coleta completa.
 api.qualifyRuns=async()=>({count:50,complete:false});await execute(a,{github:api});assert.equal(a.datasets.status,'partial');assert.throws(()=>exportJob(a,'release-data'),/dados completos/);assert.throws(()=>create({mode:'collect',sourceJobId:a.id}),/dados completos/);
 const retry=fake();await execute(load(a.id),{github:retry});const restored=load(a.id);assert.equal(restored.datasets.status,'completed');assert.ok(!retry.calls.some(u=>u.includes('/compare/')||u.includes('/tags')));assert.equal(parseCSV(exportJob(restored,'runs')).length,50);
});

test('CSV de B rejeita commits duplicados e comparações incompletas',async()=>{
 const a=create({...input,mode:'selection',collectData:true});await execute(a,{github:fake()});
 const {toCSV}=await import('../lib/csv.mjs');const {RELEASE_DATA_HEADERS}=await import('../lib/datasets.mjs');
 const rows=parseCSV(exportJob(a,'release-data'));const commits=JSON.parse(rows[0].commits_json);rows[0].commits_json=JSON.stringify([...commits,commits[0]]);
 assert.throws(()=>create({mode:'releases',dataSource:'csv',csv:toCSV(rows,RELEASE_DATA_HEADERS),start:a.start,end:a.end}),/duplicado/);
 rows[0].commits_json=JSON.stringify(commits);rows[0].compare_error='not_found';assert.throws(()=>create({mode:'releases',dataSource:'csv',csv:toCSV(rows,RELEASE_DATA_HEADERS),start:a.start,end:a.end}),/incompleta/);
 rows[0].commits_json='[]';const b=create({mode:'releases',dataSource:'csv',csv:toCSV(rows,RELEASE_DATA_HEADERS),start:a.start,end:a.end});await execute(b,{github:{get:()=>assert.fail('Não deve usar rede')}});assert.equal(b.status,'completed');assert.equal(b.results[0].releases_ignored_compare_error,1);
});

test('B/C usam subconjunto local completo, mesmo quando a coleta A não terminou',async()=>{
 const a=create({...input,mode:'selection',sampleSize:2,collectData:true});const api=fake();const runs=api.runs;api.runs=async(name,...args)=>{if(name==='a/other')throw new Error('interrompido');return runs(name,...args);};api.qualifyRuns=async()=>({count:50,complete:false});await execute(a,{github:api});
 const denied={get:async()=>{throw new Error('API proibida');}};
 for(const mode of ['releases','collect']){const local=create({mode,sourceJobId:a.id,allowPartialLocal:true});await execute(local,{github:denied});assert.equal(local.status,'completed');assert.ok(local.local_base.partial||mode==='releases');assert.ok(local.total>=1);assert.match(summary(local).funnel.note,mode==='collect'?/Base local parcial/:/Parte B/);}
 assert.equal(create({mode:'collect',sourceJobId:a.id,allowPartialLocal:true}).total,1);assert.equal(create({mode:'releases',sourceJobId:a.id,allowPartialLocal:true}).total,2);
});

test('save aplica throttle em 50 escritas intermediárias resultando em escrita única após debounce e immediate grava na hora', async () => {
  const jobId = randomUUID();
  const job = { id: jobId, mode: 'collect', status: 'running', progress: 0, results: [], errors: [], logs: [] };
  const file = path.join(temporary, 'jobs', jobId, 'job.json');

  let writes = 0;
  const originalWrite = fs.writeFileSync;
  fs.writeFileSync = function(filePath, ...args) {
    if (typeof filePath === 'string' && filePath.includes(jobId)) {
      writes++;
    }
    return originalWrite.call(this, filePath, ...args);
  };

  try {
    for (let i = 0; i < 50; i++) {
      job.progress = i;
      save(job, { immediate: false });
    }
    assert.equal(writes, 0, 'nenhuma escrita em disco síncrona durante o throttle');
    assert.equal(fs.existsSync(file), false, 'arquivo não existe antes do término do debounce');

    await new Promise(r => setTimeout(r, 380));

    assert.equal(writes, 1, 'exatamente uma escrita em disco após o debounce');
    assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).progress, 49, 'arquivo gravado reflete o último estado');

    job.progress = 100;
    save(job, { immediate: true });
    assert.equal(writes, 2, 'save com immediate: true grava imediatamente em disco');
    assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).progress, 100);

    job.progress = 150;
    saveImmediate(job);
    assert.equal(writes, 3, 'saveImmediate grava imediatamente');
    assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).progress, 150);

    job.progress = 200;
    save(job, { immediate: false });
    assert.equal(writes, 3, 'nenhuma escrita imediata ainda');
    flush(job);
    assert.equal(writes, 4, 'flush grava imediatamente');
    assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).progress, 200);

    await new Promise(r => setTimeout(r, 380));
    assert.equal(writes, 4, 'timer cancelado por flush não dispara novamente');
  } finally {
    fs.writeFileSync = originalWrite;
  }
});
