import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { GitHub } from './github.mjs';
import { repositories, parseCSV, toCSV } from './csv.mjs';
import { calculate, windowDates, timestamp } from './metrics.mjs';
export const DATA = path.resolve(process.env.DORA_DATA_DIR || 'data');
export const METRIC_HEADERS = ['repository','default_branch','runs_total','runs_valid','runs_ignored','failures','successes','cfr_ci','recovery_median_hours','recovery_q1_hours','recovery_q3_hours','recovery_iqr_hours','episodes_total','episodes_censored','censored_fraction','initial_failures_without_success','eligible_runs'];
export const RUN_HEADERS = ['repository','default_branch','id','workflow_id','event','head_branch','conclusion','created_at','run_started_at','updated_at'];
export const EPISODE_HEADERS = ['repository','workflow_id','failure_run_id','recovery_run_id','started_at','ended_at','hours','censored'];
export function save(job) {
  const folder = path.join(DATA, 'jobs', job.id); fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder,'job.json.tmp'), JSON.stringify(job)); fs.renameSync(path.join(folder,'job.json.tmp'),path.join(folder,'job.json'));
}
export function load(id) {
  if (!/^[a-f\d-]{36}$/.test(id)) throw new Error('Identificador inválido.');
  return JSON.parse(fs.readFileSync(path.join(DATA,'jobs',id,'job.json'),'utf8'));
}
export function list() {
  const folder = path.join(DATA,'jobs'); if (!fs.existsSync(folder)) return [];
  return fs.readdirSync(folder).filter(id => /^[a-f\d-]{36}$/.test(id)).map(load).sort((a,b) => b.created_at.localeCompare(a.created_at));
}
export function create(input) {
  windowDates(input.start,input.end);
  if (!['collect','import'].includes(input.mode)) throw new Error('Modo inválido.');
  const parsed = input.mode === 'collect' ? repositories(input.csv) : imported(input.csv);
  if (!parsed.length) throw new Error('Nenhum repositório encontrado.');
  const job = { id:randomUUID(), mode:input.mode, start:input.start, end:input.end, csv:input.csv, created_at:new Date().toISOString(), status:'pending', progress:0, total:parsed.length, results:[], errors:[], logs:[], stage:'Pronto para iniciar' };
  save(job); return job;
}
export function imported(csv) {
  const rows = parseCSV(csv), groups = new Map(), seen = new Set();
  for (const row of rows) {
    const repository = row.repository || row.full_name;
    if (!/^[\w.-]+\/[\w.-]+$/.test(repository || '') || !row.default_branch) throw new Error('CSV de runs exige repository (owner/repo) e default_branch.');
    for (const key of ['id','workflow_id','event','head_branch','created_at','run_started_at','updated_at']) if (!row[key]) throw new Error(`Run sem ${key}.`);
    for (const key of ['created_at','run_started_at','updated_at']) timestamp(row[key]);
    const dedup = `${repository.toLowerCase()}:${row.id}`;
    if (seen.has(dedup)) throw new Error(`Run duplicado: ${dedup}.`); seen.add(dedup);
    const key = repository.toLowerCase(), group = groups.get(key) || { full_name:repository, default_branch:row.default_branch, runs:[] };
    if (group.default_branch !== row.default_branch) throw new Error('Default branches divergentes no mesmo repositório.');
    group.runs.push(row); groups.set(key,group);
  }
  return [...groups.values()];
}
export async function execute(job, { token = '', signal, onUpdate = () => {}, github } = {}) {
  const dates = windowDates(job.start,job.end), folder = path.join(DATA,'jobs',job.id);
  const update = () => { save(job); onUpdate(job); };
  const log = message => { job.stage = message; job.logs.push({ at:new Date().toISOString(), message }); job.logs = job.logs.slice(-200); update(); };
  const api = github || new GitHub({ token, cacheDir:path.join(folder,'cache'), signal, log });
  job.status = 'running'; job.errors = []; update();
  try {
    const repos = job.mode === 'collect' ? repositories(job.csv) : imported(job.csv);
    for (const repo of repos) {
      signal?.throwIfAborted();
      if (job.results.some(r => r.repository.toLowerCase() === repo.full_name.toLowerCase())) continue;
      try {
        let branch = repo.default_branch, runs = repo.runs;
        if (job.mode === 'collect') {
          log(`Consultando ${repo.full_name}`);
          const metadata = (await api.get(`/repos/${repo.full_name}`)).data;
          if (metadata.private) throw new Error('Somente repositórios públicos.');
          if (branch && branch !== metadata.default_branch) throw new Error(`default_branch do CSV difere do GitHub (${metadata.default_branch}).`);
          branch = metadata.default_branch;
          const workflows = (await api.get(`/repos/${repo.full_name}/actions/workflows?per_page=1`)).data;
          if (!workflows.total_count) { job.results.push({ repository:repo.full_name, default_branch:branch, excluded_reason:'sem_actions', eligible_runs:false }); update(); continue; }
          runs = await api.runs(repo.full_name,branch,dates.start,dates.end);
        }
        const metrics = calculate(runs,branch,new Date(dates.end).toISOString(),dates.start);
        const normalized = runs.map(r => Object.fromEntries(RUN_HEADERS.map(h => [h, h === 'repository' ? repo.full_name : h === 'default_branch' ? branch : r[h] ?? ''])));
        fs.writeFileSync(path.join(folder,`${encodeURIComponent(repo.full_name)}.runs.json`),JSON.stringify(normalized));
        job.results.push({ repository:repo.full_name, default_branch:branch, ...metrics, excluded_reason:metrics.eligible_runs ? '' : 'menos_de_50_runs_validos' });
        log(`${repo.full_name}: ${metrics.runs_valid} runs válidos`);
      } catch (error) {
        signal?.throwIfAborted();
        job.errors.push({ repository:repo.full_name, message:error.message }); log(`${repo.full_name}: ${error.message}`);
      } finally { job.progress = job.results.length+job.errors.length; update(); }
    }
    job.status = job.errors.length ? 'partial' : 'completed'; log(job.errors.length ? 'Concluído com erros. Retome para tentar os repositórios pendentes.' : 'Processamento concluído.');
  } catch (error) {
    job.status = signal?.aborted ? 'paused' : 'failed'; log(signal?.aborted ? 'Coleta pausada. Cache e resultados preservados.' : error.message);
  }
  update(); return job;
}
export function summary(job) {
  const { csv, results, ...rest } = job;
  return { ...rest, results:results.map(({episodes,...r}) => r), funnel:{ candidates:job.total, processed:results.length, with_actions:results.filter(r=>r.excluded_reason!=='sem_actions').length, eligible_runs:results.filter(r=>r.eligible_runs).length, errors:job.errors.length, note:'Filtro parcial da pessoa C. A amostra final exige também ≥ 5 releases (pessoa B).' } };
}
export function exportJob(job, kind) {
  if (kind === 'metrics') return toCSV(job.results,METRIC_HEADERS.concat('excluded_reason'));
  if (kind === 'episodes') return toCSV(job.results.flatMap(r => (r.episodes || []).map(e => ({repository:r.repository,...e}))),EPISODE_HEADERS);
  if (kind === 'runs') {
    const rows = job.results.flatMap(r => { const file = path.join(DATA,'jobs',job.id,`${encodeURIComponent(r.repository)}.runs.json`); return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file,'utf8')) : []; });
    return toCSV(rows,RUN_HEADERS);
  }
  if (kind === 'funnel') {
    const s = summary(job).funnel;
    return toCSV([{stage:'candidatos',count:s.candidates},{stage:'processados',count:s.processed},{stage:'com_actions',count:s.with_actions},{stage:'50_runs_validos',count:s.eligible_runs},{stage:'erros',count:s.errors}]);
  }
  throw new Error('Exportação desconhecida.');
}
