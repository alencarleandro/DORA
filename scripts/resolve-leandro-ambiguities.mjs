// Subjective AI-assisted judgments requested by Leandro. Not human consensus.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {parseCSV,toCSV} from '../lib/csv.mjs';

const judgments=[
 ['agno-agi/agno','v2.3.20','sim','media','Quatro correções de retries, migração/memória, datas e ordenação sustentam manutenção de confiabilidade, apesar de duas melhorias.'],
 ['curl/curl','curl-8_15_0','não','baixa','Changelog da versão mistura retirada de suporte TLS e manutenção ampla; não há indicação de hotfix ou defeito recente predominante.'],
 ['typeorm/typeorm','0.3.26','não','baixa','Inclui proteção MySQL, mas também substituição do pool SAP e suporte a novos tipos; julgo atualização funcional mista.'],
 ['typeorm/typeorm','0.3.21','não','baixa','Publicação reúne dependências, mudanças de distribuição, CI e manutenção; não reconheço uma finalidade corretiva predominante.'],
 ['TanStack/query','@tanstack/query-persist-client-core@5.91.10','não','baixa','Notas apenas atualizam query-core. Não há explicação de defeito corrigido neste pacote; decisão conservadora, não prova de ausência de correção.'],
 ['TanStack/query','@tanstack/solid-query@5.90.4','não','baixa','Notas apenas atualizam query-core. Não deduzo finalidade corretiva a partir da versão da dependência.'],
 ['TanStack/query','@tanstack/react-query-persist-client@5.90.14','não','baixa','Somente atualização de dependências publicada; finalidade corretiva do pacote sorteado não está demonstrada nas notas.'],
 ['TanStack/query','@tanstack/svelte-query-persist-client@6.0.12','não','baixa','Somente atualização de dependências; julgo sincronização de pacotes, com possível correção indireta não comprovada.'],
 ['run-llama/llama_index','v0.14.9','sim','baixa','Notas enfatizam consistência de contexto/memória e compatibilidade de dependências, embora também tragam integração/modelo novos.'],
 ['run-llama/llama_index','v0.13.5','não','baixa','Novos campos de streaming, cache de prompt e chat store dividem protagonismo com correções; julgo release funcional mista.'],
 ['oven-sh/bun','bun-v1.2.4','sim','media','Blog identifica regressões de Hono e bun init, travamento de stdin e falhas de Buffer/Socket; essas correções justificam o rótulo apesar de codesigning/performance.'],
 ['oven-sh/bun','bun-v1.2.15','não','media','bun audit, bun pm view e implementação de APIs Node são novos recursos destacados; onze correções coexistem com esse lançamento funcional.'],
 ['oven-sh/bun','bun-v1.3.1','não','baixa','Blog destaca velocidade de build, sourcemaps e comportamento CommonJS; julgo evolução da ferramenta, não hotfix predominante.'],
 ['vlang/v','weekly.2025.21','não','baixa','Snapshot semanal combina debugger OpenBSD, term e ferramentas com correções de compilador; não há propósito corretivo exclusivo ou predominante claro.'],
 ['vlang/v','weekly.2025.06','não','baixa','Snapshot adiciona disk_usage e ferramenta reduce junto de correções de parser/cgen; julgo manutenção e evolução contínuas.'],
 ['vlang/v','weekly.2025.47','não','baixa','Commits misturam exemplos, avisos do parser, instrumentação e correções; ausência de notas limita a confiança sobre finalidade principal.'],
 ['vlang/v','weekly.2025.09','não','baixa','Suporte a literais negativos e helpers atoi coexistem com ajustes do checker; julgo evolução semanal mista.'],
 ['vlang/v','weekly.2025.1','não','baixa','Ferramentas novas e otimizações coexistem com correções do checker/cgen; julgo snapshot evolutivo, com baixa confiança.'],
 ['shadcn-ui/ui','shadcn@2.6.1','sim','baixa','Nota específica altera flag npm; interpreto como ajuste de compatibilidade da instalação, mas não há descrição explícita do defeito.'],
 ['schollz/croc','v10.2.4','sim','baixa','Comparação local repete correções de build até a publicação; interpreto reparo de distribuição, embora o efeito final ao usuário exija revisão.'],
 ['mermaid-js/mermaid','@mermaid-js/mermaid-zenuml@0.2.1','sim','media','Há correção explícita da faixa de peerDependencies para Mermaid v10/v11, associada à compatibilidade do pacote.'],
 ['anomalyco/opencode','v1.0.24','sim','baixa','Notas iniciam com abort de sessão, erro de imagem e ESC sem resposta; julgo estabilidade prioritária apesar das três funcionalidades adicionadas.'],
 ['fastify/fastify','v5.2.1','sim','media','O reparo de crash em ReadableStream.locked é a mudança funcional destacável; grande parte do restante é teste/documentação.'],
 ['fastify/fastify','v5.2.2','sim','media','Ajusta verificação de payload no parser JSON; demais entradas são em grande parte testes, build e manutenção.'],
 ['Stirling-Tools/Stirling-PDF','v2.1.4','sim','baixa','Notas abrem com SAML, carregamento wasm e erro de cache do editor; julgo correção prioritária, mas há funcionalidades novas relevantes.'],
 ['pmndrs/zustand','4.5.7','sim','baixa','A release remete ao PR 3087, o mesmo da correção React Native descrita na versão 5.0.4; inferência de backport, não verificação do diff completo da branch 4.x.'],
 ['react-hook-form/react-hook-form','v7.66.0','não','baixa','Novo comportamento de useWatch/useController para mudança de nome recebe destaque; duas correções coexistem, portanto julgo finalidade mista funcional.'],
 ['react-hook-form/react-hook-form','v7.58.0','não','baixa','Novos tipos, tratamento de caminhos e geração de IDs dividem a release com reparos de useFieldArray; julgo evolução funcional.'],
 ['makeplane/plane','v0.25.2','não','baixa','Melhorias de interface, idiomas e configuração HTTPS são o primeiro bloco; correções e atualização de segurança coexistem sem propósito único claro.'],
 ['colinhacks/zod','v3.25.17','sim','baixa','Fix de locale wildcard e publicação dos tipos CommonJS sugerem correção de resolução/distribuição; descrição do impacto é limitada.'],
 ['remotion-dev/remotion','v4.0.378','sim','baixa','Erros durante render e transformação CSS são corrigidos; predominância de confiabilidade é minha interpretação, com novo Textarea também presente.'],
 ['remotion-dev/remotion','v4.0.329','não','baixa','Inclui mudança incompatível de rotação e nova API getPartialAudioData além de correções; julgo release ampla de evolução.'],
 ['mastodon/mastodon','v4.1.25','não','baixa','Changelog adiciona paginação e corrige cache; o aviso SAML recomenda outra branch e não é uma correção desta release. Julgo manutenção mista.'],
 ['bumptech/glide','v5.0.1','não','baixa','Notas declaram que módulos ausentes não foram corrigidos e apontam próxima versão. Não conto o aviso como evidência de correção entregue.'],
 ['bumptech/glide','v5.0.0-rc05','sim','baixa','Reverte mudanças Compose e corrige AVIF/gainmaps e carregamento; julgo estabilização, embora atualize toolchain e seja candidata a release.'],
 ['bitcoin/bitcoin','v28.1','sim','baixa','Release de manutenção da branch 28 com correções e desempenho; cabeçalho também menciona novos recursos, portanto confiança baixa na finalidade predominante.'],
 ['2dust/v2rayNG','1.10.7','sim','media','Notas chinesas citam correções de problemas conhecidos com referências específicas; otimização do teste de latência é secundária nesta leitura.'],
 ['FuelLabs/fuel-core','v0.41.4','não','media','Notas registram publicação e um defeito corrigido apenas em 0.41.6; não atribuo a esta release a correção posterior.'],
];

export function resolveAmbiguities(){
 const folder='data/gold-standard-final-300-2025',out=path.join(folder,'revisao-leandro');
 const read=f=>parseCSV(fs.readFileSync(f,'utf8'),{spreadsheetEscapes:true});
 const hash=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
 const sampleFile=path.join(folder,'gold_standard_sample.csv');
 if(hash(sampleFile)!=='1b912e772066c477bdf8dc686a2e6afdf43bc4809026dd9daaa90cc869a3e686')throw new Error('Amostra mudou.');
 const protectedFiles=['rotulos-leandro.csv','rotulos-luis.csv','rotulos-isabella.csv'].map(f=>path.join(folder,f));
 const before=Object.fromEntries(protectedFiles.map(f=>[f,hash(f)]));
 const draftFile=path.join(out,'rotulos-leandro-assistidos.csv'),draft=read(draftFile),evidence=read(path.join(out,'evidencias-leandro.csv'));
 const decisions=JSON.parse(fs.readFileSync(path.join(out,'decisoes.json')));
 const sample=read(sampleFile),key=r=>r.repository+'\0'+r.release_tag;
 if(judgments.length!==38||draft.length!==300||new Set(judgments.map(r=>r[0]+'\0'+r[1])).size!==38)throw new Error('Resoluções esperadas: 38, sem duplicatas.');
 const resolved=judgments.map(([repository,release_tag,label,confidence,reason])=>{
  const match=r=>key(r)===repository+'\0'+release_tag;
  const row=draft.find(match),decision=decisions.find(match),ev=evidence.find(match),reference=sample.find(match);
  if(!row||!decision||!ev||!reference||row.release_published_at!==reference.release_published_at)throw new Error('Referência divergente: '+release_tag);
  if(row.is_corrective&&!decision.ai_resolved_from_ambiguous)throw new Error('Tentativa de alterar rótulo anteriormente decidido: '+release_tag);
  row.is_corrective=label;row.notes=`Proposta de IA; revisão humana pendente. Confiança ${confidence}. Julgamento subjetivo autorizado pelo usuário, sem consenso. ${reason} Fonte: ${row.release_url}`;
  Object.assign(decision,{is_corrective:label,reason,status:'sugestao_ia_ambiguidade_resolvida',confidence,review_priority:'alta',human_reviewed:false,ai_resolved_from_ambiguous:true});
  Object.assign(ev,{status:decision.status,confidence,review_priority:'alta',resolution_reason:reason});
  return {repository,release_tag,release_published_at:reference.release_published_at,label,confidence,reason,source:reference.release_url,originally_unresolved:true,human_reviewed:false};
 });
 if(draft.some(r=>!['sim','não'].includes(r.is_corrective)))throw new Error('Ainda há rótulos sem decisão.');
 fs.writeFileSync(draftFile,toCSV(draft,Object.keys(draft[0])));
 fs.writeFileSync(path.join(out,'evidencias-leandro.csv'),toCSV(evidence,[...new Set(evidence.flatMap(Object.keys))]));
 fs.writeFileSync(path.join(out,'decisoes.json'),JSON.stringify(decisions,null,2)+'\n');
 fs.writeFileSync(path.join(out,'resolucoes-assistidas.json'),JSON.stringify({method:'AI-assisted subjective judgments; not independent human labels or consensus',authorization:'User requested use of assistant judgment for unresolved cases',sample_sha256:hash(sampleFile),resolved},null,2)+'\n');
 const file=path.join(out,'revisao-leandro.json'),summary=JSON.parse(fs.readFileSync(file));
 Object.assign(summary,{corrective_yes:draft.filter(r=>r.is_corrective==='sim').length,corrective_no:draft.filter(r=>r.is_corrective==='não').length,corrective_unresolved:0,ai_resolved_ambiguous:38,human_review_status:'pending',resolved_low_confidence:resolved.filter(r=>r.confidence==='baixa').length,method:'AI-assisted source review with subjective tie decisions; NOT independent human annotation'});
 summary.limitations=[...new Set([...summary.limitations.filter(x=>!x.startsWith('Mixed-purpose')),'38 initially ambiguous cases were assigned subjective AI labels on user request, with low/medium confidence; this is not human review or consensus.'])];
 fs.writeFileSync(file,JSON.stringify(summary,null,2)+'\n');
 for(const f of protectedFiles)if(hash(f)!==before[f])throw new Error('Arquivo oficial alterado: '+f);
 return {rows:300,yes:summary.corrective_yes,no:summary.corrective_no,resolved:38,low_confidence:summary.resolved_low_confidence,human_review:'pending',official_files_preserved:true};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)console.log(JSON.stringify(resolveAmbiguities(),null,2));
