import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseCSV,repositories,toCSV} from '../lib/csv.mjs';
import {imported} from '../lib/pipeline.mjs';
test('CSV aceita BOM, ponto e vírgula, aspas e campos multilinha',()=>{
  assert.deepEqual(parseCSV('\uFEFFname;value\r\n"a;b";"c""d\ne"'),[{name:'a;b',value:'c"d\ne'}]);
  assert.throws(()=>parseCSV('a,b\n1'));assert.throws(()=>parseCSV('a,a\n1,2'));assert.throws(()=>parseCSV('a\n"broken'));assert.throws(()=>parseCSV('a'));
});
test('repositórios normalizados e deduplicados; URLs arbitrárias rejeitadas',()=>{
  assert.deepEqual(repositories('repository,default_branch\nhttps://github.com/cli/cli.git,trunk\nCLI/CLI,trunk'),[{full_name:'cli/cli',default_branch:'trunk'}]);assert.throws(()=>repositories('full_name\nhttps://evil.test/cli'));assert.equal(repositories('owner,repo\na,b')[0].full_name,'a/b');
});
test('exportação impede fórmulas de planilha e escapa aspas',()=>{assert.match(toCSV([{a:'=1+1',b:'"x"'}]),/'=1\+1/);assert.match(toCSV([{a:'"x"'}]),/""x""/);});
test('CSV de runs rejeita falta de esquema',()=>{assert.throws(()=>imported('repository\na/b'),/default_branch/);});
