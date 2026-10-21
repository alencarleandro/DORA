// Run after calculate-cfr-b and audit-final-cfr-validation.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseCSV} from '../lib/csv.mjs';
const folder='data/gold-standard-final-300-2025',out='data/dataset-s02-final/validacao/cfr-b';
const json=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const hash=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const result=json(out+'/validation.json'),adjudication=json(folder+'/adjudication-log.json');
assert.equal(hash(folder+'/consensus.csv'),adjudication.consensus_sha256);
const predictions=parseCSV(fs.readFileSync(out+'/predictions.csv','utf8'),{spreadsheetEscapes:true});
for(const version of result.versions){
 const rows=predictions.filter(r=>r.version===version.version);assert.equal(rows.length,300);
 const truth=s=>['true','sim','1'].includes(String(s).toLowerCase());
 let tp=0,fp=0,fn=0,tn=0;
 for(const r of rows){if(truth(r.expected)){if(truth(r.corrective))tp++;else fn++;}else if(truth(r.corrective))fp++;else tn++;}
 for(const [k,v] of Object.entries({tp,fp,fn,tn}))assert.equal(version[k],v);
 assert.ok(Math.abs(version.f1-2*tp/(2*tp+fp+fn))<1e-12);
}
assert.equal(result.verified_rows,300);assert.equal(result.reference_rows,300);
const best=result.versions.find(v=>v.version===result.chosen_version);assert.ok(best);
const status=result.threshold_met?'calibrated_on_assisted_reference_not_independent':'calibrated_below_threshold_assisted_reference';
result.consensus_sha256=adjudication.consensus_sha256;
result.reference_provenance='Reviewed AI-assisted labels, shared AI suggestions for Luis/Leandro; 21 delegated AI adjudications authorized by user. Not independent human validation.';
result.reference_limitations=['Shared proposal origin limits inter-rater independence.','Decisions adjudicated by AI under user delegation, not a claimed human discussion per item.','Version selected on the same reference: calibration, not external evaluation.'];
result.acceptance_status=status;
fs.writeFileSync(out+'/validation.json',JSON.stringify(result,null,2)+'\n');
const audit=json(out+'/prerequisite-audit.json');
assert.ok(audit.consensus.complete);assert.ok(audit.raters.every(r=>r.corrective_filled===300));
audit.status=status;audit.f1=best.f1;audit.f1_calculated=true;
audit.calibration={version:best.version,precision:best.precision,recall:best.recall,f1:best.f1,threshold:.7,threshold_met:result.threshold_met,consensus_sha256:adjudication.consensus_sha256,evaluation_type:'calibration_on_assisted_reference_not_independent_test'};
audit.blockers=result.threshold_met?[]:['F1 abaixo do mínimo de 0,70; não aprovar a heurística.'];
audit.method='Prerequisite audit plus verified calibration summary; original rater labels preserved, shared AI provenance disclosed.';
const manifestFile='data/dataset-s02-final/manifest.json',manifest=json(manifestFile);
manifest.cfr_b_validation=status;
manifest.cfr_b_calibration={report:'validacao/cfr-b/validation.json',consensus:'../gold-standard-final-300-2025/consensus.csv',consensus_sha256:adjudication.consensus_sha256,heuristic:best.version,f1:best.f1,threshold_met:result.threshold_met,independent_test:false};
fs.writeFileSync(manifestFile,JSON.stringify(manifest,null,2)+'\n');
audit.dataset_validation_unchanged=manifest.cfr_b_validation;
fs.writeFileSync(out+'/prerequisite-audit.json',JSON.stringify(audit,null,2)+'\n');
const pct=v=>(100*v).toFixed(2).replace('.',',')+'%';
const report=`# CFR (b) — calibração na amostra final 2025\n\nData: 20/10/2026. Estado: **${status}**.\n\nAs 300 referências foram verificadas contra tags e datas reais. Os três arquivos individuais têm 300 rótulos preenchidos. O consenso operacional contém 112 corretivas e 188 não corretivas. Foram resolvidas por adjudicação de IA delegada 14 divergências corretivas e 7 decisões de projeto; os votos originais foram preservados. Veja [protocolo](../../../gold-standard-final-300-2025/consensus_summary.md) e [decisões](../../../gold-standard-final-300-2025/adjudication-log.json).\n\n## Concordância pré-adjudicação\n\nPara release corretiva: concordância observada **96,89%**, Fleiss κ **0,932119** (valor exato no agreement_report.json). Esses números são descritivos: Luis e Leandro reutilizaram sugestões de IA comuns. Não demonstram confiabilidade de três avaliações humanas independentes.\n\n## Classificador\n\n| Versão | TP | FP | FN | TN | Precisão | Recall | F1 |\n|---|---:|---:|---:|---:|---:|---:|---:|\n${result.versions.map(v=>`| ${v.version} | ${v.tp} | ${v.fp} | ${v.fn} | ${v.tn} | ${pct(v.precision)} | ${pct(v.recall)} | ${pct(v.f1)} |`).join('\n')}\n\nMelhor versão nesta referência: **${best.version}**, com F1 **${pct(best.f1)}**. Mínimo exigido: **70%**. ${result.threshold_met?'Atingiu o corte nesta calibração, sem configurar teste independente.':'Não atingiu o corte. A heurística não está aprovada e o CFR (b) permanece exploratório.'}\n\nPrecisão = TP/(TP+FP); recall = TP/(TP+FN); F1 = 2TP/(2TP+FP+FN). As matrizes foram recontadas a partir de predictions.csv. Selecionar a melhor versão no mesmo consenso é calibração e não demonstra generalização. Uma referência com origem compartilhada de IA tem limitações adicionais de independência.\n\n## Consequências\n\nNão alteramos os valores do dataset, os rótulos individuais ou a heurística para melhorar o resultado. O manifesto registra o estado real da calibração. É necessário revisar a heurística e avaliar seu desempenho com referência adequada, idealmente independente; não ajustar os rótulos para alcançar F1. As análises e o relatório Word anteriormente gerados continuam com resultados exploratórios; o Word de 19/10/2026 antecede esta calibração.\n\n## Reprodução local\n\n1. node scripts/calculate-agreement.mjs --data-dir ${folder}\n2. node scripts/finalize-gold-consensus-2025.mjs\n3. node scripts/calculate-cfr-b.mjs --job 1deaa513-2c06-4949-bd54-2c591b0eef12 --consensus ${folder}/consensus.csv --output ${out} --require-valid\n4. node scripts/audit-final-cfr-validation.mjs\n5. node scripts/report-final-cfr-calibration.mjs\n\nO passo 3 grava resultados mesmo quando retorna reprovação por F1. Os passos 4 e 5 auditam e consolidam o estado; o auditor isolado verifica somente pré-requisitos. Testes de concordância e heurística: 19 aprovados em 20/10/2026. Nenhum token ou acesso remoto necessário.\n`;
// Use the computed exact kappa rather than a manually rounded constant.
const agreement=json(folder+'/agreement_report.json');
const finalReport=report.replace('0,932119',agreement.dimensions.is_corrective.kappa.toFixed(6).replace('.',','));
fs.writeFileSync(out+'/REPORT.md',finalReport);fs.writeFileSync(out+'/STATUS.md',finalReport);
console.log(JSON.stringify({status,precision:best.precision,recall:best.recall,f1:best.f1,threshold_met:result.threshold_met}));
