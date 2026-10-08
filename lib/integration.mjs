import fs from 'node:fs';
import path from 'node:path';
import { repositories, toCSV } from './csv.mjs';
import { validateConfig, discover, metadata, evidence, finalize, funnel, METADATA_HEADERS, DECISION_HEADERS } from './selection.mjs';
import { collectReleasesAndCommits, getTags } from './releases.mjs';
import { calculate, calculateLeadTime, windowDates } from './metrics.mjs';

export const INTEGRATED_HEADERS = ['repository','default_branch','stars','language','contributors_count','age_days',
  'releases_in_window','deployment_frequency','releases_evaluated','releases_ignored','releases_ignored_no_previous','releases_ignored_compare_error','releases_ignored_no_commits','commits_total',
  'lead_time_release_median_hours','lead_time_release_q1_hours','lead_time_release_q3_hours','lead_time_release_iqr_hours','lead_time_release_median_days','lead_time_release_iqr_days',
  'lead_time_commit_median_hours','lead_time_commit_q1_hours','lead_time_commit_q3_hours','lead_time_commit_iqr_hours','lead_time_commit_median_days','lead_time_commit_iqr_days',
  'runs_total','runs_valid','runs_ignored','failures','successes','cfr_ci','recovery_median_hours','recovery_q1_hours','recovery_q3_hours','recovery_iqr_hours',
  'episodes_total','episodes_censored','censored_fraction','initial_failures_without_success','eligible_releases','eligible_runs','selected'];
const RELEASE_HEADERS = ['repository','tag_name','published_at','base_tag','has_previous_release','compare_error','commits_count','lead_time_hours'];
const COMMIT_HEADERS = ['repository','release_tag','release_published_at','commit_sha','author_date','message','lead_time_hours'];

export function integrationConfig(input) {
  const source = input.source || 'search';
  if (!['search','csv'].includes(source)) throw new Error('Origem de candidatos inválida.');
  const config = {
    minStars:Number(input.minStars ?? 1001), candidateLimit:Number(input.candidateLimit ?? 300),
    sampleSize:Number(input.sampleSize ?? 100), excludeForks:true, excludeArchived:true,
    start:input.start, end:input.end, searchUntil:Math.floor(Date.now()/1000)
  };
  validateConfig(config,'full');
  if (config.sampleSize > config.candidateLimit || config.candidateLimit > 1000) throw new Error('Use uma amostra ≤ candidatos e até 1.000 candidatos.');
  if (source === 'csv') {
    const rows = repositories(input.csv);
    if (rows.length > config.candidateLimit) throw new Error('O CSV excede o limite de candidatos informado.');
  }
  return { source, config };
}

export function integrationSelection(job) {
  const state = job.selection;
  return finalize((state?.candidates || []).map(c => state.decisions.find(d => d.full_name.toLowerCase() === c.full_name.toLowerCase()) || {
    full_name:c.full_name, actions_count:'', releases_count:'', valid_runs_count:'', decision:'pending', reason:'aguarda_coleta', error:''
  }),job.config?.sampleSize ?? job.total);
}

export async function executeIntegrated(job,{api,folder,signal,update,log}) {
  const config = job.config, dates = windowDates(job.start,job.end);
  const state = job.selection ||= {candidates:[],metadata:[],decisions:[],queries:[],discovered:false};
  if (!state.discovered) {
    log('A · Buscando candidatos');
    state.candidates = job.source === 'csv' ? repositories(job.csv) : await discover(api,config,state.queries);
    state.discovered = true; job.total = state.candidates.length; update();
  }
  job.total = state.candidates.length; job.progress = state.decisions.length; update();
  for (const candidate of state.candidates) {
    signal?.throwIfAborted();
    const name = candidate.full_name;
    const prior = state.decisions.find(d=>d.full_name.toLowerCase()===name.toLowerCase());
    const priorMetadata = state.metadata.find(r=>r.full_name.toLowerCase()===name.toLowerCase());
    if (prior && prior.decision !== 'error' && priorMetadata?.metadata_status === 'complete') continue;
    log(`A · Metadados e filtros: ${name}`);
    try {
      const row = await metadata(api,candidate,config);
      if (candidate.default_branch && candidate.default_branch !== row.default_branch) throw new Error('default_branch do CSV difere do GitHub.');
      state.metadata = state.metadata.filter(r=>r.full_name.toLowerCase()!==name.toLowerCase()).concat(row);
      const decision = await evidence(api,row,config);
      state.decisions = state.decisions.filter(d=>d.full_name.toLowerCase()!==name.toLowerCase()).concat(decision);
    } catch (error) {
      signal?.throwIfAborted();
      if (error.code === 'RATE_LIMIT_WAIT') throw error;
      state.decisions = state.decisions.filter(d=>d.full_name.toLowerCase()!==name.toLowerCase()).concat({full_name:name,actions_count:'',releases_count:'',valid_runs_count:'',decision:'error',reason:'erro_metadados',error:error.message});
    }
    job.progress = state.decisions.length; update();
  }
  const selected = integrationSelection(job).filter(d=>d.decision==='selected');
  // A remains the only authority for the sample; B and C share its branch and window.
  job.results = job.results.filter(r=>selected.some(d=>d.full_name.toLowerCase()===r.repository.toLowerCase()));
  job.errors = state.decisions.filter(d=>d.decision==='error').map(d=>({repository:d.full_name,message:d.error}));
  job.errors.push(...state.metadata.filter(r=>r.metadata_status!=='complete').map(r=>({repository:r.full_name,message:r.error || 'Metadados incompletos.'})));
  if (job.mode === 'selection') {
    job.results = selected.map(d=>{const row=state.metadata.find(r=>r.full_name.toLowerCase()===d.full_name.toLowerCase());return {...row,repository:row.full_name,releases_in_window:d.releases_count,runs_valid:d.valid_runs_count,runs_count_complete:d.runs_count_complete,selected:true};});
    job.total = state.candidates.length; job.progress = state.decisions.length;
    job.status = job.errors.length ? 'partial' : selected.length < config.sampleSize ? 'insufficient_sample' : 'completed';
    log(`A · Seleção finalizada: ${selected.length}/${config.sampleSize}. Amostra disponível para B e C.`);
    return;
  }
  job.total = selected.length; job.progress = job.results.length; update();
  for (const decision of selected) {
    signal?.throwIfAborted();
    const row = state.metadata.find(r=>r.full_name.toLowerCase()===decision.full_name.toLowerCase());
    const name = row.full_name, branch = row.default_branch;
    if (job.results.some(r=>r.repository.toLowerCase()===name.toLowerCase())) continue;
    try {
      const releaseFile = path.join(folder,`${encodeURIComponent(name)}.releases.json`);
      let releases, tags;
      if (fs.existsSync(releaseFile)) ({releases,tags} = JSON.parse(fs.readFileSync(releaseFile,'utf8')));
      else {
        log(`B · Releases, tags e commits: ${name}`);
        releases = await collectReleasesAndCommits(api,name,dates.start,dates.end,{log});
        signal?.throwIfAborted();
        if (releases.some(r=>r.compare_error)) throw new Error('B · Comparação de commits indisponível. Retome para tentar novamente.');
        tags = await getTags(api,name);
        signal?.throwIfAborted();
        fs.writeFileSync(releaseFile,JSON.stringify({releases,tags}));
      }
      const b = calculateLeadTime(releases,new Date(dates.end).toISOString(),dates.start);
      log(`C · Workflows e recuperação: ${name}`);
      const runs = await api.runs(name,branch,dates.start,dates.end);
      signal?.throwIfAborted();
      const c = calculate(runs,branch,new Date(dates.end).toISOString(),dates.start);
      fs.writeFileSync(path.join(folder,`${encodeURIComponent(name)}.runs.json`),JSON.stringify(runs.map(r=>({...r,repository:name,default_branch:branch}))));
      const {evaluated_releases,...bMetrics} = b;
      job.results.push({repository:name,default_branch:branch,stars:row.stars,language:row.language,contributors_count:row.contributors_count,age_days:row.age_days,...bMetrics,...c,selected:true});
      log(`ABC · ${name}: ${b.releases_in_window} releases, ${c.runs_valid} runs válidos`);
    } catch (error) {
      signal?.throwIfAborted();
      if (error.code === 'RATE_LIMIT_WAIT') throw error;
      job.errors.push({repository:name,message:error.message}); log(`${name}: ${error.message}`);
    }
    job.progress = job.results.length; update();
  }
  const insufficient = selected.length < config.sampleSize;
  job.status = job.errors.length ? 'partial' : insufficient ? 'insufficient_sample' : 'completed';
  log(job.errors.length ? 'Concluído com erros. Retome para tentar os itens pendentes.' : insufficient ? `Amostra insuficiente: ${selected.length}/${config.sampleSize}. Crie uma coleta com mais candidatos.` : 'A, B e C concluídas.');
}

export function integratedFunnel(job) {
  const decisions = integrationSelection(job), stages = funnel(decisions);
  return {candidates:job.selection?.candidates.length || 0,processed:job.selection?.decisions.length || 0,
    eligible_runs:decisions.filter(d=>['selected','not_selected'].includes(d.decision)).length,
    selected:decisions.filter(d=>d.decision==='selected').length, target:job.config.sampleSize,
    metrics_completed:job.results.length, stages, note:'Amostra: ≥ 5 releases e ≥ 50 runs válidos, mesma janela e default branch. Erros e pendências não são exclusões.'};
}

export function exportIntegrated(job,kind,folder) {
  const decisions = integrationSelection(job);
  if (kind === 'metrics') return toCSV(job.results,job.mode==='releases'?INTEGRATED_HEADERS.filter(h=>/^(repository|default_branch|releases_|deployment_|lead_time_|commits_|eligible_releases)/.test(h)):INTEGRATED_HEADERS);
  if (kind === 'metadata') return toCSV(job.selection?.metadata || [],METADATA_HEADERS);
  if (kind === 'decisions') return toCSV(decisions,DECISION_HEADERS);
  if (kind === 'funnel') return toCSV(funnel(decisions),['stage','entered','excluded','errors','pending','not_selected','remaining']);
  if (kind === 'repositories') return toCSV(decisions.filter(d=>d.decision==='selected').map(d=>({full_name:d.full_name,default_branch:job.selection.metadata.find(r=>r.full_name.toLowerCase()===d.full_name.toLowerCase()).default_branch})),['full_name','default_branch']);
  if (kind === 'queries') return toCSV(job.selection?.queries || [],['query','total_count','incomplete_results','collected_at','purpose']);
  if (['releases','commits','tags'].includes(kind)) {
    const rows = [];
    for (const result of job.results) {
      const {releases,tags} = JSON.parse(fs.readFileSync(path.join(folder,`${encodeURIComponent(result.repository)}.releases.json`),'utf8'));
      if (kind === 'tags') { rows.push(...tags.map(t=>({repository:result.repository,...t}))); continue; }
      const evaluated = calculateLeadTime(releases,`${job.end}T23:59:59Z`,Date.parse(`${job.start}T00:00:00Z`)).evaluated_releases;
      for (const r of releases) {
        if (kind === 'releases') rows.push({repository:result.repository,...r,commits_count:r.commits.length,lead_time_hours:evaluated.find(e=>e.tag_name===r.tag_name)?.lead_time_hours ?? ''});
        else rows.push(...r.commits.map(c=>({repository:result.repository,release_tag:r.tag_name,release_published_at:r.published_at,commit_sha:c.sha,author_date:c.author_date,message:c.message,lead_time_hours:(Date.parse(r.published_at)-Date.parse(c.author_date))/3600000})));
      }
    }
    return toCSV(rows,kind==='releases'?RELEASE_HEADERS:kind==='commits'?COMMIT_HEADERS:['repository','name','commit_sha']);
  }
  return null;
}

export async function executeReleases(job,{api,folder,signal,update,log}) {
  const dates=windowDates(job.start,job.end);
  for (const repo of repositories(job.csv)) {
    signal?.throwIfAborted();
    if (job.results.some(r=>r.repository.toLowerCase()===repo.full_name.toLowerCase())) continue;
    try {
      log(`B · Releases e commits: ${repo.full_name}`);
      const info=(await api.get(`/repos/${repo.full_name}`)).data;
      if (info.private) throw new Error('Somente repositórios públicos.');
      if (repo.default_branch && repo.default_branch!==info.default_branch) throw new Error('default_branch do CSV difere do GitHub.');
      const releases=await collectReleasesAndCommits(api,repo.full_name,dates.start,dates.end,{log});
      signal?.throwIfAborted();
      if (releases.some(r=>r.compare_error)) throw new Error('Comparação de commits indisponível. Retome para tentar novamente.');
      const tags=await getTags(api,repo.full_name);signal?.throwIfAborted();
      fs.writeFileSync(path.join(folder,`${encodeURIComponent(repo.full_name)}.releases.json`),JSON.stringify({releases,tags}));
      const {evaluated_releases,...metrics}=calculateLeadTime(releases,new Date(dates.end).toISOString(),dates.start);
      job.results.push({repository:repo.full_name,default_branch:info.default_branch,...metrics});
    } catch(error) {
      signal?.throwIfAborted();if(error.code==='RATE_LIMIT_WAIT')throw error;
      job.errors.push({repository:repo.full_name,message:error.message});log(`${repo.full_name}: ${error.message}`);
    }
    job.progress=job.results.length+job.errors.length;update();
  }
  job.status=job.errors.length?'partial':'completed';log(job.errors.length?'B · Concluído com erros. Retome para tentar novamente.':'B · Releases e lead time concluídos. C pode ser executada separadamente.');
}
