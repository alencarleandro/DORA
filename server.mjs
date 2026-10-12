import http from 'node:http';
import fs from 'node:fs';
import { DATA, create, load, list, execute, summary, exportJob, exportKinds, expandSelection } from './lib/pipeline.mjs';
import path from 'node:path';
fs.mkdirSync(DATA,{recursive:true});
const active = new Map();
const summaryCache = new Map();
const staticCache = new Map();

for (const job of list()) {
  if (job.status === 'running' || job.status === 'pending') {
    job.status = 'paused';
    const { save } = await import('./lib/pipeline.mjs');
    save(job, { immediate: true });
  }
  summaryCache.set(job.id, summary(job));
}

async function body(req) {
  let size=0; const chunks=[];
  for await (const chunk of req) { size+=chunk.length; if (size>100*1024*1024) throw new Error('Limite de upload: 100 MB.'); chunks.push(chunk); }
  return JSON.parse(Buffer.concat(chunks).toString());
}
function start(job,token) {
  if (active.size) throw new Error('Uma coleta já está em execução. Aguarde ou pause.');
  const controller=new AbortController(); active.set(job.id,controller);
  summaryCache.set(job.id, summary(job));
  execute(job,{
    token,
    signal:controller.signal,
    onUpdate: j => summaryCache.set(j.id, summary(j))
  }).catch(()=>{}).finally(()=>{
    summaryCache.set(job.id, summary(job));
    active.delete(job.id);
  });
}
function getStatic(file) {
  if (!staticCache.has(file)) {
    staticCache.set(file, fs.readFileSync(new URL(`./public/${file}`, import.meta.url)));
  }
  return staticCache.get(file);
}
const server=http.createServer(async(req,res)=>{
  const headers={'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'"};
  const json=(status,value)=>{res.writeHead(status,{...headers,'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));};
  try {
    const url=new URL(req.url,'http://localhost'), route=url.pathname;
    if (route.startsWith('/api/')) {
      if (req.method==='POST') {
        const origin=req.headers.origin, host=req.headers['x-forwarded-host'] || req.headers.host;
        // O proxy do Arsenal troca Host pelo endereço local.
        if (!process.env.ARSENAL_ROUTE && origin && new URL(origin).host !== host) return json(403,{error:'Origem não permitida.'});
      }
      if (route==='/api/jobs' && req.method==='GET') {
        return json(200, Array.from(summaryCache.values()).sort((a,b) => b.created_at.localeCompare(a.created_at)));
      }
      if (route==='/api/jobs' && req.method==='POST') {
        if(active.size) return json(409,{error:'Uma coleta já está em execução.'});
        const input=await body(req), job=create(input);
        summaryCache.set(job.id, summary(job));
        start(job,String(input.token || process.env.GITHUB_TOKEN || ''));
        return json(201,summary(job));
      }
      const match=route.match(/^\/api\/jobs\/([a-f\d-]{36})(?:\/(resume|pause|export))?$/);
      if(match) {
        const action=match[2];
        const cached=summaryCache.get(match[1]);
        if (!action && req.method==='GET') return json(200, cached || summary(load(match[1])));
        const job=load(match[1]);
        if(action==='pause' && req.method==='POST') {
          active.get(job.id)?.abort();
          job.status='paused';
          summaryCache.set(job.id, summary(job));
          return json(200,{ok:true});
        }
        if(action==='resume' && req.method==='POST') {const input=await body(req);if(active.size)throw new Error('Uma coleta já está em execução.');if(input.candidateLimit)expandSelection(job,input.candidateLimit);if(job.mode==='selection')job.collect_data=true;start(job,String(input.token || process.env.GITHUB_TOKEN || ''));return json(200,summary(job));}
        if(action==='export' && req.method==='GET') {
          const kind=url.searchParams.get('kind');if(!exportKinds(job.mode).includes(kind))throw new Error('Exportação indisponível para esta parte.');
          const prepared=path.join(DATA,'jobs',job.id,'exports',kind+'.csv');
          if(fs.existsSync(prepared)&&(job.mode!=='selection'||job.datasets?.status==='completed')){
            res.writeHead(200,{...headers,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="dora-${kind}.csv"`});fs.createReadStream(prepared).pipe(res);return;
          }
          const csv=exportJob(job,kind);res.writeHead(200,{...headers,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="dora-${kind}.csv"`});return res.end(csv);
        }
      }
      return json(404,{error:'Rota não encontrada.'});
    }
    const assets={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/style.css':'style.css','/examples/repositories.csv':'../examples/repositories.csv','/examples/runs.csv':'../examples/runs.csv','/examples/release-data.csv':'../examples/release-data.csv','/health':'health'};
    if (route==='/health') return json(200,{ok:true,dataset_flow:1,partial_local:true});
    if (!assets[route] || req.method!=='GET') return json(404,{error:'Página não encontrada.'});
    const file=assets[route], mime=file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':file.endsWith('.csv')?'text/csv':'text/html';
    res.writeHead(200,{...headers,'Content-Type':`${mime}; charset=utf-8`});res.end(getStatic(file));
  } catch(error) {json(error.code==='ENOENT'?404:400,{error:error.code==='ENOENT'?'Coleta não encontrada.':error.message});}
});
server.listen(Number(process.env.PORT || 4117),'127.0.0.1',()=>console.log(`DORA público em http://127.0.0.1:${process.env.PORT || 4117}.`));
