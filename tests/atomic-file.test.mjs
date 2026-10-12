import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {replaceFile} from '../lib/atomic-file.mjs';
test('substituição atômica retenta bloqueio temporário sem apagar o estado anterior',()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'dora-atomic-'));
 try{
  const temporary=path.join(directory,'new'),target=path.join(directory,'state');fs.writeFileSync(temporary,'new');fs.writeFileSync(target,'old');let calls=0;
  replaceFile(temporary,target,{rename:(a,b)=>{if(++calls<3){assert.equal(fs.readFileSync(b,'utf8'),'old');throw Object.assign(new Error('locked'),{code:'EPERM'});}fs.renameSync(a,b);},wait:()=>{}});
  assert.equal(calls,3);assert.equal(fs.readFileSync(target,'utf8'),'new');
  assert.throws(()=>replaceFile(temporary,target,{rename:()=>{throw Object.assign(new Error('denied'),{code:'EACCES'});},wait:()=>assert.fail('Não deve retentar permissão permanente.')}),/denied/);
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});
