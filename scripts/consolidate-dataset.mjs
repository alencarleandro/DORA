import fs from 'node:fs';
import path from 'node:path';
import {toCSV} from '../lib/csv.mjs';
import {load} from '../lib/pipeline.mjs';
import {INTEGRATED_HEADERS} from '../lib/integration.mjs';
const id=process.argv[2]||'1deaa513-2c06-4949-bd54-2c591b0eef12';
try {
 const a=load(id),parts=JSON.parse(fs.readFileSync(path.resolve('data/jobs',id,'exports/parts.json'),'utf8'));
 if(a.datasets?.completed.length!==a.results.length||a.results.length!==300)throw new Error('A coleta dos 300 projetos ainda não está completa.');
 const b=load(parts.find(r=>r.mode==='releases').id),c=load(parts.find(r=>r.mode==='collect').id);
 for(const job of [b,c])if(job.status!=='completed'||job.results.length!==a.results.length||job.start!==a.start||job.end!==a.end)throw new Error('B/C incompletos ou com janela divergente.');
 const index=job=>{const map=new Map();for(const r of job.results){const key=r.repository.toLowerCase();if(map.has(key))throw new Error('Repositório duplicado em B/C.');map.set(key,r);}return map;};
 const bm=index(b),cm=index(c),rows=a.results.map(r=>{const key=r.repository.toLowerCase();if(!bm.has(key)||!cm.has(key))throw new Error('Projeto ausente em B/C.');const {episodes,...workflows}=cm.get(key);return {...r,...bm.get(key),...workflows,window_start:a.start,window_end:a.end,source_job_id:a.id,b_job_id:b.id,c_job_id:c.id,cfr_b_validation:'pending_independent_labels'};});
 const out=path.resolve('data/dataset-s02-final');fs.mkdirSync(out,{recursive:true});
 const comparisonQuality=JSON.parse(fs.readFileSync(path.resolve('data/jobs',id,'comparison-quality.json'),'utf8'));
 const headers=['window_start','window_end',...INTEGRATED_HEADERS,'cfr_b_validation','source_job_id','b_job_id','c_job_id'];
 fs.writeFileSync(path.join(out,'dataset.csv'),toCSV(rows,headers));
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({rows:rows.length,window_start:a.start,window_end:a.end,source_job_id:a.id,b_job_id:b.id,c_job_id:c.id,cfr_b_validation:'pending_independent_labels',unavailable_comparisons:comparisonQuality.unavailable_comparisons,missing_values:'blank, never substituted with zero',generated_at:new Date().toISOString()},null,2));
 fs.copyFileSync(path.resolve('data/jobs',b.id,'exports/metrics.csv'),path.join(out,'metrics-b.csv'));fs.copyFileSync(path.resolve('data/jobs',c.id,'exports/metrics.csv'),path.join(out,'metrics-c.csv'));
 fs.writeFileSync(path.join(out,'README.md'),`# Dataset consolidado da Sprint 2\n\n${rows.length} repositórios, janela UTC ${a.start} a ${a.end}. A coleta e os cálculos B/C estão completos. A coluna cfr_b é exploratória: a rotulação independente e o consenso da nova amostra-ouro ainda são necessários para validar o F1.\n\nCFR é proporção entre 0 e 1. Tempos são horas salvo campos explicitamente _days. Frequência é releases por semana. Vazios não são zeros. Valores de recuperação censurados estão separados das medianas observadas.\n\nDados e cache permanecem nas pastas data/jobs. O pacote pequeno contém métricas e referências para rotulação; os inputs CSV e arquivos brutos volumosos permanecem locais. Veja docs/DATA-DICTIONARY.md e docs/PARTE-C-S02.md no projeto.\n`);
 console.log(JSON.stringify({output:out,rows:rows.length,b:b.id,c:c.id}));
}catch(error){console.error(error.message);process.exitCode=1;}
