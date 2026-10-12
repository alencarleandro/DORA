// Public evidence for assisted review, independent of other raters and CFR predictions.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {parseCSV} from '../lib/csv.mjs';
const root='data/issue-6-evidence';fs.mkdirSync(root,{recursive:true});
const sample=parseCSV(fs.readFileSync('data/gold-standard-final-300-2025/gold_standard_sample.csv','utf8'),{spreadsheetEscapes:true});
export const plain=html=>html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<\/(?:p|li|h[1-6]|div|tr)>/gi,'\n').replace(/<br\s*\/?\s*>/gi,'\n').replace(/<[^>]+>/g,'').replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(+n)).replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/[ \t]+/g,' ').replace(/\n\s*\n/g,'\n').trim();
async function get(url){for(let i=0;i<3;i++){try{const r=await fetch(url,{headers:{'User-Agent':'DORA-academic-evidence'},signal:AbortSignal.timeout(45000)});if(r.status===429||r.status>=500){await new Promise(r=>setTimeout(r,1500*(i+1)));continue;}return {status:r.status,url:r.url,html:await r.text(),retrieved_at:new Date().toISOString()};}catch(e){if(i===2)return {status:0,error:e.message,url};}}return {status:429,url,error:'retries_exhausted'};}
async function pool(items,fn){let cursor=0;await Promise.all(Array.from({length:3},async()=>{while(cursor<items.length){const i=cursor++;await fn(items[i],i);}}));}
const mode=process.argv[2]||'releases';
if(mode==='releases')await pool(sample,async(row,i)=>{
 const key=createHash('sha256').update(row.repository+'\0'+row.release_tag).digest('hex').slice(0,20),file=path.join(root,key+'.json');
 if(fs.existsSync(file)&&JSON.parse(fs.readFileSync(file)).status===200&&JSON.parse(fs.readFileSync(file)).parser_version===2)return;
 const result=await get(row.release_url),html=result.html||'';
 const opener=/<div[^>]*class="[^"]*markdown-body[^"]*"[^>]*>/i.exec(html);
 let notesHtml='';if(opener){const start=opener.index+opener[0].length;let depth=1;const tags=/<\/?div\b[^>]*>/gi;tags.lastIndex=start;let token;while((token=tags.exec(html))){depth+=token[0].startsWith('</')?-1:1;if(depth===0){notesHtml=html.slice(start,token.index);break;}}}
 const compares=[...notesHtml.matchAll(/href="(https:\/\/github\.com\/[^" ]+\/compare\/[^" ]+)"/g)].map(x=>x[1].replace(/&amp;/g,'&'));
 const dates=[...html.matchAll(/<relative-time[^>]*datetime="([^"]+)"/g)].map(x=>x[1]);
 const assets=[...html.matchAll(/href="([^"]*\/releases\/download\/[^" ]+)"/g)].map(x=>x[1]);
 delete result.html;fs.writeFileSync(file,JSON.stringify({...row,...result,parser_version:2,notes:plain(notesHtml),compare_urls:[...new Set(compares)],dates,assets:[...new Set(assets)],html_sha256:createHash('sha256').update(html).digest('hex')},null,2));
 console.log(`${i+1}/300 ${result.status} ${row.repository} ${row.release_tag} notes=${plain(notesHtml).length}`);
});
if(mode==='repos')await pool([...new Set(sample.map(x=>x.repository))],async(repo,i)=>{
 const file=path.join(root,repo.replace('/','__')+'.repo.json');if(fs.existsSync(file)&&JSON.parse(fs.readFileSync(file)).status===200)return;
 const result=await get('https://github.com/'+repo),html=result.html||'';
 const article=html.match(/<article[^>]*class="[^"]*markdown-body[^"]*"[^>]*>([\s\S]*?)<\/article>/i);
 const description=html.match(/<meta name="description" content="([^"]+)"/)?.[1]||'';
 delete result.html;fs.writeFileSync(file,JSON.stringify({repository:repo,...result,description:plain(description),readme:plain(article?.[1]||''),html_sha256:createHash('sha256').update(html).digest('hex')},null,2));console.log(`${i+1}/60 ${result.status} ${repo}`);
});
