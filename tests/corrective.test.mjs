import {test} from 'node:test';import assert from 'node:assert/strict';
import {isPatch,classifyCorrective,calculateCfrB,classificationMetrics,evaluateHeuristics} from '../lib/corrective.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {toCSV,parseCSV} from '../lib/csv.mjs';
const r=(tag,date,commits=[],base='v1.0.0')=>({tag_name:tag,published_at:date,base_tag:base,commits:commits.map(message=>({message}))});
test('patch semver não aceita prerelease, major/minor ou regressão de versão',()=>{assert.equal(isPatch('v1.2.3','1.2.4'),true);for(const t of ['v1.3.0','v2.2.4','v1.2.4-rc.1','v1.2.2'])assert.equal(isPatch('v1.2.3',t),false);});
test('versões da heurística distinguem patch, correção e documentação',()=>{const release=r('v1.0.1','2025-01-02T00:00:00Z',['feat: add login']);assert.equal(classifyCorrective(release,'patch-v1').corrective,true);assert.equal(classifyCorrective(release).corrective,false);assert.equal(classifyCorrective({...release,commits:[{message:'fix: crash'},{message:'feat: ui'}]}).corrective,true);assert.equal(classifyCorrective({...release,commits:[{message:'docs: fix typo'}]}).corrective,false);assert.equal(classifyCorrective({...release,compare_error:'not_found'}).corrective,null);assert.throws(()=>classifyCorrective(release,'wrong'),/inválida/);});
test('CFR b: fronteira de sete dias, censura e denominador',()=>{const rs=[r('v1.0.0','2025-01-01T00:00:00Z'),r('v1.0.1','2025-01-08T00:00:00Z',['fix: regression']),r('v1.1.0','2025-01-24T23:59:59Z',['feat: next']),r('v1.1.1','2025-01-25T00:00:00Z',['fix: crash'])];const m=calculateCfrB(rs,'2025-01-01T00:00:00Z','2025-01-31T23:59:59Z');assert.equal(m.releases_evaluated,3);assert.equal(m.releases_failed,2);assert.equal(m.releases_censored,1);assert.equal(m.cfr_b,2/3);});
test('não mistura repositórios; release inválida, prerelease e histórico desconhecido',()=>{const rs=[r('v1.0.0','2025-01-01T00:00:00Z'),{...r('v1.0.1','2025-01-02T00:00:00Z'),compare_error:'missing'},{...r('rc','2025-01-03T00:00:00Z',['fix']),prerelease:true}];const m=calculateCfrB(rs,'2025-01-01T00:00:00Z','2025-01-31T23:59:59Z');assert.equal(m.releases_unknown,1);assert.equal(m.releases_evaluated,1);assert.equal(m.cfr_b,0);assert.equal(calculateCfrB([],'2025-01-01T00:00:00Z','2025-01-31T23:59:59Z').cfr_b,null);assert.throws(()=>calculateCfrB([rs[0],rs[0]],'2025-01-01T00:00:00Z','2025-01-31T23:59:59Z'),/duplicada/);});
test('matriz de confusão e F1 usam referência humana, sem inventar ausências',()=>{assert.deepEqual(classificationMetrics([{expected:true,predicted:true},{expected:false,predicted:true},{expected:true,predicted:false},{expected:false,predicted:false}]),{n:4,tp:1,fp:1,fn:1,tn:1,precision:.5,recall:.5,f1:.5});assert.equal(classificationMetrics([]).f1,null);});
test('auditoria exclui datas divergentes e permite calibração somente com evidência real',()=>{const ref=[{repository:'a/b',release_tag:'v1.0.1',release_published_at:'2025-01-02T00:00:00Z',consensus_is_corrective:'sim'}];const ev=[{repository:'a/b',...r('v1.0.1','2024-01-02T00:00:00Z',['fix: crash'])}];assert.equal(evaluateHeuristics(ref,ev).verified_rows,0);ev[0].published_at=ref[0].release_published_at;const result=evaluateHeuristics(ref,ev);assert.equal(result.status,'calibration_complete');assert.equal(result.threshold_met,true);});
test('auditoria não aceita simulação, tag inexistente ou comparação ausente',()=>{
 const ref=[{repository:'a/b',release_tag:'v1',release_published_at:'2025-01-01T00:00:00Z',consensus_is_corrective:'nao'}];
 for(const [extra,status] of [[{source:'synthetic_demo',commits:[]},'synthetic_evidence'],[{lookup_error:'not_found'},'release_not_found'],[{},'comparison_unavailable'],[{commits:[],draft:true},'excluded_release']]) {
  const report=evaluateHeuristics(ref,[{repository:'a/b',tag_name:'v1',published_at:ref[0].release_published_at,...extra}]);
  assert.equal(report.audit[0].status,status);assert.equal(report.verified_rows,0);
 }
 assert.equal(classifyCorrective({tag_name:'v1'}).corrective,null);
});
test('CFR b rejeita mistura e janela inválida mesmo sem releases',()=>{
 assert.throws(()=>calculateCfrB([{repository:'a/b',...r('v1','2025-01-01T00:00:00Z')},{repository:'c/d',...r('v2','2025-01-02T00:00:00Z')}],0,1),/por repositório/);
 assert.throws(()=>calculateCfrB([],NaN,1),/Janela/);assert.throws(()=>calculateCfrB([],0,1,'fake'),/inválida/);
});
test('CLI gera métricas locais e reprova referência incompleta sem apagar relatórios',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dora-cfrb-'));
 try {
  const releases=[r('v1.0.0','2025-01-01T00:00:00Z'),r('v1.0.1','2025-01-03T00:00:00Z',['fix: crash']),r('v1.1.0','2025-01-30T00:00:00Z')].map(x=>({...x,repository:'a/b'}));
  const reference=[{repository:'a/b',release_tag:'v1.0.1',release_published_at:'2024-01-03T00:00:00Z',consensus_is_corrective:'sim'}];
  const evidence=path.join(dir,'evidence.json'),consensus=path.join(dir,'consensus.csv'),output=path.join(dir,'results');
  fs.writeFileSync(evidence,JSON.stringify(releases));fs.writeFileSync(consensus,toCSV(reference,Object.keys(reference[0])));
  const run=spawnSync(process.execPath,['scripts/calculate-cfr-b.mjs','--evidence',evidence,'--consensus',consensus,'--output',output,'--start','2025-01-01','--end','2025-01-31','--require-valid'],{encoding:'utf8'});
  assert.equal(run.status,2,run.stderr);
  const metrics=parseCSV(fs.readFileSync(path.join(output,'cfr-b.csv'),'utf8'))[0];assert.equal(metrics.cfr_b,'0.5');assert.equal(metrics.releases_censored,'1');
  assert.equal(JSON.parse(fs.readFileSync(path.join(output,'validation.json'),'utf8')).status,'reference_pending');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('sorteio local herda janela, usa releases existentes e preserva amostra anterior',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dora-gold-local-'));
 try {
  const jobDir=path.join(dir,'data','jobs','pilot'),output=path.join(dir,'gold');fs.mkdirSync(jobDir,{recursive:true});
  fs.writeFileSync(path.join(jobDir,'job.json'),JSON.stringify({start:'2025-01-01',end:'2025-12-31',results:[{repository:'a/b',default_branch:'main'}]}));
  fs.writeFileSync(path.join(jobDir,'a%2Fb.releases.json'),JSON.stringify({releases:[r('v2.0.0','2025-02-01T00:00:00Z'),r('v2.0.1','2025-02-02T00:00:00Z')]}));
  const script=path.resolve('scripts/sample-gold-standard.mjs'),args=[script,'--job','pilot','--n-repos','1','--n-releases','2','--out-dir',output];
  const run=spawnSync(process.execPath,args,{cwd:dir,encoding:'utf8',env:{...process.env,GITHUB_TOKEN:''}});assert.equal(run.status,0,run.stderr);
  const sample=parseCSV(fs.readFileSync(path.join(output,'gold_standard_sample.csv'),'utf8'));assert.equal(sample.length,2);assert.ok(sample.every(x=>x.source==='github_release'&&x.release_published_at.startsWith('2025')));
  const labels=parseCSV(fs.readFileSync(path.join(output,'rotulos-leandro.csv'),'utf8'));assert.ok(labels.every(x=>x.is_corrective===''));
  const again=spawnSync(process.execPath,args,{cwd:dir,encoding:'utf8'});assert.equal(again.status,1);assert.match(again.stderr,/preservada/);
  const rawFile=path.join(jobDir,'a%2Fb.releases.json'),raw=JSON.parse(fs.readFileSync(rawFile,'utf8'));raw.releases[0].compare_error='not_found';raw.releases[0].commits=[];raw.releases[1].has_previous_release=true;fs.writeFileSync(rawFile,JSON.stringify(raw));
  const filteredOutput=path.join(dir,'gold-comparisons'),filtered=spawnSync(process.execPath,[script,'--job','pilot','--n-repos','1','--n-releases','1','--require-comparisons','--out-dir',filteredOutput],{cwd:dir,encoding:'utf8',env:{...process.env,GITHUB_TOKEN:''}});assert.equal(filtered.status,0,filtered.stderr);
  assert.equal(parseCSV(fs.readFileSync(path.join(filteredOutput,'gold_standard_sample.csv'),'utf8'))[0].release_tag,'v2.0.1');assert.equal(JSON.parse(fs.readFileSync(path.join(filteredOutput,'sampling-manifest.json'),'utf8')).require_comparisons,true);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
