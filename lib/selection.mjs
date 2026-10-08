import { windowDates, calculate } from './metrics.mjs';

export const METADATA_HEADERS = ['repository_id','full_name','default_branch','stars','language','contributors_count','contributors_status','created_at','age_days','age_reference','collected_at','metadata_status','error'];
export const DECISION_HEADERS = ['full_name','actions_count','releases_count','valid_runs_count','runs_count_complete','decision','reason','error'];

export function validateConfig(config, mode) {
  for (const key of ['minStars','candidateLimit','sampleSize']) if (!Number.isSafeInteger(config[key]) || config[key] < 1) throw new Error(`Configuração inválida: ${key}`);
  if (config.start || config.end || mode === 'full') windowDates(config.start, config.end);
}

// Visit higher-star partitions first; the candidate budget is explicit, never a claim of exhaustive search.
export async function discover(api, config, queries = []) {
  const found = new Map();
  const suffix = `${config.excludeForks ? ' fork:false' : ''}${config.excludeArchived ? ' archived:false' : ''}`;
  // A budget within the accessible 1,000 search results needs no range subdivision.
  if(config.candidateLimit<=1000){
    const until=config.searchUntil??Math.floor(Date.now()/1000);
    const q='stars:>='+config.minStars+suffix+' created:<='+new Date(until*1000).toISOString().replace('.000','');
    const url='/search/repositories?'+new URLSearchParams({q,sort:'stars',order:'desc',per_page:'100'});
    let response=await api.get(url);
    queries.push({query:q,total_count:response.data.total_count,incomplete_results:response.data.incomplete_results,collected_at:response.collected_at||new Date().toISOString(),purpose:'candidate_budget'});
    if(!response.data.incomplete_results){
      const target=Math.min(config.candidateLimit,response.data.total_count);let loaded=0;
      while(response){
        if(response.data.incomplete_results)throw new Error('Página de busca incompleta.');
        loaded+=response.data.items.length;
        for(const repo of response.data.items)found.set(repo.id,repo);
        if(found.size>=target)break;
        if(loaded>=1000||!response.next)throw new Error('Paginação da busca incompleta ou alterada.');
        response=await api.get(response.next);
      }
      return [...found.values()].sort((a,b)=>b.stargazers_count-a.stargazers_count||a.full_name.localeCompare(b.full_name,'en')).slice(0,config.candidateLimit);
    }
    found.clear();
  }
  async function visit(low, high, from = 0, until = config.searchUntil ?? Math.floor(Date.now()/1000), depth = 0) {
    if (found.size >= config.candidateLimit) return;
    if (depth > 64) throw new Error('Busca não pôde ser particionada com segurança.');
    const q = `stars:${low}..${high}${suffix} created:${new Date(from*1000).toISOString().replace('.000','')}..${new Date(until*1000).toISOString().replace('.000','')}`;
    const url = `/search/repositories?${new URLSearchParams({q,sort:'stars',order:'desc',per_page:'100'})}`;
    const first = await api.get(url);
    queries.push({query:q,total_count:first.data.total_count,incomplete_results:first.data.incomplete_results,collected_at:first.collected_at || new Date().toISOString()});
    if (first.data.incomplete_results || first.data.total_count > 1000) {
      if (low < high) {
        const mid = Math.floor((low+high)/2);
        await visit(mid+1,high,from,until,depth+1);
        if (found.size < config.candidateLimit) await visit(low,mid,from,until,depth+1);
      } else if (from < until) {
        const mid = Math.floor((from+until)/2);
        await visit(low,high,from,mid,depth+1);
        if (found.size < config.candidateLimit) await visit(low,high,mid+1,until,depth+1);
      } else throw new Error('Resultados incompletos mesmo após subdivisão.');
      return;
    }
    let response = first, count = 0;
    do {
      if (response.data.incomplete_results) throw new Error('Página de busca incompleta.');
      count += response.data.items.length;
      for (const repo of response.data.items) {
        found.set(repo.id,repo);
        if (found.size >= config.candidateLimit) break;
      }
      if (found.size >= config.candidateLimit) break;
      response = response.next ? await api.get(response.next) : null;
    } while (response);
    if (found.size < config.candidateLimit && count !== first.data.total_count) throw new Error('Paginação da busca incompleta ou alterada.');
  }
  // Determine a finite bound without assuming a maximum GitHub star count.
  const q = `stars:>=${config.minStars}${suffix}`;
  const probe = await api.get(`/search/repositories?${new URLSearchParams({q,sort:'stars',order:'desc',per_page:'1'})}`);
  queries.push({query:q,total_count:probe.data.total_count,incomplete_results:probe.data.incomplete_results,collected_at:probe.collected_at || new Date().toISOString(),purpose:'upper_bound'});
  if (probe.data.incomplete_results) throw new Error('Busca inicial incompleta; use um novo cache para tentar novamente.');
  if (probe.data.items.length) await visit(config.minStars,probe.data.items[0].stargazers_count);
  return [...found.values()].sort((a,b)=>b.stargazers_count-a.stargazers_count || a.full_name.localeCompare(b.full_name,'en')).slice(0,config.candidateLimit);
}

export async function metadata(api, candidate, config) {
  const response = await api.get(`/repos/${candidate.full_name}`), repo = response.data;
  const row = {repository_id:repo.id,full_name:repo.full_name,default_branch:repo.default_branch,stars:repo.stargazers_count,language:repo.language ?? '',created_at:repo.created_at,collected_at:response.collected_at || new Date().toISOString(),contributors_count:'',contributors_status:'unavailable',age_days:'',age_reference:'',metadata_status:'complete',error:''};
  if (config.end) {
    const {end} = windowDates(config.start,config.end);
    row.age_reference = new Date(end).toISOString();
    row.age_days = (end-Date.parse(repo.created_at))/86400000;
    if (row.age_days < 0) { row.age_days=''; row.metadata_status='created_after_window'; }
  }
  try {
    const result = await api.get(`/repos/${repo.full_name}/contributors?per_page=1&anon=true`);
    if (!Array.isArray(result.data)) throw new Error('Resposta de contribuidores inválida.');
    if (result.last) {
      const last = new URL(result.last,'https://api.github.com'), total = Number(last.searchParams.get('page'));
      if (last.searchParams.get('per_page') !== '1' || !Number.isSafeInteger(total) || total < 1) throw new Error('Última página inválida.');
      row.contributors_count = total;
    } else if (result.next) {
      const bulk = await api.get(`/repos/${repo.full_name}/contributors?per_page=100&anon=true`);
      if (bulk.last) {
        const lastBulk = new URL(bulk.last, 'https://api.github.com');
        const pages = Number(lastBulk.searchParams.get('page'));
        row.contributors_count = Number.isSafeInteger(pages) && pages > 0 ? pages * 100 : bulk.data.length;
      } else if (bulk.next && typeof api.pages === 'function') {
        const extraPages = await api.pages(`/repos/${repo.full_name}/contributors?per_page=100&anon=true`);
        row.contributors_count = extraPages.length;
      } else {
        row.contributors_count = Array.isArray(bulk.data) ? bulk.data.length : 1;
      }
    } else row.contributors_count = result.data.length;
    row.contributors_status='available';
  } catch (error) { if(error.code==='RATE_LIMIT_WAIT') throw error; row.error=error.message; row.metadata_status='partial'; }
  return row;
}

export async function evidence(api, row, config) {
  const result = {full_name:row.full_name,actions_count:'',releases_count:'',valid_runs_count:'',decision:'pending',reason:'',error:''};
  try {
    result.actions_count = (await api.get(`/repos/${row.full_name}/actions/workflows?per_page=1`)).data.total_count;
    if (!Number.isInteger(result.actions_count)) throw new Error('Contagem de workflows indisponível.');
    if (!result.actions_count) return {...result,decision:'excluded',reason:'sem_actions'};
    const {start,end} = windowDates(config.start,config.end);
    const releases = await api.pages(`/repos/${row.full_name}/releases?per_page=100`);
    result.releases_count = releases.filter(r=>!r.draft&&!r.prerelease&&Date.parse(r.published_at)>=start&&Date.parse(r.published_at)<=end).length;
    if (result.releases_count < 5) return {...result,decision:'excluded',reason:'menos_de_5_releases'};
    if(api.qualifyRuns){const qualified=await api.qualifyRuns(row.full_name,row.default_branch,start,end,50);result.valid_runs_count=qualified.count;result.runs_count_complete=qualified.complete;}
    else{const runs=await api.runs(row.full_name,row.default_branch,start,end);result.valid_runs_count=calculate(runs,row.default_branch,new Date(end).toISOString(),start).runs_valid;result.runs_count_complete=true;}
    return {...result,decision:result.valid_runs_count>=50?'eligible':'excluded',reason:result.valid_runs_count>=50?'':'menos_de_50_runs_validos'};
  } catch (error) { if(error.code==='RATE_LIMIT_WAIT') throw error; return {...result,decision:'error',reason:'erro_coleta',error:error.message}; }
}

export function finalize(decisions, sampleSize) {
  let selected=0;
  return decisions.map(row=>row.decision==='eligible' ? {...row,decision:selected++<sampleSize?'selected':'not_selected',reason:selected<=sampleSize?'':'limite_amostra'} : row);
}

export function funnel(decisions) {
  const rows = [{stage:'candidatos_unicos',entered:decisions.length,excluded:0,errors:0,pending:0,not_selected:0,remaining:decisions.length}];
  let active=[...decisions];
  for (const [stage,reason] of [['usam_actions','sem_actions'],['5_releases','menos_de_5_releases'],['50_runs_validos','menos_de_50_runs_validos'],['amostra','limite_amostra']]) {
    const entered=active.length, excluded=active.filter(r=>r.decision==='excluded'&&r.reason===reason).length;
    // Failures are assigned to the first unobserved stage, never interpreted as zero.
    const missing = stage==='usam_actions'?'actions_count':stage==='5_releases'?'releases_count':stage==='50_runs_validos'?'valid_runs_count':null;
    const errors=active.filter(r=>r.decision==='error'&&(missing?r[missing]==='':true)).length;
    const pending=active.filter(r=>r.decision==='pending').length;
    const not_selected=stage==='amostra'?active.filter(r=>r.decision==='not_selected').length:0;
    active=active.filter(r=>!(r.decision==='excluded'&&r.reason===reason)&&r.decision!=='pending'&&!(r.decision==='error'&&(missing?r[missing]==='':true))&&!(stage==='amostra'&&r.decision==='not_selected'));
    rows.push({stage,entered,excluded,errors,pending,not_selected,remaining:active.length});
  }
  return rows;
}
