/**
 * Cálculo de concordância inter-observador para múltiplos avaliadores nominais.
 * Implementa o Kappa de Fleiss (1971) e agregações conforme convenção da literatura e statsmodels.
 */

/**
 * Converte matriz de avaliações brutas (sujeito x avaliador) em tabela de contagens por categoria (sujeito x categoria).
 * 
 * @param {Array<Array<string|number>>} data Matriz onde cada linha representa um sujeito e cada coluna um avaliador
 * @param {Array<string|number>} [categories] Lista de categorias esperadas (opcional; se omitido, infere categorias únicas ordenadas)
 * @returns {{ table: number[][], categories: Array<string|number> }} Tabela de contagens e lista de categorias
 */
export function aggregateRaters(data, categories = null) {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Os dados devem ser um array bidimensional não vazio (sujeitos x avaliadores).');
  }

  const numRaters = data[0].length;
  if (numRaters < 2) {
    throw new Error('O cálculo de concordância exige pelo menos 2 avaliadores por sujeito.');
  }

  for (const row of data) {
    if (!Array.isArray(row) || row.length !== numRaters) {
      throw new Error('Todas as linhas devem conter o mesmo número de avaliadores.');
    }
  }

  let uniqueCats = categories ? [...categories] : [];
  if (!categories) {
    const set = new Set();
    for (const row of data) {
      for (const val of row) {
        if (val !== null && val !== undefined && val !== '') {
          set.add(String(val));
        }
      }
    }
    uniqueCats = Array.from(set).sort();
  }

  if (uniqueCats.length === 0) {
    throw new Error('Nenhuma categoria válida encontrada nas avaliações.');
  }

  const catIndex = new Map(uniqueCats.map((c, i) => [String(c), i]));

  const table = data.map(row => {
    const counts = new Array(uniqueCats.length).fill(0);
    for (const val of row) {
      const idx = catIndex.get(String(val));
      if (idx !== undefined) {
        counts[idx]++;
      } else {
        throw new Error(`Valor de categoria desconhecido: "${val}".`);
      }
    }
    return counts;
  });

  return { table, categories: uniqueCats };
}

/**
 * Calcula o Kappa de Fleiss para uma tabela de contagens (sujeito x categoria).
 * 
 * @param {number[][]} table Matriz N x k onde table[i][j] é a contagem de avaliadores que atribuíram a categoria j ao sujeito i
 * @returns {{
 *   kappa: number,
 *   observedAgreement: number,
 *   chanceAgreement: number,
 *   subjectsCount: number,
 *   ratersCount: number,
 *   categoriesCount: number
 * }}
 */
export function fleissKappa(table) {
  if (!Array.isArray(table) || table.length === 0) {
    throw new Error('A tabela deve ser uma matriz não vazia (sujeitos x categorias).');
  }

  const N = table.length;
  const k = table[0].length;

  if (k < 2) {
    throw new Error('O Kappa de Fleiss exige pelo menos 2 categorias.');
  }

  // Verifica o número de avaliadores n por sujeito
  const n = table[0].reduce((sum, val) => sum + val, 0);
  if (n < 2) {
    throw new Error('O Kappa de Fleiss exige pelo menos 2 avaliações por sujeito.');
  }

  for (let i = 0; i < N; i++) {
    const row = table[i];
    if (!Array.isArray(row) || row.length !== k) {
      throw new Error('Todas as linhas da tabela devem possuir o mesmo número de categorias.');
    }
    const rowSum = row.reduce((sum, val) => sum + val, 0);
    if (rowSum !== n) {
      throw new Error(`Número inconsistente de avaliadores na linha ${i}: esperado ${n}, obtido ${rowSum}.`);
    }
  }

  // 1. Proporção de concordância para cada sujeito P_i
  // P_i = ( sum(n_ij^2) - n ) / ( n * (n - 1) )
  let sumP_i = 0;
  for (let i = 0; i < N; i++) {
    let sumSq = 0;
    for (let j = 0; j < k; j++) {
      sumSq += table[i][j] * table[i][j];
    }
    const Pi = (sumSq - n) / (n * (n - 1));
    sumP_i += Pi;
  }
  const P_bar = sumP_i / N;

  // 2. Proporção total atribuída a cada categoria p_j
  // p_j = sum_i(n_ij) / (N * n)
  const p = new Array(k).fill(0);
  for (let j = 0; j < k; j++) {
    let sumCat = 0;
    for (let i = 0; i < N; i++) {
      sumCat += table[i][j];
    }
    p[j] = sumCat / (N * n);
  }

  // 3. Concordância esperada por chance P_e
  // P_e = sum_j(p_j^2)
  let P_e = 0;
  for (let j = 0; j < k; j++) {
    P_e += p[j] * p[j];
  }

  // 4. Kappa de Fleiss
  // Se P_e == 1 (concordância total em uma única categoria em todos os casos), kappa = 1
  if (Math.abs(1 - P_e) < 1e-12) {
    return {
      kappa: 1,
      observedAgreement: P_bar,
      chanceAgreement: P_e,
      subjectsCount: N,
      ratersCount: n,
      categoriesCount: k
    };
  }

  const kappa = (P_bar - P_e) / (1 - P_e);

  return {
    kappa,
    observedAgreement: P_bar,
    chanceAgreement: P_e,
    subjectsCount: N,
    ratersCount: n,
    categoriesCount: k
  };
}

/**
 * Classificação qualitativa da concordância segundo Landis & Koch (1977).
 * 
 * @param {number} kappa Valor do coeficiente Kappa
 * @returns {{ code: string, label: string, description: string }}
 */
export function interpretKappa(kappa) {
  if (typeof kappa !== 'number' || Number.isNaN(kappa)) {
    throw new Error('O valor de kappa deve ser um número válido.');
  }

  if (kappa < 0) {
    return {
      code: 'pobre',
      label: 'Pobre',
      description: 'Concordância inferior ao esperado pelo acaso (< 0,00)'
    };
  }
  if (kappa <= 0.20) {
    return {
      code: 'leve',
      label: 'Leve',
      description: 'Concordância leve (0,00 a 0,20)'
    };
  }
  if (kappa <= 0.40) {
    return {
      code: 'razoavel',
      label: 'Razoável',
      description: 'Concordância razoável (0,21 a 0,40)'
    };
  }
  if (kappa <= 0.60) {
    return {
      code: 'moderada',
      label: 'Moderada',
      description: 'Concordância moderada (0,41 a 0,60)'
    };
  }
  if (kappa <= 0.80) {
    return {
      code: 'substancial',
      label: 'Substancial',
      description: 'Concordância substancial (0,61 a 0,80)'
    };
  }
  return {
    code: 'quase_perfeita',
    label: 'Quase perfeita',
    description: 'Concordância quase perfeita (0,81 a 1,00)'
  };
}

/**
 * Calcula a concordância de avaliações em um objeto estruturado por dimensão.
 * 
 * @param {Array<{ subjectId: string, raters: Record<string, string|number> }>} items
 * @param {Array<string|number>} [expectedCategories]
 * @returns {object}
 */
export function calculateDimensionAgreement(items, expectedCategories = null) {
  if (!items || items.length === 0) {
    throw new Error('Nenhum item fornecido para a dimensão.');
  }

  const raterNames = Object.keys(items[0].raters).sort();
  const matrix = items.map(item => {
    return raterNames.map(r => item.raters[r]);
  });

  const { table, categories } = aggregateRaters(matrix, expectedCategories);
  const result = fleissKappa(table);
  const interpretation = interpretKappa(result.kappa);

  return {
    ...result,
    categories,
    raters: raterNames,
    interpretation
  };
}

/**
 * Gerador de números pseudoaleatórios determinístico baseado em Mulberry32.
 * Garante que o sorteio de repositórios e releases seja 100% reproduzível.
 * 
 * @param {number} [seed=42] Semente numérica
 * @returns {() => number} Função que retorna ponto flutuante em [0, 1)
 */
export function createRNG(seed = 42) {
  let s = Number(seed) >>> 0;
  return function next() {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Seleciona n elementos sem reposição de um array de forma determinística (Fisher-Yates shuffle parcial).
 * 
 * @template T
 * @param {T[]} array Array de entrada
 * @param {number} n Quantidade de itens a sortear
 * @param {() => number} [rng] Função de aleatoriedade determinística (padrão: createRNG(42))
 * @returns {T[]} Subconjunto sorteado
 */
export function sampleArray(array, n, rng = createRNG(42)) {
  if (!Array.isArray(array)) throw new Error('O primeiro argumento deve ser um array.');
  if (n <= 0) return [];
  if (n >= array.length) return [...array];

  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

