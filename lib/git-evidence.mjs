import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
export class GitEvidence {
 constructor({directory,log=()=>{}}){this.directory=directory;this.log=log;this.directories=new Map();}
 run(args){
  const result=spawnSync('git',['-c','credential.helper=','-c','http.extraHeader=',...args],{encoding:'utf8',maxBuffer:128*1024*1024,env:{...process.env,GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'never',GITHUB_TOKEN:''}});
  if(result.status!==0)throw new Error('Git local: '+result.stderr.trim());return result.stdout;
 }
 ensure(repository){
  if(!/^[\w.-]+\/[\w.-]+$/.test(repository))throw new Error('Repositório inválido.');
  if(this.directories.has(repository))return this.directories.get(repository);
  const base=path.join(this.directory,encodeURIComponent(repository));let directory=base,n=0;
  // Preserve an interrupted clone rather than treating its unfinished refs as complete.
  while(fs.existsSync(directory)&&!fs.existsSync(path.join(directory,'packed-refs'))&&(!fs.existsSync(path.join(directory,'HEAD'))||fs.readFileSync(path.join(directory,'HEAD'),'utf8').includes('.invalid')))directory=base+'.recovery-'+(++n);
  if(!fs.existsSync(directory)){fs.mkdirSync(this.directory,{recursive:true});this.log('Recuperando histórico Git público de '+repository);this.run(['clone','--bare','--filter=tree:0','https://github.com/'+repository+'.git',directory]);}
  this.directories.set(repository,directory);
  return directory;
 }
 compare(repository,baseTag,headTag){
  const dir=this.ensure(repository),git=args=>this.run(['--git-dir='+dir,...args]);
  const baseSha=git(['rev-parse','--verify','refs/tags/'+baseTag+'^{commit}']).trim(),headSha=git(['rev-parse','--verify','refs/tags/'+headTag+'^{commit}']).trim();
  this.checkAncestry(dir,baseSha,headSha);
  const fields=git(['log','--reverse','--no-show-signature','--no-patch','--format=%H%x00%aI%x00%B%x00',baseSha+'..'+headSha]).split('\0'),commits=[];
  for(let n=0;n+2<fields.length;n+=3){const sha=fields[n].trim();if(!/^[0-9a-f]{40,64}$/.test(sha))throw new Error('SHA inválido no histórico Git.');commits.push({sha,commit:{author:{date:fields[n+1]},message:fields[n+2]}});}
  return {data:{total_commits:commits.length,commits},next:null,last:null,collected_at:new Date().toISOString(),collection_method:'git-log-base-to-head',base_sha:baseSha,head_sha:headSha};
 }
 checkAncestry(directory,base,head){
  const result=spawnSync('git',['--git-dir='+directory,'merge-base',base,head],{encoding:'utf8',env:{...process.env,GITHUB_TOKEN:'',GIT_TERMINAL_PROMPT:'0'}});
  if(result.status===1)throw Object.assign(new Error('Históricos Git sem ancestral comum.'),{code:'COMPARE_UNAVAILABLE',compare_error:'unrelated_histories'});
  if(result.status!==0)throw new Error('Git local: '+String(result.stderr||result.error||'Falha no merge-base.').trim());
 }
 tags(repository){
  const dir=this.ensure(repository),text=this.run(['--git-dir='+dir,'for-each-ref','--format=%(refname:strip=2)%00%(objectname)%00%(*objectname)','refs/tags']);
  const data=text.trim()?text.trimEnd().split('\n').map(line=>{const [name,sha,peeled]=line.split('\0');return {name,commit:{sha:peeled||sha}};}):[];
  return {data,next:null,last:null,collected_at:new Date().toISOString(),collection_method:'git-for-each-ref'};
 }
}
