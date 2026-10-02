import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
export class GitHub {
  constructor({ token = '', cacheDir, signal, log = () => {}, fetcher = fetch, sleep = delay }) { Object.assign(this, { token, cacheDir, signal, log, fetcher, sleep }); }
  async wait(ms) {
    while (ms > 0) { this.signal?.throwIfAborted(); const step = Math.min(ms,1000); await this.sleep(step); ms -= step; }
    this.signal?.throwIfAborted();
  }
  async get(url) {
    const u = new URL(url, 'https://api.github.com');
    if (u.origin !== 'https://api.github.com') throw new Error('Endpoint fora do GitHub.');
    const file = path.join(this.cacheDir, createHash('sha256').update(u.href).digest('hex') + '.json');
    this.signal?.throwIfAborted();
    try { return JSON.parse(await readFile(file, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    for (let attempt = 0; attempt < 7; attempt++) {
      this.signal?.throwIfAborted();
      let response;
      try {
        response = await this.fetcher(u, { redirect: 'error', signal: this.signal ? AbortSignal.any([this.signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000), headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2026-03-10', 'User-Agent': 'DORA-Lab03', ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) } });
      } catch (e) {
        this.signal?.throwIfAborted();
        if (attempt === 6) throw new Error('Falha de rede após 7 tentativas.');
        this.log(`Falha de rede; tentando novamente em ${2 ** attempt}s.`); await this.wait(1000 * 2 ** attempt); continue;
      }
      const remaining = response.headers.get('x-ratelimit-remaining'), retry = response.headers.get('retry-after');
      if (response.status === 429 || response.status === 403 && (remaining === '0' || retry || /secondary rate limit/i.test(await response.clone().text()))) {
        const reset = Number(response.headers.get('x-ratelimit-reset')) * 1000;
        const retryMs = retry ? (/^\d+$/.test(retry) ? Number(retry)*1000 : Date.parse(retry)-Date.now()) : 0;
        const ms = Math.max(1000, retryMs || (remaining === '0' && reset ? reset-Date.now()+1000 : 60000 * 2 ** attempt));
        this.log(`Rate limit: aguardando ${Math.ceil(ms/1000)}s. Cache preservado.`); await this.wait(ms); continue;
      }
      if (response.status >= 500) { this.log(`GitHub ${response.status}; nova tentativa em ${2 ** attempt}s.`); await this.wait(1000 * 2 ** attempt); continue; }
      if (!response.ok) throw new Error(`GitHub HTTP ${response.status} (${u.pathname}). Verifique acesso e token.`);
      const data = await response.json();
      if (data.private === true) throw new Error('Somente repositórios públicos são aceitos.');
      const result = { data, next: response.headers.get('link')?.match(/<([^>]+)>; rel="next"/)?.[1] || null };
      await mkdir(this.cacheDir, { recursive: true }); await writeFile(file+'.tmp', JSON.stringify(result)); await rename(file+'.tmp', file);
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
}
