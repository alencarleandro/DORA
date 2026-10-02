import fs from 'node:fs';
import path from 'node:path';
import { DATA, create, load, execute, exportJob } from './lib/pipeline.mjs';
const args = Object.fromEntries(process.argv.slice(2).reduce((pairs,v,i,a) => v.startsWith('--') ? [...pairs,[v.slice(2),a[i+1]]] : pairs,[]));
try {
  if (!args.resume && !(args.csv && args.start && args.end)) throw new Error('Uso: npm run pipeline -- --csv examples/repositories.csv --start AAAA-MM-DD --end AAAA-MM-DD [--mode collect|import]\nRetomada: npm run pipeline -- --resume ID');
  const job = args.resume ? load(args.resume) : create({csv:fs.readFileSync(args.csv,'utf8'),start:args.start,end:args.end,mode:args.mode || 'collect'});
  const controller = new AbortController(); process.on('SIGINT',() => controller.abort());
  console.log(`Coleta ${job.id}`);
  let previous = '';
  await execute(job,{token:process.env.GITHUB_TOKEN || '',signal:controller.signal,onUpdate:j => { if (previous !== j.stage) { previous=j.stage; console.log(j.stage); } }});
  const exportsDir=path.join(DATA,'jobs',job.id,'exports');
  fs.mkdirSync(exportsDir,{recursive:true});
  for (const kind of ['metrics','runs','episodes','funnel']) fs.writeFileSync(path.join(exportsDir,`${kind}.csv`),exportJob(job,kind));
  console.log(`Status: ${job.status}. CSVs em ${exportsDir}`);
  if (job.status !== 'completed') process.exitCode=1;
} catch (error) { console.error(error.message); process.exitCode=1; }
