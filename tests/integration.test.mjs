import {fake} from './fixtures/integration-api.mjs';
import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const temporary = fs.mkdtempSync(path.join(os.tmpdir(),'dora-integrated-'));
process.env.DORA_DATA_DIR=temporary;
const {create,execute,summary,exportJob,load} = await import('../lib/pipeline.mjs');
const {parseCSV} = await import('../lib/csv.mjs');
after(()=>fs.rmSync(temporary,{recursive:true,force:true}));
const input={mode:'integrated',source:'csv',start:'2026-01-01',end:'2026-01-31',candidateLimit:10,sampleSize:1,csv:'full_name,default_branch\na/good,trunk\na/other,trunk\na/noactions,trunk\na/fewreleases,trunk\na/fewruns,trunk'};
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
  assert.equal(parseCSV(exportJob(job,'repositories'))[0].full_name,'a/good');assert.throws(()=>exportJob(job,'runs'),/indisponível/);
});
test('B e C usam a amostra e a janela de A, sem executar as outras partes',async()=>{
  const a=create({...input,mode:'selection'});await execute(a,{github:fake()});
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
