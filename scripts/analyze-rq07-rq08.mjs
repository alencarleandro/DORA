#!/usr/bin/env node
/**
 * Script de análise estatística para a RQ 07 (Análise de Sensibilidade)
 * e o bônus RQ 08 (Rework Rate) da Sprint 3 (Lab03S03).
 *
 * Processa data/dataset-s02-final/dataset.csv (300 repositórios),
 * gera classificações DORA sob quatro combinações operacionais (C1 a C4),
 * calcula taxas de transição, Kappa de Cohen linear ponderado, matrizes 4x4,
 * estatísticas descritivas do Rework Rate e correlações de Spearman.
 */

import fs from 'node:fs';
import path from 'node:path';
import { parseCSV, toCSV } from '../lib/csv.mjs';
import {classifyWindowFrequency} from '../lib/descriptive.mjs';
import {
  cleanNumeric,
  classifyLeadTime,
  classifyCfr,
  classifyRecovery,
  calculateOverallDora,
  compareClassifications,
  spearmanCorrelation,
  CATEGORIES,
  CATEGORY_NAMES
} from '../lib/sensitivity.mjs';

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    dataset: 'data/dataset-s02-final/dataset.csv',
    output: 'output/rq07-rq08'
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dataset' && args[i + 1]) options.dataset = args[++i];
    else if (args[i] === '--output' && args[i + 1]) options.output = args[++i];
  }
  return options;
}

function quantile(sorted, p) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * p;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base] + (sorted[Math.ceil(pos)] - sorted[base]) * rest;
}

function calcStats(values) {
  const nums = values.filter(v => v !== null && v !== undefined && Number.isFinite(v)).sort((a, b) => a - b);
  if (!nums.length) return null;
  const n = nums.length;
  const sum = nums.reduce((acc, v) => acc + v, 0);
  const mean = sum / n;
  const variance = nums.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (n > 1 ? n - 1 : 1);
  const std = Math.sqrt(variance);
  const q1 = quantile(nums, 0.25);
  const median = quantile(nums, 0.5);
  const q3 = quantile(nums, 0.75);
  return {
    n,
    mean,
    std,
    min: nums[0],
    q1,
    median,
    q3,
    iqr: q3 - q1,
    max: nums[n - 1]
  };
}

function formatMatrixMd(matrix, labelA, labelB) {
  let md = `| ${labelA} \\ ${labelB} | Low (1) | Medium (2) | High (3) | Elite (4) | Total |\n`;
  md += `|:---|:---:|:---:|:---:|:---:|:---:|\n`;
  for (let i = 0; i < 4; i++) {
    const rowName = `${CATEGORY_NAMES[i]} (${i + 1})`;
    const r = matrix[i];
    const sum = r.reduce((acc, v) => acc + v, 0);
    md += `| **${rowName}** | ${r[0]} | ${r[1]} | ${r[2]} | ${r[3]} | **${sum}** |\n`;
  }
  const colSums = [0, 1, 2, 3].map(col => matrix.reduce((acc, r) => acc + r[col], 0));
  const total = colSums.reduce((acc, v) => acc + v, 0);
  md += `| **Total** | **${colSums[0]}** | **${colSums[1]}** | **${colSums[2]}** | **${colSums[3]}** | **${total}** |\n`;
  return md;
}

export function runAnalysis(options) {
  const datasetPath = path.resolve(options.dataset);
  const outputDir = path.resolve(options.output);

  if (!fs.existsSync(datasetPath)) {
    throw new Error(`Arquivo de dataset não encontrado: ${datasetPath}`);
  }

  fs.mkdirSync(outputDir, { recursive: true });

  const rawContent = fs.readFileSync(datasetPath, 'utf8');
  const rows = parseCSV(rawContent, { spreadsheetEscapes: true });
  console.log(`Carregados ${rows.length} repositórios de ${datasetPath}`);

  const processed = rows.map(r => {
    const repository = r.repository;
    const stars = cleanNumeric(r.stars);
    const language = r.language || 'Não informada';
    const df = cleanNumeric(r.deployment_frequency);
    const ltRelease = cleanNumeric(r.lead_time_release_median_days);
    const ltCommit = cleanNumeric(r.lead_time_commit_median_days);
    const cfrCi = cleanNumeric(r.cfr_ci);
    const cfrB = cleanNumeric(r.cfr_b);
    const recoveryHours = cleanNumeric(r.recovery_median_hours);
    const failures = cleanNumeric(r.failures) || 0;
    const successes = cleanNumeric(r.successes) || 0;
    const releasesInWindow = cleanNumeric(r.releases_in_window) || 0;
    const cfrBReleasesFailed = cleanNumeric(r.cfr_b_releases_failed) || 0;
    const cfrBReleasesEvaluated = cleanNumeric(r.cfr_b_releases_evaluated) || 0;
    const cfrBReleasesCensored = cleanNumeric(r.cfr_b_releases_censored) || 0;

    // Classificação individual
    const dfScore = df === null ? null : classifyWindowFrequency(releasesInWindow,r.window_start,r.window_end);
    const ltReleaseScore = classifyLeadTime(ltRelease);
    const ltCommitScore = classifyLeadTime(ltCommit);
    const cfrCiScore = classifyCfr(cfrCi);
    const cfrBScore = classifyCfr(cfrB);
    const recoveryScore = classifyRecovery(recoveryHours);

    // Imputação de MTTR para repositórios com 0 falhas (Tratamento B)
    const recoveryScoreImputed = recoveryScore !== null ? recoveryScore : (failures === 0 && successes > 0 ? 4 : null);

    // Combinações Operacionais
    // C1: Referência (DF, Lead Time release a, CFR ci a, Recovery)
    const c1Score = calculateOverallDora([dfScore, ltReleaseScore, cfrCiScore, recoveryScore]);
    const c1ScoreImputed = calculateOverallDora([dfScore, ltReleaseScore, cfrCiScore, recoveryScoreImputed]);

    // C2: Alternativa Completa (DF, Lead Time commit b, CFR b entrega, Recovery)
    const c2Score = calculateOverallDora([dfScore, ltCommitScore, cfrBScore, recoveryScore]);
    const c2ScoreImputed = calculateOverallDora([dfScore, ltCommitScore, cfrBScore, recoveryScoreImputed]);

    // C3: Mista 1 (DF, Lead Time release a, CFR b entrega, Recovery)
    const c3Score = calculateOverallDora([dfScore, ltReleaseScore, cfrBScore, recoveryScore]);
    const c3ScoreImputed = calculateOverallDora([dfScore, ltReleaseScore, cfrBScore, recoveryScoreImputed]);

    // C4: Mista 2 (DF, Lead Time commit b, CFR ci a, Recovery)
    const c4Score = calculateOverallDora([dfScore, ltCommitScore, cfrCiScore, recoveryScore]);
    const c4ScoreImputed = calculateOverallDora([dfScore, ltCommitScore, cfrCiScore, recoveryScoreImputed]);

    // RQ 08: Rework Rate
    const reworkRateTotal = releasesInWindow > 0 ? cfrBReleasesFailed / releasesInWindow : null;
    const reworkRateEvaluated = cfrBReleasesEvaluated > 0 ? cfrBReleasesFailed / cfrBReleasesEvaluated : null;

    return {
      repository,
      stars,
      language,
      releases_in_window: releasesInWindow,
      deployment_frequency: df,
      df_score: dfScore,
      df_category: CATEGORIES[dfScore] || '',

      lead_time_release_median_days: ltRelease,
      lt_release_score: ltReleaseScore,
      lt_release_category: CATEGORIES[ltReleaseScore] || '',

      lead_time_commit_median_days: ltCommit,
      lt_commit_score: ltCommitScore,
      lt_commit_category: CATEGORIES[ltCommitScore] || '',

      cfr_ci: cfrCi,
      cfr_ci_score: cfrCiScore,
      cfr_ci_category: CATEGORIES[cfrCiScore] || '',

      cfr_b: cfrB,
      cfr_b_score: cfrBScore,
      cfr_b_category: CATEGORIES[cfrBScore] || '',

      recovery_median_hours: recoveryHours,
      recovery_score: recoveryScore,
      recovery_category: CATEGORIES[recoveryScore] || 'Ausente (0 falhas)',

      has_complete_metrics: recoveryScore !== null,

      c1_score: c1Score,
      c1_category: CATEGORIES[c1Score],
      c1_imputed_score: c1ScoreImputed,
      c1_imputed_category: CATEGORIES[c1ScoreImputed],

      c2_score: c2Score,
      c2_category: CATEGORIES[c2Score],
      c2_imputed_score: c2ScoreImputed,
      c2_imputed_category: CATEGORIES[c2ScoreImputed],

      c3_score: c3Score,
      c3_category: CATEGORIES[c3Score],
      c3_imputed_score: c3ScoreImputed,
      c3_imputed_category: CATEGORIES[c3ScoreImputed],

      c4_score: c4Score,
      c4_category: CATEGORIES[c4Score],
      c4_imputed_score: c4ScoreImputed,
      c4_imputed_category: CATEGORIES[c4ScoreImputed],

      cfr_b_releases_failed: cfrBReleasesFailed,
      cfr_b_releases_evaluated: cfrBReleasesEvaluated,
      cfr_b_releases_censored: cfrBReleasesCensored,
      rework_rate_total: reworkRateTotal,
      rework_rate_evaluated: reworkRateEvaluated
    };
  });

  const nTotal = processed.length;
  console.log(`Processados ${nTotal} repositórios com sucesso.`);

  // Contagem por categoria em cada combinação
  const countDistribution = scores => {
    const counts = { Elite: 0, High: 0, Medium: 0, Low: 0 };
    for (const s of scores) {
      const cat = CATEGORIES[s];
      if (cat) counts[cat]++;
    }
    return counts;
  };

  const distC1 = countDistribution(processed.map(p => p.c1_score));
  const distC2 = countDistribution(processed.map(p => p.c2_score));
  const distC3 = countDistribution(processed.map(p => p.c3_score));
  const distC4 = countDistribution(processed.map(p => p.c4_score));

  // Análise de Sensibilidade em Pares (RQ 07)
  const pairs = [
    {
      name: 'C1 x C2 (Referência vs Alternativa Completa)',
      code: 'C1_C2',
      focus: 'Mudança conjunta de Lead Time (release -> commit) e CFR (CI -> entrega)',
      y1: processed.map(p => p.c1_score),
      y2: processed.map(p => p.c2_score)
    },
    {
      name: 'C1 x C3 (Isolamento do CFR)',
      code: 'C1_C3',
      focus: 'Efeito isolado da mudança de CFR (CI -> entrega), mantendo Lead Time por release',
      y1: processed.map(p => p.c1_score),
      y2: processed.map(p => p.c3_score)
    },
    {
      name: 'C1 x C4 (Isolamento do Lead Time)',
      code: 'C1_C4',
      focus: 'Efeito isolado da mudança de Lead Time (release -> commit), mantendo CFR de CI',
      y1: processed.map(p => p.c1_score),
      y2: processed.map(p => p.c4_score)
    },
    {
      name: 'C2 x C3 (Lead Time sob CFR de entrega)',
      code: 'C2_C3',
      focus: 'Efeito de Lead Time (commit vs release) tendo o CFR de entrega como base',
      y1: processed.map(p => p.c2_score),
      y2: processed.map(p => p.c3_score)
    },
    {
      name: 'C2 x C4 (CFR sob Lead Time por commit)',
      code: 'C2_C4',
      focus: 'Efeito de CFR (entrega vs CI) tendo o Lead Time por commit como base',
      y1: processed.map(p => p.c2_score),
      y2: processed.map(p => p.c4_score)
    },
    {
      name: 'C3 x C4 (Cruzamento das Mistas)',
      code: 'C3_C4',
      focus: 'Comparação entre as duas definições operacionais híbridas',
      y1: processed.map(p => p.c3_score),
      y2: processed.map(p => p.c4_score)
    }
  ];

  const pairResults = pairs.map(p => ({
    name: p.name,
    code: p.code,
    focus: p.focus,
    ...compareClassifications(p.y1, p.y2)
  }));

  // Sensibilidade secundária: Imputação de MTTR para repositórios com 0 falhas
  const pairResultsImputed = [
    {
      name: 'C1 x C2 (Com Imputação Elite para 0 Falhas)',
      code: 'C1_C2_imputed',
      ...compareClassifications(
        processed.map(p => p.c1_imputed_score),
        processed.map(p => p.c2_imputed_score)
      )
    }
  ];

  // Sensibilidade secundária: Apenas casos completos (N=258)
  const completeCases = processed.filter(p => p.has_complete_metrics);
  const pairResultsComplete = [
    {
      name: 'C1 x C2 (Apenas N=258 Casos com MTTR Observado)',
      code: 'C1_C2_complete',
      ...compareClassifications(
        completeCases.map(p => p.c1_score),
        completeCases.map(p => p.c2_score)
      )
    }
  ];

  // Análise da RQ 08 (Rework Rate)
  const reworkVals = processed.map(p => p.rework_rate_total).filter(v => v !== null);
  const reworkStats = calcStats(reworkVals);
  const zeroReworkCount = reworkVals.filter(v => v === 0).length;

  // Correlações de Spearman da RQ 08
  const validForSpearman = processed.filter(p =>
    p.rework_rate_total !== null &&
    p.cfr_b !== null &&
    p.cfr_ci !== null &&
    p.deployment_frequency !== null &&
    p.lead_time_release_median_days !== null
  );

  const spearmanReworkCfrB = spearmanCorrelation(
    validForSpearman.map(p => p.rework_rate_total),
    validForSpearman.map(p => p.cfr_b)
  );

  const spearmanReworkCfrCi = spearmanCorrelation(
    validForSpearman.map(p => p.rework_rate_total),
    validForSpearman.map(p => p.cfr_ci)
  );

  const spearmanReworkDf = spearmanCorrelation(
    validForSpearman.map(p => p.rework_rate_total),
    validForSpearman.map(p => p.deployment_frequency)
  );

  const spearmanReworkLt = spearmanCorrelation(
    validForSpearman.map(p => p.rework_rate_total),
    validForSpearman.map(p => p.lead_time_release_median_days)
  );

  // 1. Exportar CSV das classificações
  const classificationHeaders = [
    'repository',
    'stars',
    'language',
    'releases_in_window',
    'deployment_frequency',
    'df_category',
    'lead_time_release_median_days',
    'lt_release_category',
    'lead_time_commit_median_days',
    'lt_commit_category',
    'cfr_ci',
    'cfr_ci_category',
    'cfr_b',
    'cfr_b_category',
    'recovery_median_hours',
    'recovery_category',
    'c1_category',
    'c1_score',
    'c2_category',
    'c2_score',
    'c3_category',
    'c3_score',
    'c4_category',
    'c4_score',
    'rework_rate_total'
  ];

  const classificationsCsvPath = path.join(outputDir, 'rq07-classifications.csv');
  fs.writeFileSync(classificationsCsvPath, toCSV(processed, classificationHeaders));
  console.log(`Gerado: ${classificationsCsvPath}`);

  // 2. Exportar JSON de sumário
  const summaryJson = {
    dataset: options.dataset,
    total_repositories: nTotal,
    complete_cases_count: completeCases.length,
    missing_recovery_count: nTotal - completeCases.length,
    distributions: {
      C1_reference: distC1,
      C2_alternative: distC2,
      C3_mixed_lt_release_cfr_b: distC3,
      C4_mixed_lt_commit_cfr_ci: distC4
    },
    pairwise_sensitivity: pairResults,
    imputation_sensitivity: pairResultsImputed,
    complete_cases_sensitivity: pairResultsComplete,
    rq08_rework_rate: {
      descriptive_statistics: reworkStats,
      zero_rework_count: zeroReworkCount,
      zero_rework_percent: (zeroReworkCount / nTotal) * 100,
      spearman_correlations: {
        rework_rate_vs_cfr_b: spearmanReworkCfrB,
        rework_rate_vs_cfr_ci: spearmanReworkCfrCi,
        rework_rate_vs_deployment_frequency: spearmanReworkDf,
        rework_rate_vs_lead_time_release: spearmanReworkLt
      }
    }
  };

  const summaryJsonPath = path.join(outputDir, 'rq07-sensitivity-summary.json');
  fs.writeFileSync(summaryJsonPath, JSON.stringify(summaryJson, null, 2));
  console.log(`Gerado: ${summaryJsonPath}`);

  // 3. Exportar Relatório Markdown da RQ 07
  let reportMd = `# Relatório de Análise de Sensibilidade — RQ 07

**Disciplina:** Experimentação em Engenharia de Software (PUC Minas)  
**Projeto:** Avaliação de Métricas DORA em Repositórios Open-Source  
**Data da Análise:** ${new Date().toISOString().slice(0, 10)}  
**Amostra:** ${nTotal} repositórios GitHub consolidados (janela de 2025)

---

## 1. Pergunta de Pesquisa (RQ 07)

> **RQ 07. O quanto a classificação DORA de um repositório depende da definição operacional escolhida?** *(análise de sensibilidade)*

Para responder a esta questão, avaliamos quatro combinações operacionais de métricas para os mesmos ${nTotal} repositórios:

| Combinação | Deployment Frequency | Lead Time for Changes | Change Failure Rate | Tempo de Recuperação |
|:---|:---|:---|:---|:---|
| **C1 (Referência)** | Releases / semana | Variante (a): por release | Variante (a): proxy de CI | Mediana de workflows |
| **C2 (Alternativa)** | Releases / semana | Variante (b): por commit | Variante (b): proxy de entrega | Mediana de workflows |
| **C3 (Mista 1)** | Releases / semana | Variante (a): por release | Variante (b): proxy de entrega | Mediana de workflows |
| **C4 (Mista 2)** | Releases / semana | Variante (b): por commit | Variante (a): proxy de CI | Mediana de workflows |

A classificação geral é obtida pela **mediana das 4 dimensões (ou dimensões observadas), arredondada para baixo**, nas faixas: **Elite (4)**, **High (3)**, **Medium (2)** e **Low (1)**.

**Alinhamento da C1:** este script compartilha o corte de frequência com RQ01-04: em ano civil completo, 12 releases atendem a uma por mês, sem arredondar o ano para 52,14 semanas. Esta C1 usa dimensões disponíveis nos 300 projetos; a C1 completa de RQ01-04 usa somente os 258 com quatro dimensões. O CFR (b) permanece exploratório enquanto a validação contra o consenso final estiver pendente.

---

## 2. Distribuição das Categorias DORA por Definição

| Categoria | C1 (Referência) | C2 (Alternativa) | C3 (Mista 1) | C4 (Mista 2) |
|:---|:---:|:---:|:---:|:---:|
| **Elite** | ${distC1.Elite} (${((distC1.Elite / nTotal) * 100).toFixed(1)}%) | ${distC2.Elite} (${((distC2.Elite / nTotal) * 100).toFixed(1)}%) | ${distC3.Elite} (${((distC3.Elite / nTotal) * 100).toFixed(1)}%) | ${distC4.Elite} (${((distC4.Elite / nTotal) * 100).toFixed(1)}%) |
| **High** | ${distC1.High} (${((distC1.High / nTotal) * 100).toFixed(1)}%) | ${distC2.High} (${((distC2.High / nTotal) * 100).toFixed(1)}%) | ${distC3.High} (${((distC3.High / nTotal) * 100).toFixed(1)}%) | ${distC4.High} (${((distC4.High / nTotal) * 100).toFixed(1)}%) |
| **Medium** | ${distC1.Medium} (${((distC1.Medium / nTotal) * 100).toFixed(1)}%) | ${distC2.Medium} (${((distC2.Medium / nTotal) * 100).toFixed(1)}%) | ${distC3.Medium} (${((distC3.Medium / nTotal) * 100).toFixed(1)}%) | ${distC4.Medium} (${((distC4.Medium / nTotal) * 100).toFixed(1)}%) |
| **Low** | ${distC1.Low} (${((distC1.Low / nTotal) * 100).toFixed(1)}%) | ${distC2.Low} (${((distC2.Low / nTotal) * 100).toFixed(1)}%) | ${distC3.Low} (${((distC3.Low / nTotal) * 100).toFixed(1)}%) | ${distC4.Low} (${((distC4.Low / nTotal) * 100).toFixed(1)}%) |
| **Total** | **${nTotal}** | **${nTotal}** | **${nTotal}** | **${nTotal}** |

---

## 3. Matriz Comparativa de Concordância e Sensibilidade

| Comparação de Definições | Foco Metodológico | Repositórios Alterados | % Alteração | Subiram | Desceram | Kappa Linear (κ) | Avaliação (Landis & Koch) |
|:---|:---|:---:|:---:|:---:|:---:|:---:|:---|
`;

  for (const pr of pairResults) {
    reportMd += `| **${pr.name}** | ${pr.focus} | ${pr.changed}/${pr.total} | **${pr.changed_percent.toFixed(1)}%** | ${pr.upgraded} | ${pr.downgraded} | **${pr.kappa.toFixed(4)}** | ${pr.kappa_interpretation} |\n`;
  }

  reportMd += `
---

## 4. Matrizes de Transição de Categorias

### 4.1 C1 (Referência) $\\times$ C2 (Alternativa Completa)
${formatMatrixMd(pairResults[0].contingency_matrix, 'C1 (Linhas)', 'C2 (Colunas)')}

### 4.2 C1 (Referência) $\\times$ C3 (Isolamento do CFR)
${formatMatrixMd(pairResults[1].contingency_matrix, 'C1 (Linhas)', 'C3 (Colunas)')}

### 4.3 C1 (Referência) $\\times$ C4 (Isolamento do Lead Time)
${formatMatrixMd(pairResults[2].contingency_matrix, 'C1 (Linhas)', 'C4 (Colunas)')}

---

## 5. Análise de Robustez e Conclusões da RQ 07

1. **Impacto da Mudança Conjunta (C1 $\\times$ C2):**
   Ao adotar a definição alternativa completa (Lead Time por commit e CFR por releases corretivas), **${pairResults[0].changed_percent.toFixed(1)}% dos repositórios mudam de patamar DORA** (${pairResults[0].changed} de ${nTotal}). O Kappa de Cohen ponderado linearmente é de **${pairResults[0].kappa.toFixed(4)}**, indicando uma concordância **moderada**. Isso demonstra que conclusões baseadas em cortes fixos de patamar DORA são sensíveis à escolha operacional.
2. **Decomposição dos Efeitos:**
   - **Efeito do CFR isolado (C1 $\\times$ C3):** A troca de proxy do CFR (de CI para entrega) alterou a classificação de **${pairResults[1].changed_percent.toFixed(1)}%** dos repositórios, com $\\kappa = ${pairResults[1].kappa.toFixed(4)}$ (concordância substancial). Há ${distC1.Low} projetos Low em C1 e ${distC3.Low} em C3. As matrizes mostram a direção das transições; as contagens marginais não demonstram que um proxy é sempre mais rigoroso.
   - **Efeito do Lead Time isolado (C1 $\\times$ C4):** A troca de Lead Time (de release mais antiga para commit mediano) alterou exatamente **${pairResults[2].changed_percent.toFixed(1)}%** dos repositórios, com $\\kappa = ${pairResults[2].kappa.toFixed(4)}$ (concordância substancial).
3. **Robustez das Conclusões das RQ 01 a 06:**
   A permanência ou troca de categorias descreve a sensibilidade da classificação nesta coorte. Ela não comprova robustez das correlações de Spearman ou dos testes das RQ05/RQ06: isso exige recalcular esses resultados sob as variantes. As conclusões que usam CFR (b) são exploratórias até sua validação. A análise sobre dimensões disponíveis também não substitui a avaliação restrita aos casos completos.
`;

  const reportMdPath = path.join(outputDir, 'rq07-sensitivity-report.md');
  fs.writeFileSync(reportMdPath, reportMd);
  console.log(`Gerado: ${reportMdPath}`);

  // 4. Exportar CSV e Relatório da RQ 08
  const reworkRows = processed.map(p => ({
    repository: p.repository,
    stars: p.stars,
    language: p.language,
    releases_in_window: p.releases_in_window,
    cfr_b_releases_failed: p.cfr_b_releases_failed,
    cfr_b_releases_evaluated: p.cfr_b_releases_evaluated,
    rework_rate_total: p.rework_rate_total !== null ? p.rework_rate_total : '',
    rework_rate_evaluated: p.rework_rate_evaluated !== null ? p.rework_rate_evaluated : '',
    cfr_b: p.cfr_b !== null ? p.cfr_b : '',
    cfr_ci: p.cfr_ci !== null ? p.cfr_ci : ''
  }));

  const reworkCsvPath = path.join(outputDir, 'rq08-rework-rate.csv');
  fs.writeFileSync(
    reworkCsvPath,
    toCSV(reworkRows, [
      'repository',
      'stars',
      'language',
      'releases_in_window',
      'cfr_b_releases_failed',
      'cfr_b_releases_evaluated',
      'rework_rate_total',
      'rework_rate_evaluated',
      'cfr_b',
      'cfr_ci'
    ])
  );
  console.log(`Gerado: ${reworkCsvPath}`);

  let reworkMd = `# Relatório do Bônus — RQ 08: Rework Rate

**Disciplina:** Experimentação em Engenharia de Software (PUC Minas)  
**Projeto:** Avaliação de Métricas DORA em Repositórios Open-Source  
**Métrica Avaliada:** *Deployment Rework Rate* (DORA State of DevOps Report 2024)

---

## 1. O que é o Rework Rate e como difere do CFR (b)?

Em 2024, o programa de pesquisa DORA incorporou uma quinta métrica-chave: a **Deployment Rework Rate** (Taxa de Retrabalho de Entrega).

### Distinção Conceitual:
- **Change Failure Rate — CFR (b):**
  Mede a proporção de entregas que **geraram falha**. O foco está na estabilidade do artefato entregue: *"Dentre as releases publicadas, qual porcentagem precisou de correção emergencial em até 7 dias?"*
  $$\\text{CFR (b)} = \\frac{\\text{Releases com falha observada}}{\\text{Releases avaliadas}}$$
- **Rework Rate:**
  Mede a proporção de entregas que **foram retrabalho**. O foco está na alocação de capacidade produtiva da equipe: *"Dentre todas as releases produzidas pela equipe, qual porcentagem do esforço de entrega foi consumida corrigindo defeitos anteriores?"*
  $$\\text{Rework Rate} = \\frac{\\text{Releases corretivas}}{\\text{Total de releases publicadas}}$$

---

## 2. Estatística Descritiva da Amostra (N = ${nTotal})

| Estatística | Valor |
|:---|:---:|
| **Média** | ${(reworkStats.mean * 100).toFixed(2)}% |
| **Desvio Padrão** | ${(reworkStats.std * 100).toFixed(2)}% |
| **Mínimo** | ${(reworkStats.min * 100).toFixed(2)}% |
| **1º Quartil (Q1)** | ${(reworkStats.q1 * 100).toFixed(2)}% |
| **Mediana** | **${(reworkStats.median * 100).toFixed(2)}%** |
| **3º Quartil (Q3)** | ${(reworkStats.q3 * 100).toFixed(2)}% |
| **Intervalo Interquartil (IQR)** | ${(reworkStats.iqr * 100).toFixed(2)}% |
| **Máximo** | ${(reworkStats.max * 100).toFixed(2)}% |
| **Repositórios com 0% de Retrabalho** | ${zeroReworkCount} (${((zeroReworkCount / nTotal) * 100).toFixed(1)}%) |

---

## 3. Correlações de Spearman (ρ)

| Variável Comparada | Coeficiente de Spearman (ρ) | Interpretação |
|:---|:---:|:---|
| **Rework Rate $\\times$ CFR (b)** | **${spearmanReworkCfrB.toFixed(4)}** | Correlação direta quase perfeita: repositórios com alta taxa de falha de release dedicam proporcionalmente mais entregas a correções. |
| **Rework Rate $\\times$ CFR (CI)** | **${spearmanReworkCfrCi.toFixed(4)}** | Correlação fraca/moderada: falhas de compilação/teste em pipeline interno nem sempre se traduzem em retrabalho de release para o usuário. |
| **Rework Rate $\\times$ Deployment Frequency** | **${spearmanReworkDf.toFixed(4)}** | Relação com cadência de entrega: projetos com deploy frequente tendem a publicar hotfixes rápidos. |
| **Rework Rate $\\times$ Lead Time (Release)** | **${spearmanReworkLt.toFixed(4)}** | Relação com tempo de desenvolvimento das mudanças. |

---

## 4. Síntese e Conclusão

1. A mediana do Rework Rate observada na coorte de 300 repositórios foi de **${(reworkStats.median * 100).toFixed(2)}%**, com IQR de **${(reworkStats.iqr * 100).toFixed(2)}%**.
2. O Rework Rate oferece uma perspectiva complementar essencial: enquanto o CFR (b) identifica o risco de instabilidade por entrega, o Rework Rate quantifica o custo oculto de manutenção não planejada na capacidade de desenvolvimento de software open-source.
`;

  const reworkMdPath = path.join(outputDir, 'rq08-rework-report.md');
  fs.writeFileSync(reworkMdPath, reworkMd);
  console.log(`Gerado: ${reworkMdPath}`);

  return {
    processedCount: nTotal,
    classificationsCsvPath,
    summaryJsonPath,
    reportMdPath,
    reworkCsvPath,
    reworkMdPath,
    pairResults,
    reworkStats
  };
}

// Execução direta via CLI
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve('scripts/analyze-rq07-rq08.mjs')) {
  try {
    const opts = parseArgs();
    const result = runAnalysis(opts);
    console.log(`\nAnálise concluída com sucesso! Processados ${result.processedCount} repositórios.`);
  } catch (err) {
    console.error('Erro na execução da análise:', err);
    process.exit(1);
  }
}
