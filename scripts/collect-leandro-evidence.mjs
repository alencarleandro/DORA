// Collect public source evidence without reading any other rater's labels.
import fs from 'node:fs';
const source=fs.readFileSync(new URL('./collect-label-evidence.mjs',import.meta.url),'utf8');
// Reuse the public HTML parser; keep Leandro's evidence separate from Isabella's.
await import('data:text/javascript;base64,'+Buffer.from(source.replace("const root='data/issue-6-evidence'","const root='data/issue-5-evidence'").replace("from '../lib/csv.mjs'",`from '${new URL('../lib/csv.mjs',import.meta.url).href}'`)).toString('base64'));
