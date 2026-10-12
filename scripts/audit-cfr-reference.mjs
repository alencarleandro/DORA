// Offline audit of gold release identities against persisted GitHub responses.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {parseCSV} from '../lib/csv.mjs';
import {GitHub} from '../lib/github.mjs';
const args=Object.fromEntries(process.argv.slice(2).reduce((a,v,i,s)=>v.startsWith('--')?[...a,[v.slice(2),s[i+1]]]:a,[]));
try {
 if(!args['cache-dir'])throw new Error('Informe --cache-dir pasta-do-cache persistente de A.');
 const rows=parseCSV(fs.readFileSync(args.consensus||'data/gold-standard/consensus.csv','utf8'),{spreadsheetEscapes:true});
 const keys=new Set(rows.map(r=>r.repository.toLowerCase()+':'+r.release_tag));
 const cached=url=>{const file=path.join(args['cache-dir'],createHash('sha256').update(new URL(url,'https://api.github.com').href).digest('hex')+'.json');return fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null;};
 const evidence=new Map();
 for(const repository of new Set(rows.map(r=>r.repository))) {
  let url=`/repos/${repository}/releases?per_page=100`;
  const visited=new Set();
  while(url&&!visited.has(url)) {
   visited.add(url);const response=cached(url);if(!response)break;
   for(const release of response.data||[]) {
    const key=repository.toLowerCase()+':'+release.tag_name;
    if(keys.has(key))evidence.set(key,{tag_name:release.tag_name,published_at:release.published_at,draft:release.draft,prerelease:release.prerelease,html_url:release.html_url,repository,source:'github_release',compare_error:'not_collected'});
   }
   url=response.next;
  }
 }
 for(const row of rows) {
  const response=cached(`/repos/${row.repository}/releases/tags/${encodeURIComponent(row.release_tag)}`);
  if(response?.data?.tag_name)evidence.set(row.repository.toLowerCase()+':'+row.release_tag,{...response.data,repository:row.repository,source:'github_release',compare_error:'not_collected'});
 }
 if(process.argv.includes('--online')) {
  if(!process.env.GITHUB_TOKEN)throw new Error('Modo online exige GITHUB_TOKEN em memória.');
  const api=new GitHub({token:process.env.GITHUB_TOKEN,cacheDir:args['cache-dir'],maxRateLimitWaitMs:10000,log:message=>console.log(message),fetcher:async(url,options)=>{
   // Renamed GitHub repositories redirect API endpoints. Keep credentials on the same origin.
   for(let attempt=0;attempt<5;attempt++) {
    const response=await fetch(url,{...options,redirect:'manual'});
    if(![301,302,303,307,308].includes(response.status))return response;
    const target=new URL(response.headers.get('location'),url);
    if(target.origin!=='https://api.github.com')throw new Error('Redirecionamento fora da API GitHub.');
    url=target;
   }
   throw new Error('Redirecionamentos excessivos na API GitHub.');
  }});
  let cursor=0,completed=0;
  await Promise.all(Array.from({length:3},async()=>{
   while(cursor<rows.length) {
    const row=rows[cursor++],key=row.repository.toLowerCase()+':'+row.release_tag;
    if(!evidence.has(key)) {
     try {const response=await api.get(`/repos/${row.repository}/releases/tags/${encodeURIComponent(row.release_tag)}`);evidence.set(key,{...response.data,repository:row.repository,source:'github_release',compare_error:'not_collected'});}
     catch(error){if(!/HTTP 404/.test(error.message))throw error;evidence.set(key,{repository:row.repository,tag_name:row.release_tag,lookup_error:'not_found'});}
    }
    completed++;if(completed%50===0)console.log('Referências conferidas: '+completed+'/'+rows.length);
   }
  }));
 }
 const output=path.resolve(args.output||'data/cfr-b/reference-evidence.json');
 fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify([...evidence.values()],null,2));
 console.log(JSON.stringify({output,evidence:evidence.size,reference:rows.length,mode:process.argv.includes('--online')?'online_missing_only':'offline'}));
}catch(error){console.error(error.message);process.exitCode=1;}
