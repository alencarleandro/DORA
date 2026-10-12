import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {writeRawExports} from '../lib/export-files.mjs';
import {parseCSV} from '../lib/csv.mjs';
test('exportação por lotes mantém linhas, aspas e janela para reimportação local',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'dora-exports-'));
 try{
  const repo='a/b',runs=Array.from({length:1001},(_,id)=>({repository:repo,default_branch:'main',id,workflow_id:1,event:'push',head_branch:'main',conclusion:'success',created_at:'2025-01-01T00:00:00Z',run_started_at:'2025-01-01T00:00:01Z',updated_at:'2025-01-01T00:00:02Z'}));
  fs.writeFileSync(path.join(root,'a%2Fb.runs.json'),JSON.stringify(runs));
  const release={tag_name:'v1',published_at:'2025-01-02T00:00:00Z',has_previous_release:true,body:'fix "crash"\nDetails',commits:[{sha:'abc',author_date:'2025-01-01T00:00:00Z',message:'fix: "crash"\nDetails'}]};
  fs.writeFileSync(path.join(root,'a%2Fb.releases.json'),JSON.stringify({releases:[release]}));
  const out=path.join(root,'exports');writeRawExports({start:'2025-01-01',end:'2025-12-31',results:[{repository:repo,default_branch:'main'}],datasets:{completed:[repo]}},root,out);
  const raw=parseCSV(fs.readFileSync(path.join(out,'runs.csv'),'utf8'));assert.equal(raw.length,1001);assert.equal(raw[1000].id,'1000');assert.equal(raw[1000].window_start,'2025-01-01');assert.equal(raw[1000].window_end,'2025-12-31');
  const data=parseCSV(fs.readFileSync(path.join(out,'release-data.csv'),'utf8'));assert.equal(data.length,1);assert.equal(data[0].body,release.body);assert.equal(JSON.parse(data[0].commits_json)[0].message,release.commits[0].message);
  assert.equal(parseCSV(fs.readFileSync(path.join(out,'commits.csv'),'utf8'))[0].commit_sha,'abc');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
