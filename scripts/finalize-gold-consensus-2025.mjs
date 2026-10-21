// Explicit delegated adjudication, frozen before classifier evaluation.
// Original rater labels are preserved. This is not independent human consensus.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseCSV,toCSV} from '../lib/csv.mjs';
import {runAgreement} from './calculate-agreement.mjs';

const folder='data/gold-standard-final-300-2025';
const read=f=>parseCSV(fs.readFileSync(f,'utf8'),{spreadsheetEscapes:true});
const hash=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const names=['leandro','luis','isabella'];
const sampleFile=path.join(folder,'gold_standard_sample.csv');
const sample=read(sampleFile),data=Object.fromEntries(names.map(n=>[n,read(path.join(folder,`rotulos-${n}.csv`))]));
const norm=s=>String(s??'').trim().toLowerCase().replace(/^nao$/,'não');
const refs=['repository','repo_url','release_tag','release_url','release_published_at'];
assert.equal(sample.length,300);
for(const name of names){
 assert.equal(data[name].length,sample.length);
 for(let i=0;i<sample.length;i++){
  for(const k of refs)assert.equal(data[name][i][k],sample[i][k],`${name}: reference ${i}/${k}`);
  assert.ok(['sim','não'].includes(norm(data[name][i].is_corrective)));
  assert.ok(['sim','não','incerto'].includes(norm(data[name][i].real_delivery)));
  assert.ok(['biblioteca/framework','ferramenta cli','aplicação/serviço','outro'].includes(norm(data[name][i].project_type)));
 }
 for(const repo of new Set(sample.map(r=>r.repository)))for(const field of ['project_type','real_delivery']){
  assert.equal(new Set(data[name].filter(r=>r.repository===repo).map(r=>norm(r[field]))).size,1,`${name}/${repo}: inconsistent ${field}`);
 }
}
const releaseDecisions=[
 ['typeorm/typeorm','0.3.25','sim','Notas enumeram correções de SQL, limites, relações, datas e desconexão; julgo predominância corretiva apesar de funcionalidades.'],
 ['TanStack/query','@tanstack/query-persist-client-core@5.91.10','sim','Única mudança é atualização de query-core 5.90.11, cuja nota no cache identifica correção de loop infinito; correção transitiva explícita.'],
 ['TanStack/query','@tanstack/solid-query@5.90.4','sim','Única mudança é atualização de query-core 5.90.3, cuja nota no cache corrige rejeição de promises na hidratação; correção transitiva explícita.'],
 ['run-llama/llama_index','v0.14.9','não','Release agrega novos modelos, provedores, integrações e alterações funcionais a correções; não identifico finalidade corretiva predominante do conjunto.'],
 ['rails/rails','v7.0.10','não','A referência a 7.0.9 não transfere suas correções para 7.0.10; os dois commits locais são publicação npm e preparação da versão.'],
 ['huggingface/pytorch-image-models','v1.0.14','sim','Nota afirma explicitamente que 1.0.14 foi publicada para distribuir o conserto de carregamento de pesos LeViT; prevalece a intenção declarada.'],
 ['moby/moby','docker-v29.1.0','sim','Página de release em cache destaca correções de resolv.conf, portas e reconexão; atualizações de empacotamento não afastam a predominância corretiva.'],
 ['react-hook-form/react-hook-form','v7.59.0','sim','Notas descrevem múltiplos defeitos de dados, envio e observação, com uma funcionalidade de comparação circular; julgo predominância corretiva.'],
 ['colinhacks/zod','v3.25.17','sim','Fix de wildcard de locale e distribuição de tipos CommonJS sustentam correção de resolução/publicação; classificação subjetiva de confiança baixa.'],
 ['Dokploy/dokploy','v0.17.7','sim','Correção da branch de preview remoto afeta o comportamento de deploy; demais mudanças atualizam templates e tradução. Predominância corretiva é julgamento de confiança baixa.'],
 ['bumptech/glide','v5.0.0-rc05','sim','Reversão de Compose e seção Bugs indicam estabilização de carregamento, AVIF e gainmaps. A condição RC é preservada como limitação da amostra, sem exclusão pós-hoc.'],
 ['bitcoin/bitcoin','v29.1','sim','Notas oficiais suplementares no cache declaram finalidade de bug fixes e performance, apesar de mudanças de política; prevalece intenção declarada de manutenção.'],
 ['bitcoin/bitcoin','v28.3','sim','Notas oficiais suplementares no cache declaram bug fixes e performance; mudanças de política são documentadas, sem suprimir finalidade de manutenção declarada.'],
 ['FuelLabs/fuel-core','v0.41.4','sim','Commit da própria release contém seção Fixed: Downgrade STF (#2628). O aviso sobre bug corrigido só em 0.41.6 não foi usado como evidência corretiva.']
];
const projectDecisions=[
 ['agno-agi/agno','real_delivery','sim','SDK instalável entrega capacidade utilizável por desenvolvedores; usuário inclui consumidor técnico da biblioteca.'],
 ['vitejs/vite','real_delivery','sim','Ferramenta npm/CLI de build utilizável por desenvolvedores; a release distribui a ferramenta, não apenas metadados de desenvolvimento.'],
 ['TanStack/query','real_delivery','sim','Pacotes versionados por framework são artefatos consumíveis pelos desenvolvedores, inclusive atualizações transitivas.'],
 ['moby/moby','real_delivery','incerto','A amostra mistura tags de engine e biblioteca cliente; mantém-se incerteza na dimensão agregada por repositório.'],
 ['oven-sh/bun','project_type','outro','Convenção de adjudicação: runtimes e interpretadores de linguagem ficam em outro; distribuição por executável não define finalidade principal como ferramenta CLI.'],
 ['php/php-src','project_type','outro','Mesma convenção para runtimes/interpretadores: outro; finalidade principal é executar a linguagem.'],
 ['nodejs/node','project_type','outro','Mesma convenção para runtimes/interpretadores: outro; comandos CLI são interface de um runtime.']
];
const decisions=new Map();
for(const [repo,tag,value,reason] of releaseDecisions)decisions.set(`${repo}\0${tag}\0is_corrective`,{value,reason});
for(const [repo,field,value,reason] of projectDecisions)decisions.set(`${repo}\0*\0${field}`,{value,reason});
const log=[],used=new Set();
function decide(r,i,field){
 const votes=Object.fromEntries(names.map(n=>[n,norm(data[n][i][field])])),unique=new Set(Object.values(votes));
 if(unique.size===1)return {value:Object.values(votes)[0],method:'unanimous',reason:'Três rótulos coincidem; origem comum de sugestões declarada.',votes};
 const key=`${r.repository}\0${field==='is_corrective'?r.release_tag:'*'}\0${field}`;
 assert.ok(decisions.has(key),`Missing explicit adjudication ${key}`);
 const d=decisions.get(key);used.add(key);
 if(!log.some(x=>x.key===key))log.push({key,repository:r.repository,release_tag:field==='is_corrective'?r.release_tag:'*',field,votes,decision:d.value,reason:d.reason,evidence:field==='is_corrective'?r.release_url:r.repo_url,adjudicator:'AI assistant, delegated by user on 2026-10-20',human_discussion_claimed:false});
 return {value:d.value,method:'delegated_ai_adjudication',reason:d.reason,votes};
}
const rows=sample.map((r,i)=>{
 const type=decide(r,i,'project_type'),delivery=decide(r,i,'real_delivery'),corrective=decide(r,i,'is_corrective');
 return {...Object.fromEntries(refs.map(k=>[k,r[k]])),consensus_project_type:type.value,type_agreement:type.method,consensus_real_delivery:delivery.value,delivery_agreement:delivery.method,consensus_is_corrective:corrective.value,corrective_agreement:corrective.method,luis_corrective:corrective.votes.luis,leandro_corrective:corrective.votes.leandro,isabella_corrective:corrective.votes.isabella,notes:`Consenso operacional por adjudicação de IA autorizada; não é teste humano independente. Tipo: ${type.reason} Entrega: ${delivery.reason} Corretiva: ${corrective.reason}`};
});
assert.equal(used.size,decisions.size,'Unused adjudications: sample/labels changed');
const agreement=runAgreement(folder,names);
agreement.methodological_limitations=['Luis reused the same AI proposals as Leandro; labels were reviewed/accepted as reported in conversation.','Fleiss kappa is descriptive for these assisted labels, not evidence of independent human reliability.','Agreement measured before adjudication; adjudication did not overwrite original votes.'];
fs.writeFileSync(path.join(folder,'agreement_report.json'),JSON.stringify(agreement,null,2)+'\n');
const consensus=path.join(folder,'consensus.csv');fs.writeFileSync(consensus,toCSV(rows,Object.keys(rows[0])));
fs.writeFileSync(path.join(folder,'adjudication-log.json'),JSON.stringify({date:'2026-10-20',protocol:'Evidence-based delegated AI adjudication; no automatic two-vote majority because of shared proposal origin.',sample_sha256:hash(sampleFile),rater_hashes:Object.fromEntries(names.map(n=>[n,hash(path.join(folder,`rotulos-${n}.csv`))])),consensus_sha256:hash(consensus),decisions:log},null,2)+'\n');
const nCorrective=rows.filter(r=>r.consensus_is_corrective==='sim').length;
const md=`# Consenso operacional — amostra final 2025\n\nData: 20/10/2026. Janela 01/01/2025–31/12/2025. Amostra: 60 projetos × 5 releases, semente 42.\n\n**300/300 referências conferidas.** ${nCorrective} corretivas, ${300-nCorrective} não corretivas.\n\n## Protocolo e limites\n\nO usuário autorizou o assistente a resolver divergências após conversar com o grupo. As decisões aqui são **adjudicação assistida por IA delegada**, não uma ata de discussão humana por item. Os rótulos originais foram preservados. Luis e Leandro partiram das mesmas sugestões de IA; portanto não se usou maioria de dois votos como evidência independente. Foram examinadas notas, commits e documentos oficiais previamente salvos, com justificativas em adjudication-log.json, sem consultar previsões/F1 para escolher respostas.\n\nHá 14 divergências corretivas e 7 decisões no nível de projeto (3 de tipo, 4 de entrega), correspondendo a 49 células divergentes no CSV. Os 286 rótulos corretivos unânimes foram mantidos. A convenção para runtimes foi explicitada como outro; entregas a desenvolvedores contam como uso real, preservando incerteza no caso heterogêneo de Moby. Essas escolhas subjetivas limitam a interpretação.\n\n## Concordância antes da adjudicação\n\n| Dimensão | N | Concordância observada | Kappa de Fleiss |\n|---|---:|---:|---:|\n${Object.entries(agreement.dimensions).map(([k,d])=>`| ${k} | ${d.subjectsCount} | ${(100*d.observedAgreement).toFixed(2)}% | ${d.kappa.toFixed(6)} |`).join('\n')}\n\nOs números descrevem avaliações assistidas com origem compartilhada, não confiabilidade humana independente. Precisão, recall e F1 devem ser apresentados como **calibração nesta referência operacional**, sem alegação de teste externo. A seleção da melhor heurística no mesmo consenso não mede generalização.\n\n## Reprodução\n\nExecute node scripts/calculate-agreement.mjs --data-dir data/gold-standard-final-300-2025, depois node scripts/finalize-gold-consensus-2025.mjs. O segundo passo registra decisões e limitações. Para avaliar, use scripts/calculate-cfr-b.mjs com o consenso desta pasta. Nenhum rótulo individual é reescrito.\n`;
fs.writeFileSync(path.join(folder,'consensus_summary.md'),md);
const report=path.join(folder,'agreement_report.md');
fs.writeFileSync(report,md.slice(0,md.indexOf('## Reprodução')).trimEnd()+'\n');
console.log(JSON.stringify({rows:rows.length,corrective:nCorrective,adjudications:log.length,consensus_sha256:hash(consensus)}));
