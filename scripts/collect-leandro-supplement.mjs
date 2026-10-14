import fs from 'node:fs';
import {createHash} from 'node:crypto';
const root='data/issue-5-evidence';
const plain=html=>html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<\/(?:p|li|h[1-6]|div)>/g,'\n').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#x27;/g,"'").replace(/[ \t]+/g,' ').replace(/\n\s*\n/g,'\n');
const tasks=[];
for(const file of fs.readdirSync(root).filter(f=>f.endsWith('.json')&&!f.endsWith('.repo.json'))){
 const e=JSON.parse(fs.readFileSync(root+'/'+file));let url='';
 if(e.repository==='vitejs/vite')url=`https://raw.githubusercontent.com/vitejs/vite/${encodeURIComponent(e.release_tag)}/packages/${e.release_tag.startsWith('create-vite')?'create-vite':'vite'}/CHANGELOG.md`;
 if(e.repository==='oven-sh/bun')url='https://bun.sh/blog/'+e.release_tag;
 if(e.repository==='bitcoin/bitcoin')url=`https://raw.githubusercontent.com/bitcoin/bitcoin/${e.release_tag}/doc/release-notes.md`;
 if(e.repository==='files-community/Files')url='https://files.community/blog/posts/'+e.release_tag.replaceAll('.','-');
 if(e.repository==='sxyazi/yazi'&&e.release_tag==='v25.12.29')url=`https://raw.githubusercontent.com/sxyazi/yazi/${e.release_tag}/CHANGELOG.md`;
 if(e.repository==='run-llama/llama_index'&&e.release_tag==='v0.12.12')url=`https://raw.githubusercontent.com/run-llama/llama_index/${e.release_tag}/CHANGELOG.md`;
 if(e.repository==='curl/curl')url=`https://curl.se/changes.html`;
 if(url&&!e.supplemental)tasks.push({file,url});
}
let cursor=0;await Promise.all(Array.from({length:3},async()=>{while(cursor<tasks.length){const {file,url}=tasks[cursor++];const e=JSON.parse(fs.readFileSync(root+'/'+file));try{const response=await fetch(url,{signal:AbortSignal.timeout(40000)});const content=await response.text();e.supplemental={url:response.url,status:response.status,retrieved_at:new Date().toISOString(),content:content.includes('<html')||content.includes('<!DOCTYPE')?plain(content):content,sha256:createHash('sha256').update(content).digest('hex')};fs.writeFileSync(root+'/'+file,JSON.stringify(e,null,2));console.log(response.status,e.repository,e.release_tag);}catch(error){console.log(error.message,file);}}}));
