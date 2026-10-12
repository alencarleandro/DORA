import fs from 'node:fs';
const checks=[
 ['anomalyco/opencode','v0.3.120','compare/v0.3.119...v0.3.120'],
 ['github/spec-kit','v0.0.71','compare/v0.0.70...v0.0.71'],
 ['github/spec-kit','v0.0.73','compare/v0.0.72...v0.0.73'],
 ['vitejs/vite','v7.2.6','compare/v7.2.5...v7.2.6'],
 ['colinhacks/zod','v4.0.8','commits/3048d14'],
 ['TanStack/query','@tanstack/react-query-persist-client@5.90.14','commits/72d8ac5'],
 ['TanStack/query','@tanstack/svelte-query-persist-client@6.0.12','commits/72d8ac5'],
 ['gradio-app/gradio','@gradio/file@0.12.26','compare/%40gradio%2Ffile%400.12.25...%40gradio%2Ffile%400.12.26'],
 ['shadcn-ui/ui','shadcn@2.6.1','commits/3119f94d47426dae860001a4cfb4ef23396dd41d'],
];
const root='data/issue-6-evidence',files=fs.readdirSync(root).filter(f=>f.endsWith('.json')&&!f.endsWith('.repo.json'));
for(const [repo,tag,endpoint]of checks){const file=files.find(f=>{const e=JSON.parse(fs.readFileSync(root+'/'+f));return e.repository===repo&&e.release_tag===tag;});const e=JSON.parse(fs.readFileSync(root+'/'+file));if(e.final_check?.status===200){console.log('cached '+repo+' '+tag);continue;}const url='https://api.github.com/repos/'+repo+'/'+endpoint+'?per_page=100';const r=await fetch(url,{headers:{'User-Agent':'DORA-academic-evidence'},signal:AbortSignal.timeout(30000)});const d=await r.json();const commits=(d.commits|| (d.commit?[d]:[])).map(c=>({sha:c.sha,message:c.commit.message,url:c.html_url}));const content=commits.map(x=>x.message).join('\n');e.final_check={url:r.url,status:r.status,retrieved_at:new Date().toISOString(),commits,total_commits:d.total_commits??commits.length,content};fs.writeFileSync(root+'/'+file,JSON.stringify(e,null,2));console.log(repo+' '+tag+' '+r.status+'\n'+content.slice(0,3500));}
