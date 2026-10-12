import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseCSV,repositories,toCSV} from '../lib/csv.mjs';
import {imported} from '../lib/pipeline.mjs';
import {importReleaseData,RELEASE_DATA_HEADERS} from '../lib/datasets.mjs';
test('CSV aceita BOM, ponto e vírgula, aspas e campos multilinha',()=>{
  assert.deepEqual(parseCSV('\uFEFFname;value\r\n"a;b";"c""d\ne"'),[{name:'a;b',value:'c"d\ne'}]);
  assert.throws(()=>parseCSV('a,b\n1'));assert.throws(()=>parseCSV('a,a\n1,2'));assert.throws(()=>parseCSV('a\n"broken'));assert.throws(()=>parseCSV('a'));
});
test('repositórios normalizados e deduplicados; URLs arbitrárias rejeitadas',()=>{
  assert.deepEqual(repositories('repository,default_branch\nhttps://github.com/cli/cli.git,trunk\nCLI/CLI,trunk'),[{full_name:'cli/cli',default_branch:'trunk'}]);assert.throws(()=>repositories('full_name\nhttps://evil.test/cli'));assert.equal(repositories('owner,repo\na,b')[0].full_name,'a/b');
});
test('exportação impede fórmulas de planilha e escapa aspas',()=>{assert.match(toCSV([{a:'=1+1',b:'"x"'}]),/'=1\+1/);assert.match(toCSV([{a:'"x"'}]),/""x""/);});
test('CSV de runs rejeita falta de esquema',()=>{assert.throws(()=>imported('repository\na/b'),/default_branch/);});

test('CSV exportado preserva tags com escopo ao reimportar para B e a referência humana',()=>{
 const row={repository:'a/b',default_branch:'main',window_start:'2025-01-01',window_end:'2025-12-31',tag_name:'@scope/pkg@1.1.0',base_tag:'@scope/pkg@1.0.0',published_at:'2025-05-01T00:00:00Z',has_previous_release:true,compare_error:'',name:'release',body:'- fix crash',commits_json:'[]'};
 const csv=toCSV([row],RELEASE_DATA_HEADERS),release=importReleaseData(csv,row.window_start,row.window_end)[0].releases[0];
 assert.equal(release.tag_name,row.tag_name);assert.equal(release.base_tag,row.base_tag);assert.equal(release.body,row.body);
 assert.equal(parseCSV(csv,{spreadsheetEscapes:true})[0].tag_name,row.tag_name);
 assert.equal(parseCSV("tag_name\n'@literal")[0].tag_name,"'@literal");
});
