import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {parseCSV} from '../lib/csv.mjs';

test('resoluções de IA completam apenas 38 casos sem alterar os três avaliadores oficiais',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'dora-assisted-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const source='data/gold-standard-final-300-2025';fs.cpSync(source,path.join(root,source),{recursive:true});
 const files=['rotulos-leandro.csv','rotulos-luis.csv','rotulos-isabella.csv'];const before=files.map(f=>fs.readFileSync(path.join(root,source,f),'utf8'));
 const script=fileURLToPath(new URL('../scripts/resolve-leandro-ambiguities.mjs',import.meta.url));
 const run=()=>spawnSync(process.execPath,[script],{cwd:root,encoding:'utf8'});
 const result=run();assert.equal(result.status,0,result.stderr);
 const dir=path.join(root,source,'revisao-leandro');
 const resolutions=JSON.parse(fs.readFileSync(path.join(dir,'resolucoes-assistidas.json'))).resolved;
 assert.equal(resolutions.length,38);assert.ok(resolutions.every(r=>r.human_reviewed===false&&r.confidence));
 const rows=parseCSV(fs.readFileSync(path.join(dir,'rotulos-leandro-assistidos.csv'),'utf8'),{spreadsheetEscapes:true});
 assert.equal(rows.length,300);assert.ok(rows.every(r=>['sim','não'].includes(r.is_corrective)));
 assert.equal(rows.filter(r=>r.is_corrective==='sim').length,106);
 const summary=JSON.parse(fs.readFileSync(path.join(dir,'revisao-leandro.json')));assert.equal(summary.human_review_status,'pending');assert.equal(summary.corrective_unresolved,0);
 const again=run();assert.equal(again.status,0,again.stderr);assert.equal(fs.readFileSync(path.join(dir,'revisao-leandro.json'),'utf8'),JSON.stringify(summary,null,2)+'\n');
 files.forEach((f,i)=>assert.equal(fs.readFileSync(path.join(root,source,f),'utf8'),before[i]));
});
