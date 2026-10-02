import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate, quantile, timestamp, windowDates } from '../lib/metrics.mjs';
const end='2026-01-10T23:59:59Z';
function run(id,conclusion,time,workflow=10,extra={}) { return {id,workflow_id:workflow,event:'push',head_branch:'main',conclusion,created_at:`2026-01-10T${time}:00Z`,run_started_at:`2026-01-10T${time}:00Z`,updated_at:`2026-01-10T${time}:00Z`,...extra}; }
test('exemplo README: falhas consecutivas formam um único episódio de 1h20',()=>{
  const runs=[run(1,'success','09:00'),run(2,'failure','10:00'),run(3,'failure','10:30'),run(4,'success','11:15',10,{updated_at:'2026-01-10T11:20:00Z'})];
  const m=calculate(runs,'main',end);assert.equal(m.cfr_ci,.5);assert.equal(m.episodes_total,1);assert.equal(m.recovery_median_hours,4/3);assert.equal(m.recovery_iqr_hours,0);assert.equal(m.censored_fraction,0);
});
test('conclusões ignoradas, branch, evento, janela e deduplicação',()=>{
  const ignored=['cancelled','skipped','neutral','action_required','stale','',null].map((c,i)=>run(10+i,c,'12:00'));
  const runs=[run(1,'success','09:00'),run(2,'startup_failure','10:00'),run(3,'timed_out','11:00'),...ignored,run(20,'failure','11:00',10,{event:'pull_request'}),run(21,'failure','11:00',10,{head_branch:'dev'}),run(22,'failure','11:00',10,{created_at:'2025-01-01T00:00:00Z'}),run(23,'failure','11:00',10,{created_at:'2027-01-01T00:00:00Z'}),run(1,'success','09:00')];
  const m=calculate(runs,'main',end,Date.parse('2026-01-01T00:00:00Z'));assert.equal(m.runs_valid,3);assert.equal(m.runs_ignored,7);assert.equal(m.cfr_ci,2/3);assert.equal(m.episodes_censored,1);assert.equal(m.censored_fraction,1);assert.equal(m.recovery_median_hours,null);assert.equal(m.episodes[0].hours,(Date.parse(end)-Date.parse('2026-01-10T10:00:00Z'))/3600000);
});
test('recuperações são isoladas por workflow e ordenadas',()=>{
  const m=calculate([run(4,'success','13:00',20),run(3,'failure','10:00'),run(2,'success','09:00',20),run(1,'success','08:00'),run(5,'failure','14:00',20),run(6,'success','12:00')],'main',end);
  assert.equal(m.episodes_total,2);assert.equal(m.episodes_censored,1);assert.equal(m.recovery_median_hours,2);
});
test('primeiras falhas sem sucesso prévio ficam contabilizadas, sem episódio observável',()=>{
  const m=calculate([run(1,'failure','09:00'),run(2,'success','10:00')],'main',end);assert.equal(m.initial_failures_without_success,1);assert.equal(m.episodes_total,0);assert.equal(m.censored_fraction,null);
});
test('sucesso terminado após janela não encerra episódio',()=>{
  const m=calculate([run(1,'success','09:00'),run(2,'failure','10:00'),run(3,'success','11:00',10,{updated_at:'2026-01-11T01:00:00Z'})],'main',end);assert.equal(m.episodes_censored,1);
});
test('run iniciado após janela não altera episódios',()=>{
  const m=calculate([run(1,'success','09:00'),run(2,'failure','10:00',10,{run_started_at:'2026-01-11T00:00:00Z'})],'main',end);assert.equal(m.episodes_total,0);
});
test('vazio e sem runs válidos não geram taxas zero',()=>{
  for(const runs of [[],[run(1,'cancelled','09:00')]]){const m=calculate(runs,'main',end);assert.equal(m.cfr_ci,null);assert.equal(m.recovery_median_hours,null);assert.equal(m.recovery_iqr_hours,null);assert.equal(m.eligible_runs,false);}
});
test('limite de 50 runs e quantis interpolados',()=>{
  assert.equal(calculate(Array.from({length:50},(_,i)=>run(i,'success','09:00')),'main',end).eligible_runs,true);
  assert.equal(quantile([], .5),null);assert.equal(quantile([4,1,3,2],.5),2.5);assert.equal(quantile([4,1,3,2],.25),1.75);assert.equal(quantile([4,1,3,2],.75),3.25);
});
test('validação de datas e inconsistências',()=>{
  assert.throws(()=>timestamp('x'));assert.throws(()=>windowDates('x','2026-01-01'));assert.throws(()=>windowDates('2026-02-30','2026-03-01'));assert.throws(()=>windowDates('2026-10-01','2026-01-01'));assert.throws(()=>windowDates('2024-01-01','2026-01-01'));assert.equal(windowDates('2026-01-01','2026-12-31').start,Date.parse('2026-01-01T00:00:00Z'));
  assert.throws(()=>calculate([run(1,'failure','10:00',null)],'main',end),/workflow_id/);
  assert.throws(()=>calculate([run(1,'success','09:00'),run(2,'failure','10:00'),run(3,'success','11:00',10,{updated_at:'2026-01-10T08:00:00Z'})],'main',end),/anterior/);
});
