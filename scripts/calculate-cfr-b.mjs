import fs from 'node:fs';import path from 'node:path';
import {parseCSV,toCSV} from '../lib/csv.mjs';
import {calculateCfrB,evaluateHeuristics,CFR_B_HEADERS} from '../lib/corrective.mjs';
import {windowDates} from '../lib/metrics.mjs';
import {importReleaseData} from '../lib/datasets.mjs';
const args=Object.fromEntries(process.argv.slice(2).reduce((a,v,i,s)=>v.startsWith('--')?[...a,[v.slice(2),s[i+1]]]:a,[]));
try{
 const output=path.resolve(args.output||'data/cfr-b');fs.mkdirSync(output,{recursive:true});
 const reference=parseCSV(fs.readFileSync(args.consensus||'data/gold-standard/consensus.csv','utf8'),{spreadsheetEscapes:true});
 let releases=[];
 if(args.evidence){const data=JSON.parse(fs.readFileSync(args.evidence,'utf8'));releases=Array.isArray(data)?data:data.releases;}
 else if(args.csv){releases=importReleaseData(fs.readFileSync(args.csv,'utf8'),args.start,args.end).flatMap(r=>r.releases.map(x=>({...x,repository:r.full_name})));}
 else if(args.job){if(!/^[\w-]+$/.test(args.job))throw new Error('ID de coleta inválido.');const dir=path.resolve('data/jobs',args.job),job=JSON.parse(fs.readFileSync(path.join(dir,'job.json'),'utf8'));args.start||=job.start;args.end||=job.end;for(const r of job.results){const f=path.join(dir,encodeURIComponent(r.repository)+'.releases.json');if(fs.existsSync(f))releases.push(...JSON.parse(fs.readFileSync(f,'utf8')).releases.map(x=>({...x,repository:r.repository})));}}
 else throw new Error('Informe --job ID, --csv arquivo.csv ou --evidence releases.json.');
 const report=evaluateHeuristics(reference,releases);fs.writeFileSync(path.join(output,'validation.json'),JSON.stringify(report,null,2));
 fs.writeFileSync(path.join(output,'reference-audit.csv'),toCSV(report.audit,['repository','release_tag','reference_date','actual_date','status','expected']));
 fs.writeFileSync(path.join(output,'heuristic-versions.csv'),toCSV(report.versions,['version','n','tp','fp','fn','tn','precision','recall','f1']));
 fs.writeFileSync(path.join(output,'predictions.csv'),toCSV(report.predictions,['repository','release_tag','expected','version','corrective','reason','patch','fix_commits','commits_total','fix_ratio']));
 const heuristic=args.heuristic||(report.status==='calibration_complete'?report.chosen_version:null)||'fix-majority-v3';
 if(args.start&&args.end){const dates=windowDates(args.start,args.end),groups=new Map();for(const r of releases){const g=groups.get(r.repository)||[];g.push(r);groups.set(r.repository,g);}const metrics=[...groups].map(([repository,rs])=>({repository,...calculateCfrB(rs,dates.start,dates.end,heuristic)}));fs.writeFileSync(path.join(output,'cfr-b.csv'),toCSV(metrics,CFR_B_HEADERS));fs.writeFileSync(path.join(output,'cfr-b-episodes.csv'),toCSV(metrics.flatMap(r=>r.episodes.map(e=>({repository:r.repository,...e}))),['repository','tag_name','published_at','outcome','corrective_tag','hours_to_correction']));}
 fs.writeFileSync(path.join(output,'REPORT.md'),`# CFR (b) — Leandro\n\nEstado da validação: **${report.status}**.\n\nReferências verificadas: ${report.verified_rows}/${report.reference_rows}. A avaliação usa tags e datas reais; referências ausentes/divergentes não entram no F1.\n\nVersão para os cálculos: ${heuristic}. Sem validação completa, os resultados são exploratórios. A escolha por F1 no mesmo consenso é calibração, não teste independente.\n\nOs rótulos originais não foram alterados. Consulte reference-audit.csv para corrigir a evidência com os avaliadores.\n`);
 console.log(JSON.stringify({output,status:report.status,verified:report.verified_rows,reference:report.reference_rows,heuristic}));
 if(process.argv.includes('--require-valid')&&(report.status!=='calibration_complete'||!report.threshold_met))process.exitCode=2;
}catch(e){console.error(e.message);process.exitCode=1;}
