import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parseCSV,toCSV} from '../lib/csv.mjs';
import {descriptiveStats,classifyWindowFrequency,analyzeDescriptive} from '../lib/descriptive.mjs';
import {runDescriptive} from '../scripts/analyze-rq01-rq04.mjs';
import {runAnalysis} from '../scripts/analyze-rq07-rq08.mjs';

const base=(overrides={})=>({repository:'a/b',default_branch:'main',window_start:'2025-01-01',window_end:'2025-12-31',releases_in_window:'52',deployment_frequency:String(52/(365/7)),lead_time_release_median_hours:'24',lead_time_commit_median_hours:'12',cfr_ci:'.2',cfr_b:'.1',recovery_median_hours:'24',censored_fraction:'.5',failures:'20',successes:'80',runs_valid:'100',runs_total:'100',runs_ignored:'0',episodes_total:'10',episodes_censored:'5',cfr_b_releases_evaluated:'50',cfr_b_releases_failed:'5',cfr_b_releases_censored:'2',cfr_b_releases_unknown:'0',cfr_b_validation:'pending_independent_labels',...overrides});
test('quartis de projetos: interpolação tipo 7, vazios separados de zero',()=>{
 assert.deepEqual(descriptiveStats([null,0,10,20,30,Infinity]),{n:4,min:0,q1:7.5,median:15,q3:22.5,iqr:15,max:30,zeros:1});
 assert.equal(descriptiveStats([]).median,null);assert.equal(descriptiveStats([4]).iqr,0);
});
test('limites da frequência mensal em ano civil normal e bissexto não arredondam semanas',()=>{
 for(const year of ['2024','2025']){
  assert.equal(classifyWindowFrequency(11,year+'-01-01',year+'-12-31'),1);
  assert.equal(classifyWindowFrequency(12,year+'-01-01',year+'-12-31'),2);
 }
 assert.equal(classifyWindowFrequency(53,'2025-01-01','2025-12-31'),3);
 assert.equal(classifyWindowFrequency(365,'2025-01-01','2025-12-31'),4);
});
test('C1 completa usa quatro dimensões; recuperação ausente não vira Elite',()=>{
 const r=analyzeDescriptive([base(),base({repository:'a/c',recovery_median_hours:'',episodes_total:'0',episodes_censored:'0',censored_fraction:''})]);
 assert.equal(r.c1.complete_n,1);assert.equal(r.c1.partial_n,1);
 assert.equal(r.rows[0].c1_complete_score,2); // DF Medium, LT High, CFR High, recovery Medium -> floor(2.5).
 assert.equal(r.rows[1].c1_complete_score,null);assert.equal(r.rows[1].recovery_score,null);
 assert.equal(r.rows[1].recovery_missing_reason,'no_observed_episode');
 assert.equal(r.rows[1].c1_available_score,3);
});
test('zero CFR e recuperação zero reais são preservados, censura completa explicada',()=>{
 const r=analyzeDescriptive([base({failures:'0',successes:'100',cfr_ci:'0',recovery_median_hours:'0'}),base({repository:'a/c',recovery_median_hours:'',episodes_censored:'10',censored_fraction:'1'})]);
 assert.equal(r.rows[0].cfr_ci,0);assert.equal(r.rows[0].recovery_score,4);assert.equal(r.rows[1].recovery_missing_reason,'all_episodes_censored');
});
test('negativos, valores não numéricos e taxas inválidas não entram nas estatísticas nem são alterados na fonte',()=>{
 const row=base({lead_time_commit_median_hours:'-12',cfr_b:'1.1',recovery_median_hours:'invalido'});
 const r=analyzeDescriptive([row]);assert.equal(row.lead_time_commit_median_hours,'-12');assert.equal(r.rows[0].lead_time_commit_median_hours,null);
 assert.equal(r.warnings.length,3);assert.equal(r.summary.find(x=>x.field==='lead_time_commit_median_hours').n,0);assert.equal(r.rows[0].c1_complete_score,null);
});
test('taxas inconsistentes com contagens são sinalizadas e excluídas',()=>{
 const r=analyzeDescriptive([base({cfr_ci:'.9',deployment_frequency:'99'})]);
 assert.equal(r.rows[0].cfr_ci,null);assert.equal(r.rows[0].deployment_frequency,null);assert.equal(r.c1.complete_n,0);assert.equal(r.warnings.length,2);
});
test('não mistura janelas, duplicatas e denominador zero com taxa definida',()=>{
 assert.throws(()=>analyzeDescriptive([]),/vazio/);
 assert.throws(()=>analyzeDescriptive([base(),base({repository:'A/B'})]),/duplicado/);
 assert.throws(()=>analyzeDescriptive([base(),base({repository:'a/c',window_start:'2024-01-01',window_end:'2024-12-31'})]),/janelas/);
 assert.throws(()=>analyzeDescriptive([base({failures:'0',successes:'0'})]),/denominador zero/);
});
test('comparação pareada exclui apenas projetos sem ambas as variantes',()=>{
 const r=analyzeDescriptive([base(),base({repository:'a/c',lead_time_commit_median_hours:'-1'})]);
 assert.equal(r.paired.lead_time_release_minus_commit.n,1);assert.equal(r.paired.lead_time_release_minus_commit.a_greater,1);
 assert.equal(r.cfr_b_validation[0],'pending_independent_labels');
});
test('CLI local gera artefatos portáteis sem rede, sem alterar fonte e explicita CFR exploratório',t=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'dora-rq01-'));t.after(()=>fs.rmSync(tmp,{recursive:true,force:true}));
 const source=path.join(tmp,'input.csv'),output=path.join(tmp,'output');const csv=toCSV([base()],Object.keys(base()));fs.writeFileSync(source,csv);
 const result=runDescriptive({dataset:source,output,plots:false});assert.equal(result.rows,1);
 assert.equal(fs.readFileSync(source,'utf8'),csv);assert.match(fs.readFileSync(path.join(output,'REPORT.md'),'utf8'),/EXPLORATÓRIO/);
 assert.equal(parseCSV(fs.readFileSync(path.join(output,'c1-classifications.csv'),'utf8')).length,1);
 const manifest=JSON.parse(fs.readFileSync(path.join(output,'manifest.json'),'utf8'));assert.equal(manifest.plots_completed,false);assert.equal(manifest.dataset_sha256.length,64);
});

test('RQ07 e RQ01-04 compartilham C1 disponível para os 300 projetos, incluindo o limite mensal',t=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'dora-c1-integration-'));t.after(()=>fs.rmSync(tmp,{recursive:true,force:true}));
 const dataset='data/dataset-s02-final/dataset.csv';
 runAnalysis({dataset,output:tmp});
 const old=new Map(parseCSV(fs.readFileSync(path.join(tmp,'rq07-classifications.csv'),'utf8'),{spreadsheetEscapes:true}).map(r=>[r.repository,Number(r.c1_score)]));
 const current=analyzeDescriptive(parseCSV(fs.readFileSync(dataset,'utf8'),{spreadsheetEscapes:true}));
 assert.equal(current.n,300);assert.equal(current.c1.complete_n,258);
 for(const row of current.rows)assert.equal(row.c1_available_score,old.get(row.repository),row.repository);
});
