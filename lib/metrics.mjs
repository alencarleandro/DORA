export const FAILURES = new Set(['failure', 'timed_out', 'startup_failure']);
export const VALID = new Set(['success', ...FAILURES]);
export function timestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) throw new Error(`Data inválida: ${value}. Use ISO 8601 com timezone.`);
  const n = Date.parse(value);
  if (!Number.isFinite(n)) throw new Error(`Data inválida: ${value}`);
  return n;
}
export function windowDates(start, end) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) throw new Error('Use datas AAAA-MM-DD.');
  const a = timestamp(`${start}T00:00:00Z`), b = timestamp(`${end}T23:59:59Z`);
  if (new Date(a).toISOString().slice(0, 10) !== start || new Date(b).toISOString().slice(0, 10) !== end) throw new Error('Data inexistente.');
  if (a >= b || b - a > 366 * 86400000) throw new Error('A janela deve ter início ≤ fim e no máximo 12 meses (366 dias).');
  return { start: a, end: b };
}
export function quantile(values, p) {
  if (!values.length) return null;
  const s = [...values].sort((a,b) => a-b), pos = (s.length - 1) * p, i = Math.floor(pos);
  return s[i] + (s[Math.ceil(pos)] - s[i]) * (pos - i);
}
export function calculate(runs, branch, windowEnd, windowStart = -Infinity) {
  const end = timestamp(windowEnd), unique = new Map();
  for (const r of runs) {
    const created = timestamp(r.created_at);
    if (r.event === 'push' && r.head_branch === branch && created >= windowStart && created <= end) unique.set(String(r.id), r);
  }
  const all = [...unique.values()], valid = all.filter(r => VALID.has(r.conclusion));
  const failures = valid.filter(r => FAILURES.has(r.conclusion)).length;
  const groups = new Map();
  for (const r of valid) {
    if (!r.workflow_id) throw new Error('Run sem workflow_id.');
    const list = groups.get(String(r.workflow_id)) || []; list.push(r); groups.set(String(r.workflow_id), list);
  }
  const episodes = []; let initialFailures = 0;
  for (const [workflow, list] of groups) {
    list.sort((a,b) => timestamp(a.run_started_at)-timestamp(b.run_started_at) || Number(a.id)-Number(b.id));
    let hadSuccess = false, active = null;
    for (const r of list) {
      const started = timestamp(r.run_started_at);
      if (started > end) continue;
      if (r.conclusion === 'success' && timestamp(r.updated_at) <= end) {
        if (active) {
          const finished = timestamp(r.updated_at);
          if (finished < active.start) throw new Error('Recuperação anterior ao início da falha.');
          episodes.push({ workflow_id: workflow, failure_run_id: active.id, recovery_run_id: r.id, started_at: new Date(active.start).toISOString(), ended_at: r.updated_at, hours: (finished-active.start)/3600000, censored: false });
          active = null;
        }
        hadSuccess = true;
      } else if (FAILURES.has(r.conclusion)) {
        if (!hadSuccess) initialFailures++;
        else if (!active) active = { start: started, id: r.id };
      }
    }
    if (active) episodes.push({ workflow_id: workflow, failure_run_id: active.id, recovery_run_id: '', started_at: new Date(active.start).toISOString(), ended_at: '', hours: (end-active.start)/3600000, censored: true });
  }
  const observed = episodes.filter(e => !e.censored).map(e => e.hours), censored = episodes.filter(e => e.censored).length;
  return {
    runs_total: all.length, runs_valid: valid.length, runs_ignored: all.length-valid.length,
    failures, successes: valid.length-failures, cfr_ci: valid.length ? failures/valid.length : null,
    recovery_median_hours: quantile(observed, .5), recovery_q1_hours: quantile(observed, .25), recovery_q3_hours: quantile(observed, .75),
    recovery_iqr_hours: observed.length ? quantile(observed,.75)-quantile(observed,.25) : null,
    episodes_total: episodes.length, episodes_censored: censored, censored_fraction: episodes.length ? censored/episodes.length : null,
    initial_failures_without_success: initialFailures, eligible_runs: valid.length >= 50, episodes
  };
}
