import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { DATA, create, load, list, execute, summary, exportJob } from './lib/pipeline.mjs';
fs.mkdirSync(DATA,{recursive:true});
const keyFile = path.join(DATA,'access-key.txt');
if (!process.env.DORA_ACCESS_KEY && !fs.existsSync(keyFile)) fs.writeFileSync(keyFile,randomBytes(24).toString('base64url'),{mode:0o600});
const accessKey = process.env.DORA_ACCESS_KEY || fs.readFileSync(keyFile,'utf8').trim();
const active = new Map();
for (const job of list()) if (job.status === 'running' || job.status === 'pending') { job.status='paused'; const {save} = await import('./lib/pipeline.mjs'); save(job); }
function authorized(req) {
  const supplied = Buffer.from(String(req.headers.authorization || '').replace(/^Bearer /,'')), expected = Buffer.from(accessKey);
  return supplied.length === expected.length && timingSafeEqual(supplied,expected);
}
async function body(req) {
  let size=0; const chunks=[];
  for await (const chunk of req) { size+=chunk.length; if (size>10*1024*1024) throw new Error('Limite de upload: 10 MB.'); chunks.push(chunk); }
  return JSON.parse(Buffer.concat(chunks).toString());
}
function start(job,token) {
  if (active.size) throw new Error('Uma coleta já está em execução. Aguarde ou pause.');
  const controller=new AbortController(); active.set(job.id,controller);
  execute(job,{token,signal:controller.signal}).catch(()=>{}).finally(()=>active.delete(job.id));
}
const server=http.createServer(async(req,res)=>{
  const headers={'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'"};
  const json=(status,value)=>{res.writeHead(status,{...headers,'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));};
  try {
    const url=new URL(req.url,'http://localhost'), route=url.pathname;
    if (route.startsWith('/api/')) {
      if (!authorized(req)) return json(401,{error:'Informe a chave de acesso do DORA.'});
      if (req.method==='POST') {
        const origin=req.headers.origin, host=req.headers['x-forwarded-host'] || req.headers.host;
        // O proxy do Arsenal troca Host pelo endereço local; o Bearer continua obrigatório.
        if (!process.env.ARSENAL_ROUTE && origin && new URL(origin).host !== host) return json(403,{error:'Origem não permitida.'});
      }
      if (route==='/api/jobs' && req.method==='GET') return json(200,list().map(summary));
      if (route==='/api/jobs' && req.method==='POST') {
        if(active.size) return json(409,{error:'Uma coleta já está em execução.'});
        const input=await body(req), job=create(input); start(job,String(input.token || process.env.GITHUB_TOKEN || '')); return json(201,summary(job));
      }
      const match=route.match(/^\/api\/jobs\/([a-f\d-]{36})(?:\/(resume|pause|export))?$/);
      if(match) {
        const job=load(match[1]), action=match[2];
        if (!action && req.method==='GET') return json(200,summary(job));
        if(action==='pause' && req.method==='POST') {active.get(job.id)?.abort();return json(200,{ok:true});}
        if(action==='resume' && req.method==='POST') {const input=await body(req);start(job,String(input.token || process.env.GITHUB_TOKEN || ''));return json(200,summary(job));}
        if(action==='export' && req.method==='GET') {const kind=url.searchParams.get('kind'), csv=exportJob(job,kind);res.writeHead(200,{...headers,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="dora-${kind}.csv"`});return res.end(csv);}
      }
      return json(404,{error:'Rota não encontrada.'});
    }
    const assets={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/style.css':'style.css','/examples/repositories.csv':'../examples/repositories.csv','/examples/runs.csv':'../examples/runs.csv','/health':'health'};
    if (route==='/health') return json(200,{ok:true});
    if (!assets[route] || req.method!=='GET') return json(404,{error:'Página não encontrada.'});
    const file=assets[route], mime=file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':file.endsWith('.csv')?'text/csv':'text/html';
    res.writeHead(200,{...headers,'Content-Type':`${mime}; charset=utf-8`});res.end(fs.readFileSync(new URL(`./public/${file}`,import.meta.url)));
  } catch(error) {json(error.code==='ENOENT'?404:400,{error:error.code==='ENOENT'?'Coleta não encontrada.':error.message});}
});
server.listen(Number(process.env.PORT || 4117),'127.0.0.1',()=>console.log(`DORA online em http://127.0.0.1:${process.env.PORT || 4117}. Chave de acesso: ${process.env.DORA_ACCESS_KEY?'variável DORA_ACCESS_KEY':keyFile}`));
