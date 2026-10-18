// Assisted draft judgments; never promote these to independent human labels automatically.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {parseCSV,toCSV} from '../lib/csv.mjs';
const folder='data/gold-standard-final-300-2025',out=path.join(folder,'revisao-leandro');
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const hash=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const sampleFile=path.join(folder,'gold_standard_sample.csv');
if(hash(sampleFile)!=='1b912e772066c477bdf8dc686a2e6afdf43bc4809026dd9daaa90cc869a3e686')throw new Error('Amostra mudou: revisar julgamentos antes de gerar rótulos.');
const rows=parseCSV(fs.readFileSync(sampleFile,'utf8'),{spreadsheetEscapes:true});
const types={L:'biblioteca/framework',C:'ferramenta CLI',A:'aplicação/serviço'};
// Explicit case judgments after inspecting source notes/changelogs. Five cases in sample order.
// '?' means unresolved evidence or no clearly dominant purpose; it is not a negative label.
const judgments=[
 ['C','NNNNN','Comandos, rede e armazenamento novos; ciclos de evolução do container.'],
 ['A','NYNNY','1.6.4 corrige inicialização; 1.6.2 corrige logs, exceções e paginação; 1.4.3 adiciona template NVIDIA.'],
 ['C','NYNNN','3.4.3 corrige proxy e empacotamento; demais notas destacam funcionalidades ou otimizações.'],
 ['L','NN?NN','Toolkits e integrações novos; 2.3.20 mistura correções de memória com melhorias e requer julgamento humano.'],
 ['L','YYNYN','6.16.2 e 6.17.1 corrigem regressões; 6.4.1 corrige pesquisa NPS; demais entregam recursos novos.'],
 ['L','NNNNN','Mudanças de APIs e funcionalidades de exchanges; correções coexistem com evolução funcional.'],
 ['C','NN?NN','Changelog por versão: novas opções/protocolos; 8.15.0 mistura remoção de suporte TLS com manutenção.'],
 ['A','NNNNN','Novos drivers, gestão de usuários, sessões, arquivos e opções de armazenamento.'],
 ['A','NNYYN','5.4.10 e 5.9.5 destacam correções de agendamento/integrações; demais misturam funcionalidades.'],
 ['L','N?Y?N','0.3.22 corrige transações e drivers; 0.3.26 e 0.3.21 misturam manutenção, segurança e mudanças de API.'],
 ['L','NNNNN','Ciclos amplos de renderização, deprecações, otimizações e recursos; não hotfixes específicos.'],
 ['C','YYYYY','Correções de segurança/servidor/templates; 7.2.6 reverte restrição de gerenciador de pacotes.'],
 ['L','NNYNN','1.7.2 resolve conexão; demais apresentam novos recursos junto com correções.'],
 ['L','N????','Devtools recebe tema; outras quatro releases apenas atualizam dependências, sem finalidade corretiva comprovada.'],
 ['L','NYYNN','1.1.9 corrige importação; 1.1.8 corrige lançamento/indexação; demais ampliam referências e isolamento.'],
 ['L','?YNN?','0.14.8 destaca correções do core; 0.14.10/0.12.12 trazem funcionalidades; versões mistas requerem revisão.'],
 ['C','??N?N','Blogs oficiais: 1.2.0 e 1.3.4 trazem APIs novas; demais misturam funcionalidades/velocidade e regressões.'],
 ['L','NNNYN','DataFrame corrige flicker; demais adicionam componentes, atualizam dependências ou só alteram documentação.'],
 ['A','YYYNN','11.9.2/11.13.2/11.9.3 corrigem bugs de interface/fluxos; 11.7.0/11.8.0 expandem recursos.'],
 ['L','NYNNN','2.8.2 corrige regressão de dimensões do produto; demais introduzem indexação, APIs ou limpeza de dependências.'],
 ['C','YYNYY','PHP declara versões de bug fix; 8.5.0 é lançamento de funcionalidades da linguagem.'],
 ['L','YYYNY','Manutenção das branches Rails; 7.0.10 muda publicação npm e não corrige o defeito referenciado em 7.0.9.'],
 ['L','NNYNN','1.0.19 corrige incompatibilidade Python 3.9; demais acrescentam modelos, pesos e APIs.'],
 ['L','NNNNN','Gateway/roteador recebe APIs, injeção de dependências, observabilidade e suporte a modelos.'],
 ['L','YYNNN','25.0.8 e 28.0.1 corrigem comportamento/regressão; demais introduzem comandos e negociação de API.'],
 ['C','?????','Snapshots semanais sem notas, com correções e funcionalidades; commits não demonstram intenção predominante.'],
 ['C','YYNYN','Patches corrigem versões anteriores, incluindo imagem sandbox; versões restantes trazem funcionalidades/nightly.'],
 ['L','NN?NN','CLI de componentes adiciona comandos/registries; 2.6.1 altera flag npm sem defeito específico explicado.'],
 ['C','NNYNN','0.0.71 corrige loop e checagens de agentes IDE; demais expandem templates, agentes ou devcontainer.'],
 ['L','NNNNN','Faiss adiciona algoritmos, índices, quantização e interfaces; não apenas correções.'],
 ['C','NNN?N','Croc adiciona arquitetura, clipboard e opções; 10.2.4 tem ajustes de CI/build sem efeito usuário comprovado.'],
 ['C','NNYNN','20.19.4 é security release CVE-2025-27210; demais trazem novos recursos da runtime.'],
 ['A','YYYYY','Logseq resolve regressões, congelamento, embeds, vulnerabilidade e comportamento da interface.'],
 ['A','NYNNN','4.0.11 corrige crash do menu de contexto; demais blogs descrevem novas funções e melhorias.'],
 ['L','NNN?Y','Mermaid adiciona diagramas/layouts; 11.10.1 corrige setas; ZenUML mistura dependências e compatibilidade.'],
 ['A','YNYNY','Halo corrige Console/inicialização/roteamento/miniaturas; outras versões destacam recursos e otimizações.'],
 ['A','NNNNN','SillyTavern expande backends, configurações e interface; manutenção também ocorre, sem intenção única corretiva.'],
 ['A','NNNNN','AIRI adiciona UI, modelos, serviços e integrações; alerta de perda de dados não prova hotfix.'],
 ['C','NNN?N','Opencode altera prompts/clipboard/navegação; 1.0.24 divide notas entre três correções e três adições.'],
 ['L','Y??NY','Fastify security releases são corretivas; 5.2.1/5.2.2 misturam build/testes/performance e correções.'],
 ['A','NNNNN','Servidor MCP adiciona ferramentas, prompts, handlers e troca SDK.'],
 ['A','YY?NN','PDF 1.0.1 corrige flag Docker; 2.0.2 declara hotfix; 2.1.4 mistura três bugs e três recursos.'],
 ['L','NY?NY','Zustand 5.0.4 corrige React Native; 5.0.8 corrige shallow; 4.5.7 só referencia comentário externo.'],
 ['L','?YY?Y','RHF 7.59.0/7.66.1 predominam correções; 7.69.0 inclui CVEs; versões com novos tipos/hooks são ambíguas.'],
 ['A','?YNNY','Plane 0.25.1 declara quick patch; 0.27.1 lista bugs; 0.25.2 combina features, segurança e defeitos.'],
 ['L','?NYNN','Zod 4.0.8 corrige issue 4961; outras versões melhoram build, tree-shaking, inferência ou locales.'],
 ['L','YYYYY','Spring Boot lista falhas de execução, vazamentos, regressões Docker e compatibilidade nas versões.'],
 ['A','NNNNY','OpenClaw expande heartbeat, ferramentas e sessões; beta4 corrige módulos ausentes no tarball npm.'],
 ['A','NNNNN','Firecrawl amplia extração, scraping, concorrência e MCP.'],
 ['A','NNYNY','Dokploy 0.18.1 corrige comando ausente; 0.21.6 corrige perfil/variáveis/preview; demais expandem recursos.'],
 ['L','NNNYN','YOLO 8.3.202 corrige quantização INT8; demais acrescentam exportações, avaliação e funcionalidades.'],
 ['L','??NNY','Remotion 4.0.355 corrige crash FFmpeg; duas versões misturam correções com APIs/componentes novos.'],
 ['A','?YYYY','Branches Mastodon recebem correções/segurança; 4.1.25 mistura paginação nova com cache e aviso de vulnerabilidade.'],
 ['L','?YY?Y','Glide 5.0.2/3/4 corrigem artefatos ausentes; 5.0.1 admite que não resolve bug; rc05 mistura build/reverts/correções.'],
 ['A','YN?YY','Bitcoin 29.1/28.3/29.2 declaram bug fixes; 30.0 traz features; 28.1 mistura features e correções.'],
 ['A','YYYNN','Airflow 3.0.3/3.1.3/3.1.1 corrigem execução/scheduler; chart e 3.1.0 são evolução funcional.'],
 ['A','?NNNN','V2rayNG mistura núcleo, opções e UI; 1.10.7 corrige bugs mas também muda testes de latência.'],
 ['C','NYNNN','Codex 0.21.0 declara Fixes abound; demais incluem novos comandos, protocolo e mudanças de comportamento.'],
 ['C','NNYNY','Yazi 25.2.11 declara quick fix da versão anterior; 25.5.31 é manutenção; demais adicionam recursos.'],
 ['A','Y?YYN','Fuel corrige memória/migração/dependência; 0.41.4 só publica versão com aviso de bug ainda existente; 0.40.3 adiciona stats.'],
];
if(rows.length!==300||judgments.length!==60)throw new Error('Amostra esperada: 60 × 5.');
fs.mkdirSync(out,{recursive:true});
const repos=[...new Set(rows.map(r=>r.repository))];
const repoDelivery=new Map();
for(const name of repos){
 const repo=read('data/issue-5-evidence/'+name.replace('/','__')+'.repo.json');
 const installation=/install|download|npm |pip |cargo |docker |brew |安装|下载/i.test(repo.readme);
 const published=rows.filter(r=>r.repository===name).some(r=>{
  const key=createHash('sha256').update(r.repository+'\0'+r.release_tag).digest('hex').slice(0,20);
  const source=read('data/issue-5-evidence/'+key+'.json');
  return source.assets.length||/install|download|npm |pip |PyPI|Docker Image|下载/i.test(source.notes);
 });
 repoDelivery.set(name,installation||published?'sim':'incerto');
}
const official=path.join(folder,'rotulos-leandro.csv');const protectedFiles=[official,path.join(folder,'rotulos-luis.csv'),path.join(folder,'rotulos-isabella.csv')];
const before=Object.fromEntries(protectedFiles.map(f=>[f,hash(f)]));
const evidence=[],draft=[],decisions=[];
for(const [i,r] of rows.entries()){
 const ri=repos.indexOf(r.repository),[type,pattern,rationale]=judgments[ri];
 if(pattern.length!==5||!types[type])throw new Error('Julgamento inválido');
 const localIndex=rows.slice(0,i).filter(x=>x.repository===r.repository).length;
 const verdict=pattern[localIndex];
 const key=createHash('sha256').update(r.repository+'\0'+r.release_tag).digest('hex').slice(0,20);
 const source=read('data/issue-5-evidence/'+key+'.json');
 const repo=read('data/issue-5-evidence/'+r.repository.replace('/','__')+'.repo.json');
 if(source.status!==200||repo.status!==200)throw new Error('Fonte indisponível: '+r.repository);
 const raw=read('data/jobs/1deaa513-2c06-4949-bd54-2c591b0eef12/'+encodeURIComponent(r.repository)+'.releases.json');
 const release=raw.releases.find(x=>x.tag_name===r.release_tag&&x.published_at===r.release_published_at);
 if(!release||release.compare_error)throw new Error('Referência de release inválida');
 // Record installation evidence without treating a repository name or semver patch as proof.
 const install=repo.readme.split('\n').filter(x=>/install|download|npm |pip |cargo |docker |brew |安装|下载/i.test(x)).slice(0,3).join(' | ').slice(0,220);
 const delivery=repoDelivery.get(r.repository);
 const is_corrective=verdict==='Y'?'sim':verdict==='N'?'não':'';
 const priority=verdict==='?'||delivery==='incerto'?'alta':'normal';
 const state=verdict==='?'?'evidencia_ambigua':'sugestao_ia';
 draft.push({repository:r.repository,repo_url:r.repo_url,release_tag:r.release_tag,release_url:r.release_url,release_published_at:r.release_published_at,project_type:types[type],real_delivery:delivery,is_corrective,notes:`IA assistida; revisão humana pendente. ${rationale} Caso ${localIndex+1}/5. Evidência: ${r.release_url}. ${verdict==='?'?'Não decidir sem rever a fonte; vazio não significa não.':''}`});
 evidence.push({repository:r.repository,release_tag:r.release_tag,release_url:r.release_url,source_url:source.url,retrieved_at:source.retrieved_at,html_sha256:source.html_sha256,repo_source_url:repo.url,repo_html_sha256:repo.html_sha256,notes_excerpt:source.notes.replace(/\s+/g,' ').slice(0,330),supplement_url:source.supplemental?.url||'',supplement_status:source.supplemental?.status||'',supplement_sha256:source.supplemental?.sha256||'',base_tag:release.base_tag,commits_total:release.commits.length,commit_urls:release.commits.slice(0,3).map(c=>`${r.repo_url}/commit/${c.sha}`).join(' | '),delivery_evidence:localIndex===0?install:'Ver primeira release deste repositório',status:state,review_priority:priority});
 decisions.push({repository:r.repository,release_tag:r.release_tag,project_type:types[type],real_delivery:delivery,is_corrective,reason:rationale,status:state,review_priority:priority,human_reviewed:false});
}
const headers=['repository','repo_url','release_tag','release_url','release_published_at','project_type','real_delivery','is_corrective','notes'];
fs.writeFileSync(path.join(out,'rotulos-leandro-assistidos.csv'),toCSV(draft,headers));
fs.writeFileSync(path.join(out,'evidencias-leandro.csv'),toCSV(evidence,Object.keys(evidence[0])));
fs.writeFileSync(path.join(out,'decisoes.json'),JSON.stringify(decisions,null,2));
for(const f of protectedFiles)if(hash(f)!==before[f])throw new Error('Planilha oficial alterada: '+f);
const summary={rater:'leandro',method:'AI-assisted source review; NOT independent human annotation',human_review_status:'pending',generated_at:new Date().toISOString(),sample_sha256:hash(sampleFile),source_job_id:'1deaa513-2c06-4949-bd54-2c591b0eef12',rows:draft.length,repositories:repos.length,corrective_yes:draft.filter(x=>x.is_corrective==='sim').length,corrective_no:draft.filter(x=>x.is_corrective==='não').length,corrective_unresolved:draft.filter(x=>!x.is_corrective).length,delivery_uncertain:draft.filter(x=>x.real_delivery==='incerto').length,protected_files_sha256:before,limitations:['Drafts are not inputs for agreement/consensus.','Read current repository READMEs; historical project purpose requires human confirmation.','Did not read other raters classification CSVs or call CFR classification/prediction code for these judgments.','Prior conversation included heuristic descriptions; strict assessor blinding is not established.','Quoted evidence is brief; inspect linked full notes and changelogs before accepting.','Mixed-purpose, dependency-only and CI-only cases remain unresolved rather than defaulting to no.']};
fs.writeFileSync(path.join(out,'revisao-leandro.json'),JSON.stringify(summary,null,2));
const {resolveAmbiguities}=await import('./resolve-leandro-ambiguities.mjs');
console.log(JSON.stringify(resolveAmbiguities(),null,2));
