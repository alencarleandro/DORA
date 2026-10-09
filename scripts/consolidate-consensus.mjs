import fs from 'node:fs';
import path from 'node:path';
import { parseCSV, toCSV } from '../lib/csv.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, v, i, a) => (v.startsWith('--') ? [...acc, [v.slice(2), a[i + 1]]] : acc), [])
);

const DATA_DIR = path.resolve(args['data-dir'] || 'data/gold-standard');
const RATERS = (args.raters || 'luis,leandro,isabella').split(',').map(s => s.trim());

function resolveConsensus(votes, tieBreakerPriority = ['biblioteca/framework', 'ferramenta CLI', 'aplicação/serviço', 'outro']) {
  const counts = {};
  for (const v of Object.values(votes)) {
    const val = (v || '').trim().toLowerCase();
    counts[val] = (counts[val] || 0) + 1;
  }

  // Verifica se há maioria (3 ou 2 votos)
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (sorted[0][1] >= 2) {
    return {
      consensus: sorted[0][0],
      agreementType: sorted[0][1] === 3 ? 'unanimous' : 'majority',
      votes
    };
  }

  // Empate 1-1-1
  // Resolução conforme protocolo de desempate documentado
  for (const p of tieBreakerPriority) {
    if (counts[p]) {
      return {
        consensus: p,
        agreementType: 'reconciled_tiebreaker',
        votes,
        note: `Empate 1-1-1 resolvido por critério de finalidade preponderante (${p})`
      };
    }
  }

  return {
    consensus: sorted[0][0],
    agreementType: 'reconciled',
    votes
  };
}

export function consolidateConsensus(dataDir = DATA_DIR, raters = RATERS) {
  const raterData = {};
  for (const rater of raters) {
    const filePath = path.join(dataDir, `rotulos-${rater}.csv`);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Arquivo do avaliador não encontrado: ${filePath}`);
    }
    raterData[rater] = parseCSV(fs.readFileSync(filePath, 'utf8'));
  }

  const firstRater = raters[0];
  const rows = raterData[firstRater];

  // Mapas para repositórios
  const repoConsensusMap = new Map();

  for (let idx = 0; idx < rows.length; idx++) {
    const repo = rows[idx].repository;
    if (!repoConsensusMap.has(repo)) {
      const typeVotes = {};
      const deliveryVotes = {};
      for (const r of raters) {
        const raterRow = raterData[r].find(item => item.repository === repo);
        typeVotes[r] = (raterRow?.project_type || '').trim().toLowerCase();
        deliveryVotes[r] = (raterRow?.real_delivery || '').trim().toLowerCase();
      }
      const typeRes = resolveConsensus(typeVotes);
      const deliveryRes = resolveConsensus(deliveryVotes, ['sim', 'incerto', 'não']);
      repoConsensusMap.set(repo, {
        typeRes,
        deliveryRes
      });
    }
  }

  // Consolidação linha a linha de releases
  const consensusRows = [];
  let statsUnanimousReleases = 0;
  let statsMajorityReleases = 0;

  for (let idx = 0; idx < rows.length; idx++) {
    const baseRow = rows[idx];
    const repo = baseRow.repository;
    const repoConsensus = repoConsensusMap.get(repo);

    const correctiveVotes = {};
    for (const r of raters) {
      correctiveVotes[r] = (raterData[r][idx]?.is_corrective || '').trim().toLowerCase();
    }

    const correctiveRes = resolveConsensus(correctiveVotes, ['sim', 'não']);
    if (correctiveRes.agreementType === 'unanimous') statsUnanimousReleases++;
    else statsMajorityReleases++;

    consensusRows.push({
      repository: repo,
      repo_url: baseRow.repo_url,
      release_tag: baseRow.release_tag,
      release_url: baseRow.release_url,
      release_published_at: baseRow.release_published_at,
      consensus_project_type: repoConsensus.typeRes.consensus,
      type_agreement: repoConsensus.typeRes.agreementType,
      consensus_real_delivery: repoConsensus.deliveryRes.consensus,
      delivery_agreement: repoConsensus.deliveryRes.agreementType,
      consensus_is_corrective: correctiveRes.consensus,
      corrective_agreement: correctiveRes.agreementType,
      luis_corrective: correctiveVotes.luis || '',
      leandro_corrective: correctiveVotes.leandro || '',
      isabella_corrective: correctiveVotes.isabella || '',
      notes: correctiveRes.note || repoConsensus.typeRes.note || ''
    });
  }

  const headers = [
    'repository',
    'repo_url',
    'release_tag',
    'release_url',
    'release_published_at',
    'consensus_project_type',
    'type_agreement',
    'consensus_real_delivery',
    'delivery_agreement',
    'consensus_is_corrective',
    'corrective_agreement',
    'luis_corrective',
    'leandro_corrective',
    'isabella_corrective',
    'notes'
  ];

  const consensusCsvPath = path.join(dataDir, 'consensus.csv');
  fs.writeFileSync(consensusCsvPath, toCSV(consensusRows, headers), 'utf8');

  // Resumo estatístico
  const totalRepos = repoConsensusMap.size;
  const totalReleases = consensusRows.length;
  const totalCorrective = consensusRows.filter(r => r.consensus_is_corrective === 'sim').length;

  const typeCounts = {};
  const deliveryCounts = {};
  for (const info of repoConsensusMap.values()) {
    typeCounts[info.typeRes.consensus] = (typeCounts[info.typeRes.consensus] || 0) + 1;
    deliveryCounts[info.deliveryRes.consensus] = (deliveryCounts[info.deliveryRes.consensus] || 0) + 1;
  }

  const summaryMd = `# Consolidação do Consenso da Amostra-Ouro

Data de geração: ${new Date().toISOString()}  
Total de repositórios: **${totalRepos}**  
Total de releases avaliadas: **${totalReleases}**  
Releases consensualmente corretivas: **${totalCorrective}** (${((totalCorrective / totalReleases) * 100).toFixed(1)}%)

---

## 1. Distribuição de Tipos de Projeto (RQ 06)
${Object.entries(typeCounts).map(([type, cnt]) => `- **${type}:** ${cnt} repositórios (${((cnt / totalRepos) * 100).toFixed(1)}%)`).join('\n')}

---

## 2. Entregas Reais ao Usuário
${Object.entries(deliveryCounts).map(([ans, cnt]) => `- **${ans}:** ${cnt} repositórios (${((cnt / totalRepos) * 100).toFixed(1)}%)`).join('\n')}

---

## 3. Nível de Concordância em Releases Corretivas
- **Unânime (3 avaliadores iguais):** ${statsUnanimousReleases} releases (${((statsUnanimousReleases / totalReleases) * 100).toFixed(1)}%)
- **Maioria (2 contra 1):** ${statsMajorityReleases} releases (${((statsMajorityReleases / totalReleases) * 100).toFixed(1)}%)

Arquivo final gerado: \`data/gold-standard/consensus.csv\` (pronto para consumo pela Issue #5 - Leandro para avaliação da heurística automática).
`;

  fs.writeFileSync(path.join(dataDir, 'consensus_summary.md'), summaryMd, 'utf8');

  return {
    totalRepos,
    totalReleases,
    totalCorrective,
    statsUnanimousReleases,
    statsMajorityReleases,
    typeCounts,
    deliveryCounts
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve('scripts/consolidate-consensus.mjs')) {
  try {
    const summary = consolidateConsensus(DATA_DIR, RATERS);
    console.log(`\n=== Consenso Consolidado com Sucesso ===`);
    console.log(`Repositórios consolidados: ${summary.totalRepos}`);
    console.log(`Releases consolidadas:     ${summary.totalReleases}`);
    console.log(`Releases corretivas (sim):  ${summary.totalCorrective} (${((summary.totalCorrective / summary.totalReleases) * 100).toFixed(1)}%)`);
    console.log(`Concordância em releases:   ${summary.statsUnanimousReleases} unânimes, ${summary.statsMajorityReleases} maioria`);
    console.log(`Arquivos gerados em:`);
    console.log(`- ${path.join(DATA_DIR, 'consensus.csv')}`);
    console.log(`- ${path.join(DATA_DIR, 'consensus_summary.md')}\n`);
  } catch (err) {
    console.error(`Erro na consolidação do consenso:`, err.message);
    process.exitCode = 1;
  }
}
