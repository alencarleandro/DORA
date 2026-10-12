import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate, calculateDeploymentFrequency, calculateLeadTime, quantile, quantiles, sortedQuantile, timestamp, windowDates } from '../lib/metrics.mjs';
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

test('frequência de deploy calcula releases por semana na janela',()=>{
  const wStart='2024-01-01T00:00:00Z', wEnd='2024-12-31T23:59:59Z';
  const freq = calculateDeploymentFrequency(52, wStart, wEnd);
  assert.ok(Math.abs(freq - (52 / (366 / 7))) < 0.01);
  assert.equal(calculateDeploymentFrequency(10, Date.parse(wEnd), Date.parse(wStart)), null);
});

test('exemplo README RQ 02: release v1.1 com 13, 5 e 1 dias de lead time',()=>{
  const wStart='2024-01-01T00:00:00Z', wEnd='2024-12-31T23:59:59Z';
  const releases = [{
    tag_name: 'v1.1',
    published_at: '2024-03-15T00:00:00Z',
    base_tag: 'v1.0',
    has_previous_release: true,
    commits: [
      { sha: 'c1', author_date: '2024-03-02T00:00:00Z' },
      { sha: 'c2', author_date: '2024-03-10T00:00:00Z' },
      { sha: 'c3', author_date: '2024-03-14T00:00:00Z' }
    ]
  }];
  const res = calculateLeadTime(releases, wEnd, wStart);
  assert.equal(res.releases_in_window, 1);
  assert.equal(res.releases_evaluated, 1);
  assert.equal(res.releases_ignored, 0);
  assert.equal(res.commits_total, 3);
  assert.equal(res.lead_time_release_median_days, 13);
  assert.equal(res.lead_time_release_median_hours, 13 * 24);
  assert.equal(res.lead_time_commit_median_days, 5);
  assert.equal(res.lead_time_commit_median_hours, 5 * 24);
  assert.equal(res.eligible_releases, false);
});

test('lead time: múltiplas releases, quantis, exclusões e casos de borda',()=>{
  const wStart='2024-01-01T00:00:00Z', wEnd='2024-12-31T23:59:59Z';
  const releases = [
    { tag_name: 'v1.0', published_at: '2024-01-10T00:00:00Z', has_previous_release: false, commits: [{ author_date: '2024-01-05T00:00:00Z' }] },
    { tag_name: 'v1.1', published_at: '2024-02-10T00:00:00Z', has_previous_release: true, compare_error: 'not_found', commits: [] },
    { tag_name: 'v1.2', published_at: '2024-03-10T00:00:00Z', has_previous_release: true, commits: [] },
    { tag_name: 'v2.0', published_at: '2025-01-10T00:00:00Z', has_previous_release: true, commits: [{ author_date: '2025-01-01T00:00:00Z' }] },
    { tag_name: 'v1.3', published_at: '2024-04-10T00:00:00Z', has_previous_release: true, commits: [{ commit: { author: { date: '2024-04-08T00:00:00Z' } } }] },
    { tag_name: 'v1.4', published_at: '2024-05-10T00:00:00Z', has_previous_release: true, commits: [{ commit: { author: { date: '2024-05-06T00:00:00Z' } } }] },
    { tag_name: 'v1.5', published_at: '2024-06-10T00:00:00Z', has_previous_release: true, commits: [{ commit: { author: { date: '2024-06-04T00:00:00Z' } } }] },
    { tag_name: 'v1.6', published_at: '2024-07-10T00:00:00Z', has_previous_release: true, commits: [{ commit: { author: { date: '2024-07-02T00:00:00Z' } } }] },
    { tag_name: 'v1.7', published_at: '2024-08-10T00:00:00Z', has_previous_release: true, commits: [{ commit: { author: { date: '2024-08-05T00:00:00Z' } } }] }
  ];
  const res = calculateLeadTime(releases, wEnd, wStart);
  assert.equal(res.releases_in_window, 8);
  assert.equal(res.releases_ignored_no_previous, 1);
  assert.equal(res.releases_ignored_compare_error, 1);
  assert.equal(res.releases_ignored_no_commits, 1);
  assert.equal(res.releases_ignored, 3);
  assert.equal(res.releases_evaluated, 5);
  assert.equal(res.eligible_releases, true);
  assert.ok(res.lead_time_release_median_days > 0);
  assert.ok(res.lead_time_release_iqr_days >= 0);
  assert.ok(res.lead_time_commit_iqr_hours >= 0);
});

test('lead time com janela aberta ou sem releases válidas',()=>{
  const resEmpty = calculateLeadTime([], '2024-12-31T23:59:59Z');
  assert.equal(resEmpty.releases_in_window, 0);
  assert.equal(resEmpty.lead_time_release_median_hours, null);
  assert.equal(resEmpty.lead_time_commit_median_hours, null);
  assert.equal(resEmpty.deployment_frequency, null);
});

test('calculateLeadTime processa release com 100.000 commits sem RangeError', () => {
  const wStart = '2024-01-01T00:00:00Z', wEnd = '2024-12-31T23:59:59Z';
  const pubTime = Date.parse('2024-06-01T12:00:00Z');
  const count = 100000;
  const commits = new Array(count);
  for (let i = 0; i < count; i++) {
    commits[i] = { author_date: '2024-05-01T00:00:00Z' };
  }
  commits[0] = { author_date: '2024-04-01T00:00:00Z' };
  const releases = [{
    tag_name: 'v100k',
    published_at: '2024-06-01T12:00:00Z',
    has_previous_release: true,
    commits
  }];
  const res = calculateLeadTime(releases, wEnd, wStart);
  assert.equal(res.commits_total, 100000);
  assert.equal(res.releases_evaluated, 1);
  const oldestCommit = Date.parse('2024-04-01T00:00:00Z');
  const expectedReleaseLeadHours = (pubTime - oldestCommit) / 3600000;
  assert.equal(res.lead_time_release_median_hours, expectedReleaseLeadHours);
  assert.equal(res.lead_time_release_median_days, expectedReleaseLeadHours / 24);
  assert.ok(res.lead_time_commit_median_hours > 0);
});

test('quantiles e IQR calculam valores exatos com e sem interpolação', () => {
  assert.deepEqual(quantiles([]), { median: null, q1: null, q3: null, iqr: null });
  assert.equal(sortedQuantile([], 0.5), null);

  assert.deepEqual(quantiles([42]), { median: 42, q1: 42, q3: 42, iqr: 0 });

  assert.deepEqual(quantiles([10, 20, 30, 40, 50]), { median: 30, q1: 20, q3: 40, iqr: 20 });
  assert.equal(sortedQuantile([10, 20, 30, 40, 50], 0.25), 20);
  assert.equal(sortedQuantile([10, 20, 30, 40, 50], 0.5), 30);
  assert.equal(sortedQuantile([10, 20, 30, 40, 50], 0.75), 40);

  assert.deepEqual(quantiles([1, 2, 4, 8]), { median: 3, q1: 1.75, q3: 5, iqr: 3.25 });
  assert.equal(quantile([8, 1, 4, 2], 0.25), 1.75);
  assert.equal(quantile([8, 1, 4, 2], 0.5), 3);
  assert.equal(quantile([8, 1, 4, 2], 0.75), 5);

  const runs = [
    run(1, 'success', '08:00'),
    run(2, 'failure', '09:00'),
    run(3, 'success', '11:00'),
    run(4, 'failure', '12:00'),
    run(5, 'success', '16:00'),
    run(6, 'failure', '17:00'),
    run(7, 'success', '23:00', 10, { run_started_at: '2026-01-11T01:00:00Z', updated_at: '2026-01-11T01:00:00Z' })
  ];
  const m = calculate(runs, 'main', '2026-01-12T00:00:00Z');
  assert.equal(m.recovery_median_hours, 4);
  assert.equal(m.recovery_q1_hours, 3);
  assert.equal(m.recovery_q3_hours, 6);
  assert.equal(m.recovery_iqr_hours, 3);
});

