import fs from 'node:fs';
const root='data/issue-6-evidence';
const files=fs.readdirSync(root).filter(x=>x.endsWith('.json')&&!x.endsWith('.repo.json'));
const read=f=>JSON.parse(fs.readFileSync(root+'/'+f));
const tasks=[];
for(const file of files){const e=read(file);if(e.supplemental?.status===200&&!process.argv.includes('--linked'))continue;let url='',format='text';
 if(e.notes.length<200&&e.compare_urls.length){url=e.compare_urls.at(-1).replace('https://github.com/','https://api.github.com/repos/');format='compare';}
 if(e.repository==='vitejs/vite')url=`https://raw.githubusercontent.com/vitejs/vite/${encodeURIComponent(e.release_tag)}/packages/${e.release_tag.startsWith('create-vite')?'create-vite':'vite'}/CHANGELOG.md`;
 if(e.repository==='curl/curl'){url=`https://curl.se/changes.html`;format='html';}
 if(e.repository==='oven-sh/bun'){url='https://bun.sh/blog/'+e.release_tag;format='html';}
 if(e.repository==='sxyazi/yazi'&&e.release_tag==='v25.12.29')url=`https://raw.githubusercontent.com/sxyazi/yazi/${e.release_tag}/CHANGELOG.md`;
 if(e.repository==='run-llama/llama_index'&&e.release_tag==='v0.12.12')url=`https://raw.githubusercontent.com/run-llama/llama_index/${e.release_tag}/CHANGELOG.md`;
 if(e.repository==='vlang/v'){const w=+e.release_tag.split('.').at(-1);const base=w===1?'weekly.2024.52':`weekly.2025.${String(w-1).padStart(2,'0')}`;url=`https://api.github.com/repos/vlang/v/compare/${base}...${e.release_tag}?per_page=100`;format='compare';}
 if(e.repository==='rails/rails'&&e.release_tag==='v7.0.10'){url='https://github.com/rails/rails/releases/tag/v7.0.9';format='html';}
 if(e.repository==='bitcoin/bitcoin')url=`https://raw.githubusercontent.com/bitcoin/bitcoin/${e.release_tag}/doc/release-notes.md`;
 if(e.repository==='files-community/Files'){url='https://files.community/blog/posts/'+e.release_tag.replaceAll('.','-');format='html';}
 if(e.repository==='FuelLabs/fuel-core'&&e.release_tag==='v0.41.4'){url=e.compare_urls.at(-1)?.replace('https://github.com/','https://api.github.com/repos/');format='compare';}
 if(e.repository==='TanStack/query'&&e.notes.startsWith('Patch Changes')){const dep=e.notes.match(/@tanstack\/(query-core|query-persist-client-core|react-query|svelte-query)@([\d.]+)/);if(dep)url=`https://raw.githubusercontent.com/TanStack/query/${encodeURIComponent(e.release_tag)}/packages/${dep[1]}/CHANGELOG.md`;}
 if(url&&(!process.argv.includes('--linked')||['bitcoin/bitcoin','files-community/Files','FuelLabs/fuel-core','curl/curl'].includes(e.repository)))tasks.push({file,url,format});
}
let cursor=0;await Promise.all(Array.from({length:2},async()=>{while(cursor<tasks.length){const {file,url,format}=tasks[cursor++];try{const response=await fetch(url,{headers:{'User-Agent':'DORA-academic-evidence'},signal:AbortSignal.timeout(45000)});const text=await response.text();let content=text,commits=[],total=null,next='';
 if(format==='compare'&&response.ok){const data=JSON.parse(text);commits=(data.commits||[]).map(c=>({sha:c.sha,message:c.commit.message,url:c.html_url}));total=data.total_commits;next=response.headers.get('link')||'';content=commits.map(x=>x.message).join('\n');}
 if(format==='html')content=text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<\/(?:p|li|h[1-6]|div)>/g,'\n').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#x27;/g,"'").replace(/[ \t]+/g,' ').replace(/\n\s*\n/g,'\n');
 const e=read(file);e.supplemental={url:response.url,status:response.status,retrieved_at:new Date().toISOString(),format,content,commits,total_commits:total,pagination:next};fs.writeFileSync(root+'/'+file,JSON.stringify(e,null,2));console.log(response.status+' '+e.repository+' '+e.release_tag+' chars='+content.length);
 }catch(error){console.log('ERROR '+file+' '+error.message);}}}));
