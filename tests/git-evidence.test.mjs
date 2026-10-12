import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {GitEvidence} from '../lib/git-evidence.mjs';
import {auditGitComparisons} from '../lib/raw-audit.mjs';
test('histórico Git recupera commits entre tags, datas do autor e tags anotadas',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'dora-git-evidence-')),repository=path.join(root,'a%2Fb');
 const git=args=>{const r=spawnSync('git',args,{cwd:repository,encoding:'utf8',env:{...process.env,GIT_AUTHOR_DATE:'2025-01-01T10:00:00Z',GIT_COMMITTER_DATE:'2026-01-01T10:00:00Z'}});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
 try {
  fs.mkdirSync(repository);git(['init','--bare']);
  const tree=git(['mktree']);
  const commit=(message,parent)=>{const r=spawnSync('git',['-c','user.name=Test','-c','user.email=test@example.invalid','commit-tree',tree,...(parent?['-p',parent]:[])],{cwd:repository,input:message,encoding:'utf8',env:{...process.env,GIT_AUTHOR_DATE:'2025-01-01T10:00:00Z',GIT_COMMITTER_DATE:'2026-01-01T10:00:00Z'}});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
  const base=commit('initial'),head=commit('fix: crash\n\nDetailed explanation',base);git(['update-ref','refs/tags/v1.0.0',base]);git(['update-ref','refs/heads/main',head]);git(['symbolic-ref','HEAD','refs/heads/main']);git(['-c','user.name=Test','-c','user.email=test@example.invalid','tag','-a','v1.0.1','-m','release',head]);
  const evidence=new GitEvidence({directory:root}),result=evidence.compare('a/b','v1.0.0','v1.0.1');
  assert.equal(result.data.total_commits,1);assert.equal(result.data.commits[0].sha,head);assert.equal(Date.parse(result.data.commits[0].commit.author.date),Date.parse('2025-01-01T10:00:00Z'));assert.match(result.data.commits[0].commit.message,/Detailed explanation/);assert.equal(result.base_sha,base);assert.equal(result.head_sha,head);
  assert.equal(evidence.tags('a/b').data.find(t=>t.name==='v1.0.1').commit.sha,head);
  git(['config','uploadpack.allowFilter','true']);
  const destination=path.join(root,'clones'),interrupted=path.join(destination,'a%2Fb');fs.mkdirSync(interrupted,{recursive:true});fs.writeFileSync(path.join(interrupted,'HEAD'),'ref: refs/heads/.invalid\n');
  const cloned=new GitEvidence({directory:destination}),run=cloned.run.bind(cloned);
  cloned.run=args=>run(args.map(arg=>arg==='https://github.com/a/b.git'?pathToFileURL(repository).href:arg));
  const recovered=cloned.compare('a/b','v1.0.0','v1.0.1');assert.deepEqual(recovered.data,result.data);
  assert.equal(fs.readFileSync(path.join(interrupted,'HEAD'),'utf8'),'ref: refs/heads/.invalid\n');
  const directory=cloned.ensure('a/b'),objects=run(['--git-dir='+directory,'cat-file','--batch-all-objects','--batch-check=%(objecttype)']);
  assert.match(objects,/commit/);assert.match(objects,/tag/);assert.doesNotMatch(objects,/tree|blob/);
  assert.equal(run(['--git-dir='+directory,'config','--get','remote.origin.partialclonefilter']).trim(),'tree:0');
  const separate=commit('unrelated root');git(['update-ref','refs/tags/v9.0.0',separate]);
  assert.throws(()=>evidence.compare('a/b','v1.0.0','v9.0.0'),error=>error.code==='COMPARE_UNAVAILABLE'&&error.compare_error==='unrelated_histories');
  const raw=path.join(root,'a%2Fb.releases.json');fs.writeFileSync(raw,JSON.stringify({releases:[{tag_name:'v1.0.1',base_tag:'v1.0.0',base_sha:base,head_sha:head,collection_method:'git-log-base-to-head',commits:[{sha:head}]},{tag_name:'v9.0.0',base_tag:'v1.0.1',base_sha:head,head_sha:separate,collection_method:'git-log-base-to-head',commits:[{sha:separate}]}]}));
  const report=auditGitComparisons({results:[{repository:'a/b'}]},root,evidence);assert.equal(report.git_comparisons_checked,1);assert.equal(report.unavailable_comparisons,1);
  const audited=JSON.parse(fs.readFileSync(raw,'utf8'));assert.equal(audited.releases[0].commits[0].sha,head);assert.equal(audited.releases[1].compare_error,'unrelated_histories');assert.deepEqual(audited.releases[1].commits,[]);assert.equal(JSON.parse(fs.readFileSync(raw+'.before-ancestry-audit','utf8')).releases[1].commits[0].sha,separate);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
