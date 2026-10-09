import fs from 'node:fs';
import path from 'node:path';
import { parseCSV } from '../lib/csv.mjs';
import { calculateDimensionAgreement } from '../lib/agreement.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, v, i, a) => (v.startsWith('--') ? [...acc, [v.slice(2), a[i + 1]]] : acc), [])
);

const DATA_DIR = path.resolve(args['data-dir'] || 'data/gold-standard');
const RATERS = (args.raters || 'luis,leandro,isabella').split(',').map(s => s.trim());

const EXPECTED_PROJECT_TYPES = ['biblioteca/framework', 'aplicação/serviço', 'ferramenta cli', 'outro'];
const EXPECTED_DELIVERIES = ['sim', 'não', 'incerto'];
const EXPECTED_CORRECTIVE = ['sim', 'não'];

function loadRaterFiles(dataDir, raters) {
  const raterData = {};
  for (const rater of raters) {
    const filePath = path.join(dataDir, `rotulos-${rater}.csv`);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Arquivo do avaliador não encontrado: ${filePath}`);
    }
    const rows = parseCSV(fs.readFileSync(filePath, 'utf8'));
    raterData[rater] = rows;
  }
  return raterData;
}

function buildDimensionItems(raterData, raters) {
  const firstRater = raters[0];
  const rows = raterData[firstRater];

  // Agrupa por repositório (para project_type e real_delivery)
  const repoItemsMap = new Map();
  const releaseItems = [];

  const norm = str => {
    let s = (str || '').trim().toLowerCase();
    if (s === 'nao') s = 'não';
    return s;
  };

  for (let idx = 0; idx < rows.length; idx++) {
    const baseRow = rows[idx];
    const repo = baseRow.repository;
    const releaseKey = `${repo}@${baseRow.release_tag}`;

    // Nível do repositório
    if (!repoItemsMap.has(repo)) {
      const typeRatings = {};
      const deliveryRatings = {};
      for (const rater of raters) {
        const raterRow = raterData[rater].find(r => r.repository === repo);
        typeRatings[rater] = norm(raterRow?.project_type);
        deliveryRatings[rater] = norm(raterRow?.real_delivery);
      }
      repoItemsMap.set(repo, {
        subjectId: repo,
        typeRatings,
        deliveryRatings
      });
    }

    // Nível da release
    const correctiveRatings = {};
    for (const rater of raters) {
      const raterRow = raterData[rater][idx];
      correctiveRatings[rater] = norm(raterRow?.is_corrective);
    }
    releaseItems.push({
      subjectId: releaseKey,
      repository: repo,
      release_tag: baseRow.release_tag,
      raters: correctiveRatings
    });
  }

  const projectTypeItems = Array.from(repoItemsMap.values()).map(v => ({
    subjectId: v.subjectId,
    raters: v.typeRatings
  }));

  const realDeliveryItems = Array.from(repoItemsMap.values()).map(v => ({
    subjectId: v.subjectId,
    raters: v.deliveryRatings
  }));

  return { projectTypeItems, realDeliveryItems, releaseItems };
}

export function runAgreement(dataDir = DATA_DIR, raters = RATERS) {
  const raterData = loadRaterFiles(dataDir, raters);
  const { projectTypeItems, realDeliveryItems, releaseItems } = buildDimensionItems(raterData, raters);

  const resType = calculateDimensionAgreement(projectTypeItems, EXPECTED_PROJECT_TYPES);
  const resDelivery = calculateDimensionAgreement(realDeliveryItems, EXPECTED_DELIVERIES);
  const resCorrective = calculateDimensionAgreement(releaseItems, EXPECTED_CORRECTIVE);

  return {
    raters,
    dimensions: {
      project_type: {
        name: 'Tipo de Projeto',
        categories: EXPECTED_PROJECT_TYPES,
        ...resType
      },
      real_delivery: {
        name: 'Entregas Reais ao Usuário',
        categories: EXPECTED_DELIVERIES,
        ...resDelivery
      },
      is_corrective: {
        name: 'Release Corretiva (CFR b)',
        categories: EXPECTED_CORRECTIVE,
        ...resCorrective
      }
    }
  };
}

function printReport(report) {
  console.log(`\n========================================================================`);
  console.log(`       CÁLCULO DE CONCORDÂNCIA INTER-OBSERVADOR (KAPPA DE FLEISS)       `);
  console.log(`========================================================================`);
  console.log(`Avaliadores analisados: ${report.raters.join(', ')}`);
  console.log(`Critério de interpretação: Landis & Koch (1977)\n`);

  for (const [key, dim] of Object.entries(report.dimensions)) {
    console.log(`------------------------------------------------------------------------`);
    console.log(`Dimensão: ${dim.name} (${key})`);
    console.log(`------------------------------------------------------------------------`);
    console.log(`• Itens avaliados (N):            ${dim.subjectsCount}`);
    console.log(`• Categorias avaliadas (k):        ${dim.categoriesCount} [${dim.categories.join(', ')}]`);
    console.log(`• Concordância observada (P_bar): ${(dim.observedAgreement * 100).toFixed(2)}%`);
    console.log(`• Concordância por chance (P_e):  ${(dim.chanceAgreement * 100).toFixed(2)}%`);
    console.log(`• Kappa de Fleiss (κ):            ${dim.kappa.toFixed(4)}`);
    console.log(`• Enquadramento:                  ${dim.interpretation.label.toUpperCase()} (${dim.interpretation.description})\n`);
  }
}

function exportMarkdownReport(report, outDir) {
  const md = `# Relatório de Concordância Inter-Observador (Kappa de Fleiss)

Data da análise: ${new Date().toISOString()}  
Avaliadores: ${report.raters.map(r => `\`${r}\``).join(', ')}  
Interpretação: Landis & Koch (1977)

| Dimensão | Sujeitos (N) | Categorias (k) | P_obs (%) | P_esp (%) | Kappa (κ) | Enquadramento |
|---|---|---|---|---|---|---|
${Object.values(report.dimensions).map(d => `| **${d.name}** | ${d.subjectsCount} | ${d.categoriesCount} | ${(d.observedAgreement * 100).toFixed(1)}% | ${(d.chanceAgreement * 100).toFixed(1)}% | **${d.kappa.toFixed(4)}** | ${d.interpretation.label} |`).join('\n')}

### Faixas de Referência de Landis & Koch (1977)
- **< 0,00:** Pobre
- **0,00 – 0,20:** Leve
- **0,21 – 0,40:** Razoável
- **0,41 – 0,60:** Moderada
- **0,61 – 0,80:** Substancial
- **0,81 – 1,00:** Quase perfeita
`;

  fs.writeFileSync(path.join(outDir, 'agreement_report.md'), md, 'utf8');
  fs.writeFileSync(path.join(outDir, 'agreement_report.json'), JSON.stringify(report, null, 2), 'utf8');
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve('scripts/calculate-agreement.mjs')) {
  try {
    const report = runAgreement(DATA_DIR, RATERS);
    printReport(report);
    exportMarkdownReport(report, DATA_DIR);
    console.log(`Relatórios exportados com sucesso em:`);
    console.log(`- ${path.join(DATA_DIR, 'agreement_report.md')}`);
    console.log(`- ${path.join(DATA_DIR, 'agreement_report.json')}`);
  } catch (err) {
    console.error(`Erro ao calcular concordância:`, err.message);
    process.exitCode = 1;
  }
}
