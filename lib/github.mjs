import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { VALID } from './metrics.mjs';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
export class GitHub {
  constructor({ token = '', cacheDir, signal, log = () => {}, onQuota = () => {}, fetcher = fetch, sleep = delay, maxRateLimitWaitMs = Infinity, memoryCacheSize = 1000 }) {
    Object.assign(this, { token, cacheDir, signal, log, onQuota, fetcher, sleep, maxRateLimitWaitMs, memoryCacheSize });
    this.inFlight = new Map();
    this.memoryCache = new Map();
    this.stats = { hits: 0, memoryHits: 0, misses: 0, revalidations304: 0 };
  }
  _setMemory(key, value) {
    if (this.memoryCacheSize <= 0) return;
    if (this.memoryCache.size >= this.memoryCacheSize) {
      const oldestKey = this.memoryCache.keys().next().value;
      if (oldestKey !== undefined) this.memoryCache.delete(oldestKey);
    }
    this.memoryCache.set(key, value);
  }
  getStats() {
    return { ...this.stats, memorySize: this.memoryCache.size };
  }
  clearMemoryCache() {
    this.memoryCache.clear();
  }
  async wait(ms) {
    while (ms > 0) { this.signal?.throwIfAborted(); const step = Math.min(ms,1000); await this.sleep(step); ms -= step; }
    this.signal?.throwIfAborted();
  }
  async get(url, options = {}) {
    const u = new URL(url, 'https://api.github.com');
    if (u.origin !== 'https://api.github.com') throw new Error('Endpoint fora do GitHub.');
    this.signal?.throwIfAborted();
    const key = u.href;
    const revalidate = Boolean(options?.revalidate);

    if (!revalidate && this.memoryCache.has(key)) {
      this.stats.memoryHits++;
      return this.memoryCache.get(key);
    }

    if (this.inFlight.has(key)) {
      const result = await this.inFlight.get(key);
      this.signal?.throwIfAborted();
      return result;
    }

    const promise = this._fetch(u, key, revalidate);
    this.inFlight.set(key, promise);
    try {
      return await promise;
    } finally {
      this.inFlight.delete(key);
    }
  }
  async _fetch(u, key, revalidate) {
    const file = path.join(this.cacheDir, createHash('sha256').update(key).digest('hex') + '.json');
    this.signal?.throwIfAborted();
    let cached = null;
    try {
      cached = JSON.parse(await readFile(file, 'utf8'));
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }

    if (cached && !revalidate) {
      this.stats.hits++;
      this._setMemory(key, cached);
      return cached;
    }

    for (let attempt = 0; attempt < 7; attempt++) {
      this.signal?.throwIfAborted();
      let response;
      try {
        const headers = {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2026-03-10',
          'User-Agent': 'DORA-Lab03',
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
          ...(revalidate && cached?.etag ? { 'If-None-Match': cached.etag } : {})
        };
        response = await this.fetcher(u, {
          redirect: 'error',
          signal: this.signal ? AbortSignal.any([this.signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000),
          headers
        });
      } catch (e) {
        this.signal?.throwIfAborted();
        if (attempt === 6) throw new Error('Falha de rede após 7 tentativas.');
        this.log(`Falha de rede; tentando novamente em ${2 ** attempt}s.`); await this.wait(1000 * 2 ** attempt); continue;
      }
      const remaining = response.headers.get('x-ratelimit-remaining'), retry = response.headers.get('retry-after');
      const limit=response.headers.get('x-ratelimit-limit'), resetSeconds=response.headers.get('x-ratelimit-reset');
      if(limit!==null&&remaining!==null)this.onQuota({resource:response.headers.get('x-ratelimit-resource')||'core',limit:Number(limit),remaining:Number(remaining),reset_at:resetSeconds?new Date(Number(resetSeconds)*1000).toISOString():null,authenticated:!!this.token});
      if (response.status === 429 || response.status === 403 && (remaining === '0' || retry || /secondary rate limit/i.test(await response.clone().text()))) {
        const reset = Number(response.headers.get('x-ratelimit-reset')) * 1000;
        const retryMs = retry ? (/^\d+$/.test(retry) ? Number(retry)*1000 : Date.parse(retry)-Date.now()) : 0;
        const ms = Math.max(1000, retryMs || (remaining === '0' && reset ? reset-Date.now()+1000 : 60000 * 2 ** attempt));
        if (ms > this.maxRateLimitWaitMs) {
          const error = new Error(`Rate limit: renovação em ${Math.ceil(ms/1000)}s. Cache preservado; retome a coleta após a renovação ou configure GITHUB_TOKEN.`);
          error.code = 'RATE_LIMIT_WAIT'; throw error;
        }
        this.log(`Rate limit: aguardando ${Math.ceil(ms/1000)}s. Cache preservado.`); await this.wait(ms); continue;
      }
      if (response.status === 304 && cached) {
        this.stats.revalidations304++;
        cached.collected_at = new Date().toISOString();
        const etag = response.headers.get('etag');
        if (etag) cached.etag = etag;
        await mkdir(this.cacheDir, { recursive: true });
        const tmp = `${file}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
        await writeFile(tmp, JSON.stringify(cached));
        await rename(tmp, file);
        this._setMemory(key, cached);
        return cached;
      }
      if (response.status >= 500) { this.log(`GitHub ${response.status}; nova tentativa em ${2 ** attempt}s.`); await this.wait(1000 * 2 ** attempt); continue; }
      if (!response.ok) throw new Error(`GitHub HTTP ${response.status} (${u.pathname}). Verifique acesso e token.`);
      let data;
      try { data = response.status === 204 ? [] : await response.json(); }
      catch (error) {
        this.signal?.throwIfAborted();
        if (attempt === 6) throw new Error('Resposta JSON interrompida ou inválida após 7 tentativas.');
        this.log(`Resposta interrompida ou JSON inválido; nova tentativa em ${2 ** attempt}s.`);
        await this.wait(1000 * 2 ** attempt); continue;
      }
      if (data.private === true) throw new Error('Somente repositórios públicos são aceitos.');
      const link = response.headers.get('link') || '';
      const etag = response.headers.get('etag') || null;
      const result = { url: key, etag, data, next: link.match(/<([^>]+)>; rel="next"/)?.[1] || null, last: link.match(/<([^>]+)>; rel="last"/)?.[1] || null, collected_at: new Date().toISOString() };
      this.stats.misses++;
      await mkdir(this.cacheDir, { recursive: true });
      const tmp = `${file}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
      await writeFile(tmp, JSON.stringify(result));
      await rename(tmp, file);
      this._setMemory(key, result);
      if (remaining === '0') this.log('Cota esgotada. A próxima chamada aguardará a renovação.');
      return result;
    }
    throw new Error('Limite de tentativas excedido. Retome a coleta para continuar do cache.');
  }
  async pages(url, key) {
    const rows = []; let next = url;
    while (next) { const response = await this.get(next); rows.push(...(key ? response.data[key] : response.data)); next = response.next; }
    return rows;
  }
  async interval(repository, branch, start, end) {
    const query = new URLSearchParams({ branch, event: 'push', created: `${new Date(start).toISOString().replace('.000','')}..${new Date(end).toISOString().replace('.000','')}`, per_page:'100' });
    const url = `/repos/${repository}/actions/runs?${query}`, first = await this.get(url);
    if (first.data.total_count >= 1000) {
      if (end-start < 1000) throw new Error('Mais de 1.000 runs no mesmo segundo. Coleta incompleta; não será calculada.');
      const middle = Math.floor((start+end)/2000)*1000;
      this.log(`${repository}: intervalo atingiu teto; subdividindo.`);
      return [...await this.interval(repository,branch,start,middle), ...await this.interval(repository,branch,middle+1000,end)];
    }
    const rows = [...first.data.workflow_runs]; let next = first.next;
    while (next) { const response = await this.get(next); rows.push(...response.data.workflow_runs); next = response.next; }
    if (rows.length !== first.data.total_count) throw new Error('Paginação incompleta ou dados alterados durante a coleta. Use novo cache para este intervalo.');
    return rows;
  }
  async runs(repository, branch, start, end) {
    const all = [];
    for (let cursor = start; cursor <= end;) {
      const date = new Date(cursor), next = Date.UTC(date.getUTCFullYear(), date.getUTCMonth()+1,1);
      const stop = Math.min(end,next-1000);
      this.log(`${repository}: ${date.toISOString().slice(0,7)}`);
      all.push(...await this.interval(repository,branch,cursor,stop)); cursor = next;
    }
    return [...new Map(all.map(r => [r.id,r])).values()];
  }
  async qualifyRuns(repository,branch,start,end,minimum=50) {
    // A only needs eligibility. C still mines the complete monthly history.
    const query=new URLSearchParams({branch,event:'push',created:new Date(start).toISOString().replace('.000','')+'..'+new Date(end).toISOString().replace('.000',''),per_page:'100'});
    let next='/repos/'+repository+'/actions/runs?'+query,expected=null,loaded=0;
    const seen=new Set();let count=0;
    while(next) {
      const page=await this.get(next),rows=page.data.workflow_runs;
      if(!Array.isArray(rows)||!Number.isInteger(page.data.total_count))throw new Error('Resposta de runs inválida.');
      expected??=page.data.total_count;loaded+=rows.length;
      for(const r of rows){const created=Date.parse(r.created_at);if(seen.has(String(r.id)))continue;seen.add(String(r.id));if(r.event==='push'&&r.head_branch===branch&&created>=start&&created<=end&&VALID.has(r.conclusion))count++;}
      if(count>=minimum)return {count,complete:!page.next&&expected<1000&&loaded===expected};
      next=page.next;
    }
    if(expected>=1000){
      // The API ceiling cannot be treated as evidence of exclusion.
      const runs=await this.runs(repository,branch,start,end);
      count=runs.filter(r=>r.event==='push'&&r.head_branch===branch&&Date.parse(r.created_at)>=start&&Date.parse(r.created_at)<=end&&VALID.has(r.conclusion)).length;
    }else if(loaded!==expected)throw new Error('Paginação de elegibilidade incompleta.');
    return {count,complete:true};
  }

}
