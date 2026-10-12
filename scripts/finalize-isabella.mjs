// Local handoff only: no credentials, network calls or fabricated human labels.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {load} from '../lib/pipeline.mjs';
import {parseCSV} from '../lib/csv.mjs';
const id=process.argv[2]||'1deaa513-2c06-4949-bd54-2c591b0eef12';
const folder=path.resolve('data/jobs',id),partsFile=path.join(folder,'exports/parts.json');
const wait=process.argv.includes('--wait');
const run=(command,args)=>{const result=spawnSync(command,args,{stdio:'inherit',env:{...process.env,GITHUB_TOKEN:''}});if(result.status!==0)throw new Error(command+' falhou ('+result.status+').');};
try {
 const deadline=Date.now()+24*3600000;
 while(!fs.existsSync(partsFile)){
  const a=load(id);
  if(!wait||['failed','partial','paused'].includes(a.status))throw new Error('Coleta B/C ainda incompleta: '+a.datasets.completed.length+'/300 ('+a.status+').');
  if(Date.now()>deadline)throw new Error('A espera atingiu 24 horas; dados preservados.');
  await new Promise(resolve=>setTimeout(resolve,5000));
 }
 run(process.execPath,['scripts/consolidate-dataset.mjs',id]);
 const a=load(id),dataset=path.resolve('data/dataset-s02-final'),rows=parseCSV(fs.readFileSync(path.join(dataset,'dataset.csv'),'utf8'));
 if(rows.length!==300||new Set(rows.map(r=>r.repository.toLowerCase())).size!==300)throw new Error('Dataset deve conter exatamente 300 projetos únicos.');
 for(const row of rows){
  if(row.window_start!==a.start||row.window_end!==a.end)throw new Error('Janela divergente no dataset.');
  if(row.eligible_releases!=='true'||row.eligible_runs!=='true')throw new Error('Os dados completos não confirmaram a elegibilidade: '+row.repository);
  for(const key of ['cfr_ci','cfr_b'])if(row[key]!==''&&(!Number.isFinite(Number(row[key]))||Number(row[key])<0||Number(row[key])>1))throw new Error('Taxa inválida: '+key+' em '+row.repository);
 }
 const out=path.resolve('data/entrega-isabella-s02');fs.mkdirSync(out,{recursive:true});
 const gold=path.resolve('data/gold-standard-final-300-2025');
 if(!fs.existsSync(path.join(gold,'gold_standard_sample.csv')))run(process.execPath,['scripts/sample-gold-standard.mjs','--job',id,'--n-repos','60','--n-releases','5','--seed','42','--require-comparisons','--out-dir',gold]);
 const copy=(source,target)=>{fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(source,target);};
 for(const name of ['dataset.csv','manifest.json','metrics-b.csv','metrics-c.csv'])copy(path.join(dataset,name),path.join(out,name));
 for(const name of ['repositories','metadata','decisions','funnel','queries'])copy(path.join(folder,'exports',name+'.csv'),path.join(out,'selecao',name+'.csv'));
 for(const name of ['gold_standard_sample.csv','rotulos-leandro.csv','rotulos-luis.csv','rotulos-isabella.csv','sampling-manifest.json'])copy(path.join(gold,name),path.join(out,'gold-standard',name));
 copy(path.join(folder,'comparison-quality.json'),path.join(out,'comparison-quality.json'));
 const doc='docs/INTEGRACAO-ISABELLA-S02.md';
 let instructions=fs.readFileSync(doc,'utf8');
 instructions=instructions.replaceAll('data/gold-standard-cohort-300-2025','data/gold-standard-final-300-2025');
 instructions=instructions.replace(/Os 100 selecionados anteriores foram preservados\.[^\n]*/,`Os 100 selecionados anteriores foram preservados. A coleta completa e os cálculos locais B/C estão concluídos para os 300 projetos. O dataset consolidado está em data/dataset-s02-final/dataset.csv e o pacote atualizado em data/entrega-isabella-s02.zip. Comece pela rotulação independente da nova amostra; depois gere o consenso e valide CFR (b). O pacote inclui métricas e documentação; os arquivos brutos volumosos continuam nas pastas persistentes de A.`);
 fs.writeFileSync(doc,instructions);
 const cDoc='docs/PARTE-C-S02.md',cText=fs.readFileSync(cDoc,'utf8');
 if(!cText.includes('**Coleta final de 300 projetos:**'))fs.writeFileSync(cDoc,cText.replace('\n\n',`\n\n**Coleta final de 300 projetos:** A, B e C foram concluídos sobre a janela ${a.start} a ${a.end}. Dataset local: data/dataset-s02-final/dataset.csv. Pacote para Isabella: data/entrega-isabella-s02.zip. A amostra final está em data/gold-standard-final-300-2025 e usa apenas releases com comparação disponível; os rótulos independentes e a validação F1 continuam pendentes. As medições piloto descritas abaixo são registros da etapa anterior.\n\n`));
 const readme='README.md',readmeText=fs.readFileSync(readme,'utf8');
 if(!readmeText.includes('<!-- entrega-isabella-s02 -->'))fs.writeFileSync(readme,readmeText+`\n\n<!-- entrega-isabella-s02 -->\n### Entrega local da Sprint 2\n\nColeta A e métricas B/C concluídas para 300 projetos, janela UTC ${a.start} a ${a.end}. Dataset: \`data/dataset-s02-final/dataset.csv\`. Pacote: \`data/entrega-isabella-s02.zip\`. Execute \`node scripts/consolidate-dataset.mjs ${id}\` para reproduzir a consolidação sem token. A validação de CFR (b) ainda depende dos rótulos independentes e consenso da amostra real.\n`);
 for(const name of ['DATA-DICTIONARY.md','PARTE-C-S02.md','INTEGRACAO-ISABELLA-S02.md','PARTE-AMOSTRA-OURO.md'])copy(path.resolve('docs',name),path.join(out,'documentacao',name));
 copy(path.resolve('docs/evidencias/cfr-b-reference-audit.csv'),path.join(out,'documentacao/evidencias/cfr-b-reference-audit.csv'));
 if(fs.existsSync('data/entrega-validation-tests.txt'))copy(path.resolve('data/entrega-validation-tests.txt'),path.join(out,'documentacao/tests.txt'));
 fs.writeFileSync(path.join(out,'README.md'),`# Entrega para Isabella — Sprint 2\n\n300 repositórios com coleta A e cálculos B/C completos. Janela UTC: ${a.start} a ${a.end}.\n\nComece por dataset.csv: uma linha por projeto, sem precisar de token para analisar as métricas. manifest.json identifica as bases persistentes. Os dados brutos e o cache permanecem em data/jobs e não expiram automaticamente.\n\n## O que ainda exige a equipe\n\nCada avaliador preenche seu template em gold-standard de forma independente. Depois gerem o consenso e validem CFR (b), seguindo documentacao/INTEGRACAO-ISABELLA-S02.md. A coluna cfr_b_validation está marcada pending_independent_labels; não declare F1 validado antes dessa etapa.\n\n## Explicação simples\n\nA caixa tem os dados dos 300 projetos. B e C já fizeram as contas. Agora cada pessoa precisa conferir as versões sorteadas e marcar seus próprios rótulos. Só depois comparamos essas respostas e verificamos se a regra automática acerta.\n`);
 const quality=JSON.parse(fs.readFileSync(path.join(folder,'comparison-quality.json'),'utf8'));
 fs.appendFileSync(path.join(out,'README.md'),`\n## Disponibilidade das comparações\n\n${quality.unavailable_comparisons} comparações permanecem indisponíveis e estão identificadas em comparison-quality.json. Essas releases não entram no lead time; os dados de workflows continuam disponíveis para C. Valores ausentes não são preenchidos com zero. A amostra-ouro final exclui comparações indisponíveis; sampling-manifest.json registra a população elegível para o sorteio.\n`);
 const files=[];function inventory(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())inventory(file);else files.push({path:path.relative(out,file).replaceAll('\\','/'),bytes:fs.statSync(file).size,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')});}}inventory(out);
 fs.writeFileSync(path.join(out,'checksums.json'),JSON.stringify(files,null,2));
 run('powershell.exe',['-NoProfile','-NonInteractive','-Command',"Compress-Archive -LiteralPath 'data/entrega-isabella-s02' -DestinationPath 'data/entrega-isabella-s02.zip' -Force"]);
 const result={status:'completed',rows:300,source_job_id:id,parts:JSON.parse(fs.readFileSync(partsFile,'utf8')),dataset:path.join(dataset,'dataset.csv'),package:path.resolve('data/entrega-isabella-s02.zip'),cfr_b_validation:'pending_independent_labels',completed_at:new Date().toISOString()};
 fs.writeFileSync(path.join(folder,'finalization.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}catch(error){fs.writeFileSync(path.join(folder,'finalization.json'),JSON.stringify({status:'failed',message:error.message,at:new Date().toISOString()},null,2));console.error(error.message);process.exitCode=1;}
