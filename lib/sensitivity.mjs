/**
 * Módulo de classificação DORA e análise de sensibilidade (RQ 07 / RQ 08).
 * Implementa mapeamento de faixas, agregação geral por mediana arredondada para baixo,
 * Kappa de Cohen ponderado linearmente e matrizes de contingência/transição.
 */

export const CATEGORIES = Object.freeze({
  4: 'Elite',
  3: 'High',
  2: 'Medium',
  1: 'Low'
});

export const CATEGORY_NAMES = Object.freeze(['Low', 'Medium', 'High', 'Elite']);
export const CATEGORY_SCORES = Object.freeze({
  Elite: 4,
  High: 3,
  Medium: 2,
  Low: 1
});

/**
 * Remove apóstrofos de proteção de fórmulas em planilhas e converte para número.
 * Retorna null se vazio ou indefinido.
 */
export function cleanNumeric(val) {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  if (!s) return null;
  const unescaped = s.startsWith("'") ? s.slice(1).trim() : s;
  if (!unescaped) return null;
  const num = Number(unescaped);
  return Number.isFinite(num) ? num : null;
}

/**
 * Classifica Deployment Frequency (releases por semana).
 * Elite: >= 7 por semana
 * High: >= 1 e < 7 por semana
 * Medium: >= 1 por mês (12 / 52.14 sem) e < 1 por semana
 * Low: < 1 por mês
 */
export function classifyDeploymentFrequency(df) {
  if (df === null || df === undefined || !Number.isFinite(df)) return null;
  if (df >= 7.0) return 4;
  if (df >= 1.0) return 3;
  // 12 meses em 365/366 dias (52.14 semanas): ~0.23015 releases/semana
  const onePerMonth = 12.0 / 52.14;
  if (df >= onePerMonth) return 2;
  return 1;
}

/**
 * Classifica Lead Time for Changes (mediana em dias).
 * Elite: < 1 dia
 * High: 1 dia a < 7 dias
 * Medium: 7 dias a < 30 dias
 * Low: >= 30 dias
 */
export function classifyLeadTime(days) {
  if (days === null || days === undefined || !Number.isFinite(days)) return null;
  if (days < 1.0) return 4;
  if (days < 7.0) return 3;
  if (days < 30.0) return 2;
  return 1;
}

/**
 * Classifica Change Failure Rate (fração de 0 a 1).
 * Elite: <= 15% (0.15)
 * High: > 15% e <= 30% (0.30)
 * Medium: > 30% e <= 45% (0.45)
 * Low: > 45%
 */
export function classifyCfr(cfr) {
  if (cfr === null || cfr === undefined || !Number.isFinite(cfr)) return null;
  if (cfr <= 0.15) return 4;
  if (cfr <= 0.30) return 3;
  if (cfr <= 0.45) return 2;
  return 1;
}

/**
 * Classifica Tempo de Recuperação / MTTR (mediana em horas).
 * Elite: < 1 hora
 * High: 1 hora a < 24 horas (1 dia)
 * Medium: 24 horas a < 168 horas (1 semana)
 * Low: >= 168 horas
 */
export function classifyRecovery(hours) {
  if (hours === null || hours === undefined || !Number.isFinite(hours)) return null;
  if (hours < 1.0) return 4;
  if (hours < 24.0) return 3;
  if (hours < 168.0) return 2;
  return 1;
}

/**
 * Calcula a classificação geral DORA de um repositório a partir das notas numéricas (1 a 4).
 * A categoria geral é a mediana das notas válidas, arredondada para baixo.
 * Exemplo: [4, 3, 3, 1] -> mediana 3 -> 3 (High).
 * Exemplo: [4, 4, 3, 2] -> mediana 3.5 -> floor(3.5) = 3 (High).
 */
export function calculateOverallDora(scores) {
  const valid = scores.filter(s => s !== null && s !== undefined && Number.isInteger(s));
  if (!valid.length) return null;
  valid.sort((a, b) => a - b);
  const n = valid.length;
  let median;
  if (n % 2 === 1) {
    median = valid[Math.floor(n / 2)];
  } else {
    median = (valid[n / 2 - 1] + valid[n / 2]) / 2.0;
  }
  const rounded = Math.floor(median);
  return Math.min(4, Math.max(1, rounded));
}

/**
 * Constrói uma matriz de contingência 4x4 entre duas classificações (valores 1 a 4).
 * Linhas = y1, Colunas = y2.
 */
export function buildContingencyMatrix(y1, y2, k = 4) {
  if (y1.length !== y2.length) {
    throw new Error(`Tamanhos incompatíveis para matriz de contingência: ${y1.length} vs ${y2.length}`);
  }
  const matrix = Array.from({ length: k }, () => Array(k).fill(0));
  for (let idx = 0; idx < y1.length; idx++) {
    const a = y1[idx];
    const b = y2[idx];
    if (a < 1 || a > k || b < 1 || b > k) {
      throw new Error(`Valores fora do intervalo [1, ${k}]: (${a}, ${b})`);
    }
    matrix[a - 1][b - 1]++;
  }
  return matrix;
}

/**
 * Calcula o Kappa de Cohen ponderado linearmente (weighted Cohen's Kappa, linear weights).
 * Ponderação linear: w_ij = 1 - |i - j| / (k - 1)
 * Idêntico à formula de scikit-learn cohen_kappa_score(y1, y2, weights='linear').
 */
export function weightedCohenKappaLinear(y1, y2, k = 4) {
  if (!y1.length || y1.length !== y2.length) {
    throw new Error('Vetores devem ser não-vazios e de mesmo tamanho.');
  }
  const n = y1.length;
  const matrix = buildContingencyMatrix(y1, y2, k);

  const rowSums = matrix.map(row => row.reduce((acc, v) => acc + v, 0));
  const colSums = Array.from({ length: k }, (_, j) => matrix.reduce((acc, row) => acc + row[j], 0));

  let po = 0.0;
  let pe = 0.0;

  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      const weight = 1.0 - Math.abs(i - j) / (k - 1);
      po += weight * (matrix[i][j] / n);
      pe += weight * (rowSums[i] / n) * (colSums[j] / n);
    }
  }

  if (Math.abs(1.0 - pe) < 1e-12) {
    return 1.0;
  }
  return (po - pe) / (1.0 - pe);
}

/**
 * Analisa a sensibilidade entre dois vetores de categorias (1 a 4).
 * Retorna número e percentual de mudanças, transições ordenadas, Kappa linear e interpretação.
 */
export function compareClassifications(y1, y2, k = 4) {
  if (!y1.length || y1.length !== y2.length) {
    throw new Error('Vetores devem ser não-vazios e de mesmo tamanho.');
  }
  const n = y1.length;
  let changed = 0;
  let upgraded = 0; // subiu de categoria
  let downgraded = 0; // desceu de categoria
  let distanceSum = 0;

  for (let i = 0; i < n; i++) {
    const diff = y2[i] - y1[i];
    if (diff !== 0) {
      changed++;
      distanceSum += Math.abs(diff);
      if (diff > 0) upgraded++;
      else downgraded++;
    }
  }

  const kappa = weightedCohenKappaLinear(y1, y2, k);
  const matrix = buildContingencyMatrix(y1, y2, k);

  return {
    total: n,
    changed,
    changed_percent: (changed / n) * 100,
    same: n - changed,
    same_percent: ((n - changed) / n) * 100,
    upgraded,
    upgraded_percent: (upgraded / n) * 100,
    downgraded,
    downgraded_percent: (downgraded / n) * 100,
    mean_category_distance: distanceSum / n,
    kappa,
    kappa_interpretation: interpretKappa(kappa),
    contingency_matrix: matrix
  };
}

/**
 * Interpretação usual de Landis & Koch (1977) para o coeficiente Kappa.
 */
export function interpretKappa(k) {
  if (k < 0) return 'Pobre / Discordância (< 0,00)';
  if (k <= 0.20) return 'Leve (0,00 a 0,20)';
  if (k <= 0.40) return 'Razoável (0,21 a 0,40)';
  if (k <= 0.60) return 'Moderada (0,41 a 0,60)';
  if (k <= 0.80) return 'Substancial (0,61 a 0,80)';
  return 'Quase perfeita (0,81 a 1,00)';
}

/**
 * Atribui postos fracionários médios em caso de empates (mid-ranks).
 */
export function rank(values) {
  const n = values.length;
  const indexed = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const ranks = new Array(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j < n - 1 && indexed[j + 1].v === indexed[j].v) {
      j++;
    }
    const avgRank = 1 + (i + j) / 2.0;
    for (let k = i; k <= j; k++) {
      ranks[indexed[k].i] = avgRank;
    }
    i = j + 1;
  }
  return ranks;
}

/**
 * Calcula a correlação de postos de Spearman (rho) entre dois vetores numéricos.
 * Trata empates adequadamente através da fórmula de correlação de Pearson sobre os postos.
 */
export function spearmanCorrelation(x, y) {
  if (!x || !y || x.length !== y.length || x.length < 2) {
    throw new Error('Vetores devem ter pelo menos dois elementos e mesmo tamanho.');
  }
  const rx = rank(x);
  const ry = rank(y);
  const n = rx.length;
  const meanX = rx.reduce((acc, v) => acc + v, 0) / n;
  const meanY = ry.reduce((acc, v) => acc + v, 0) / n;

  let num = 0.0;
  let denX = 0.0;
  let denY = 0.0;
  for (let i = 0; i < n; i++) {
    const dx = rx[i] - meanX;
    const dy = ry[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  if (denX === 0 || denY === 0) return 0.0;
  return num / Math.sqrt(denX * denY);
}

