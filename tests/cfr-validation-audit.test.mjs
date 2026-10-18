import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {toCSV} from '../lib/csv.mjs';

test('auditoria não transforma rótulos vazios em consenso nem validação de F1',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'dora-validation-audit-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const sample={repository:'a/b',release_tag:'v1',release_published_at:'2025-01-01T00:00:00Z'};
 const folder=path.join(root,'data/gold-standard-final-300-2025');fs.mkdirSync(folder,{recursive:true});
 const csv=toCSV([sample],Object.keys(sample));fs.writeFileSync(path.join(folder,'gold_standard_sample.csv'),csv);
 for(const name of ['leandro','luis','isabella'])fs.writeFileSync(path.join(folder,'rotulos-'+name+'.csv'),csv);
 const dataset=path.join(root,'data/dataset-s02-final');fs.mkdirSync(dataset,{recursive:true});fs.writeFileSync(path.join(dataset,'manifest.json'),JSON.stringify({source_job_id:'job',cfr_b_validation:'pending_independent_labels'}));
 const run=spawnSync(process.execPath,[fileURLToPath(new URL('../scripts/audit-final-cfr-validation.mjs',import.meta.url))],{cwd:root,encoding:'utf8'});
 assert.equal(run.status,0,run.stderr);
 const report=JSON.parse(fs.readFileSync(path.join(dataset,'validacao/cfr-b/prerequisite-audit.json')));
 assert.equal(report.status,'blocked_missing_prerequisites');assert.equal(report.f1,null);assert.equal(report.f1_calculated,false);assert.equal(report.consensus.exists,false);
 assert.equal(report.local_evidence.missing,1);assert.ok(report.raters.every(r=>r.corrective_filled===0));
 assert.equal(fs.readFileSync(path.join(folder,'rotulos-leandro.csv'),'utf8'),csv);assert.equal(fs.existsSync(path.join(folder,'consensus.csv')),false);
});
