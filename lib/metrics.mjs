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
export function sortedQuantile(sorted, p) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * p, i = Math.floor(pos);
  return sorted[i] + (sorted[Math.ceil(pos)] - sorted[i]) * (pos - i);
}
export function quantiles(sorted) {
  if (!sorted.length) return { median: null, q1: null, q3: null, iqr: null };
  const q1 = sortedQuantile(sorted, 0.25);
  const median = sortedQuantile(sorted, 0.5);
  const q3 = sortedQuantile(sorted, 0.75);
  return { median, q1, q3, iqr: q3 - q1 };
}
export function quantile(values, p) {
  if (!values.length) return null;
  return sortedQuantile([...values].sort((a,b) => a-b), p);
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
    for (const r of list) r._started_at = timestamp(r.run_started_at);
    list.sort((a,b) => a._started_at - b._started_at || Number(a.id) - Number(b.id));
    let hadSuccess = false, active = null;
    for (const r of list) {
      const started = r._started_at;
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
  const observed = episodes.filter(e => !e.censored).map(e => e.hours);
  observed.sort((a, b) => a - b);
  const obsStats = quantiles(observed);
  const censored = episodes.filter(e => e.censored).length;
  return {
    runs_total: all.length, runs_valid: valid.length, runs_ignored: all.length-valid.length,
    failures, successes: valid.length-failures, cfr_ci: valid.length ? failures/valid.length : null,
    recovery_median_hours: obsStats.median, recovery_q1_hours: obsStats.q1, recovery_q3_hours: obsStats.q3,
    recovery_iqr_hours: obsStats.iqr,
    episodes_total: episodes.length, episodes_censored: censored, censored_fraction: episodes.length ? censored/episodes.length : null,
    initial_failures_without_success: initialFailures, eligible_runs: valid.length >= 50, episodes
  };
}

export function calculateDeploymentFrequency(releasesCount, windowStart, windowEnd) {
  const start = typeof windowStart === 'number' ? windowStart : timestamp(windowStart);
  const end = typeof windowEnd === 'number' ? windowEnd : timestamp(windowEnd);
  const weeks = (end - start) / (7 * 86400000);
  if (weeks <= 0) return null;
  return releasesCount / weeks;
}

export function calculateLeadTime(releases, windowEnd, windowStart = -Infinity) {
  const end = timestamp(windowEnd);
  const start = typeof windowStart === 'number' ? windowStart : timestamp(windowStart);
  const windowReleases = [];
  for (const r of releases) {
    const pub = timestamp(r.published_at);
    if (pub >= start && pub <= end) windowReleases.push(r);
  }
  const releaseHours = [], commitHours = [], evaluatedReleases = [];
  let ignoredNoPrevious = 0, ignoredCompareError = 0, ignoredNoCommits = 0;
  for (const r of windowReleases) {
    if (r.has_previous_release === false) { ignoredNoPrevious++; continue; }
    if (r.compare_error) { ignoredCompareError++; continue; }
    const commits = r.commits || [];
    if (!commits.length) { ignoredNoCommits++; continue; }
    const pub = timestamp(r.published_at);
    let oldest = Infinity;
    for (const c of commits) {
      const d = timestamp(c.author_date || c.commit?.author?.date);
      commitHours.push((pub - d) / 3600000);
      if (d < oldest) oldest = d;
    }
    const relH = (pub - oldest) / 3600000;
    releaseHours.push(relH);
    evaluatedReleases.push({
      tag_name: r.tag_name,
      published_at: r.published_at,
      base_tag: r.base_tag || '',
      commits_count: commits.length,
      lead_time_hours: relH,
      lead_time_days: relH / 24
    });
  }
  const evaluated = evaluatedReleases.length;
  const ignored = ignoredNoPrevious + ignoredCompareError + ignoredNoCommits;
  const weeks = Number.isFinite(start) ? (end - start) / (7 * 86400000) : null;
  releaseHours.sort((a, b) => a - b);
  commitHours.sort((a, b) => a - b);
  const relStats = quantiles(releaseHours);
  const comStats = quantiles(commitHours);
  return {
    releases_in_window: windowReleases.length,
    releases_evaluated: evaluated,
    releases_ignored: ignored,
    releases_ignored_no_previous: ignoredNoPrevious,
    releases_ignored_compare_error: ignoredCompareError,
    releases_ignored_no_commits: ignoredNoCommits,
    commits_total: commitHours.length,
    deployment_frequency: weeks && weeks > 0 ? windowReleases.length / weeks : null,
    lead_time_release_median_hours: relStats.median,
    lead_time_release_q1_hours: relStats.q1,
    lead_time_release_q3_hours: relStats.q3,
    lead_time_release_iqr_hours: relStats.iqr,
    lead_time_release_median_days: relStats.median !== null ? relStats.median / 24 : null,
    lead_time_release_iqr_days: relStats.iqr !== null ? relStats.iqr / 24 : null,
    lead_time_commit_median_hours: comStats.median,
    lead_time_commit_q1_hours: comStats.q1,
    lead_time_commit_q3_hours: comStats.q3,
    lead_time_commit_iqr_hours: comStats.iqr,
    lead_time_commit_median_days: comStats.median !== null ? comStats.median / 24 : null,
    lead_time_commit_iqr_days: comStats.iqr !== null ? comStats.iqr / 24 : null,
    eligible_releases: windowReleases.length >= 5,
    evaluated_releases: evaluatedReleases
  };
}
