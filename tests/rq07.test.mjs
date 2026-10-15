import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanNumeric,
  classifyDeploymentFrequency,
  classifyLeadTime,
  classifyCfr,
  classifyRecovery,
  calculateOverallDora,
  buildContingencyMatrix,
  weightedCohenKappaLinear,
  compareClassifications,
  interpretKappa,
  rank,
  spearmanCorrelation,
  CATEGORIES
} from '../lib/sensitivity.mjs';


test('cleanNumeric trata números, prefixos de proteção e vazios', () => {
  assert.equal(cleanNumeric('42.5'), 42.5);
  assert.equal(cleanNumeric("'-0.609988"), -0.609988);
  assert.equal(cleanNumeric(" ' 123.45 "), 123.45);
  assert.equal(cleanNumeric('0'), 0);
  assert.equal(cleanNumeric(''), null);
  assert.equal(cleanNumeric('   '), null);
  assert.equal(cleanNumeric(null), null);
  assert.equal(cleanNumeric(undefined), null);
  assert.equal(cleanNumeric('invalid_str'), null);
});

test('classifyDeploymentFrequency classifica faixas e limites corretamente', () => {
  // Elite: >= 7 por semana
  assert.equal(classifyDeploymentFrequency(10.0), 4);
  assert.equal(classifyDeploymentFrequency(7.0), 4);

  // High: >= 1 e < 7
  assert.equal(classifyDeploymentFrequency(6.999), 3);
  assert.equal(classifyDeploymentFrequency(1.0), 3);

  // Medium: >= 1 por mês (~0.23015) e < 1
  assert.equal(classifyDeploymentFrequency(0.999), 2);
  assert.equal(classifyDeploymentFrequency(0.24), 2);

  // Low: < 1 por mês
  assert.equal(classifyDeploymentFrequency(0.20), 1);
  assert.equal(classifyDeploymentFrequency(0.0), 1);

  // Nulos
  assert.equal(classifyDeploymentFrequency(null), null);
});

test('classifyLeadTime classifica faixas e limites em dias', () => {
  // Elite: < 1 dia
  assert.equal(classifyLeadTime(0.5), 4);
  assert.equal(classifyLeadTime(0.99), 4);

  // High: 1 dia a < 7 dias
  assert.equal(classifyLeadTime(1.0), 3);
  assert.equal(classifyLeadTime(6.99), 3);

  // Medium: 7 dias a < 30 dias
  assert.equal(classifyLeadTime(7.0), 2);
  assert.equal(classifyLeadTime(29.99), 2);

  // Low: >= 30 dias
  assert.equal(classifyLeadTime(30.0), 1);
  assert.equal(classifyLeadTime(150.0), 1);

  assert.equal(classifyLeadTime(null), null);
});

test('classifyCfr classifica faixas de taxa de falha', () => {
  // Elite: <= 15%
  assert.equal(classifyCfr(0.0), 4);
  assert.equal(classifyCfr(0.15), 4);

  // High: > 15% e <= 30%
  assert.equal(classifyCfr(0.1501), 3);
  assert.equal(classifyCfr(0.30), 3);

  // Medium: > 30% e <= 45%
  assert.equal(classifyCfr(0.3001), 2);
  assert.equal(classifyCfr(0.45), 2);

  // Low: > 45%
  assert.equal(classifyCfr(0.4501), 1);
  assert.equal(classifyCfr(0.85), 1);

  assert.equal(classifyCfr(null), null);
});

test('classifyRecovery classifica faixas de recuperação em horas', () => {
  // Elite: < 1 hora
  assert.equal(classifyRecovery(0.5), 4);
  assert.equal(classifyRecovery(0.99), 4);

  // High: 1h a < 24h
  assert.equal(classifyRecovery(1.0), 3);
  assert.equal(classifyRecovery(23.99), 3);

  // Medium: 24h a < 168h
  assert.equal(classifyRecovery(24.0), 2);
  assert.equal(classifyRecovery(167.99), 2);

  // Low: >= 168h
  assert.equal(classifyRecovery(168.0), 1);
  assert.equal(classifyRecovery(500.0), 1);

  assert.equal(classifyRecovery(null), null);
});

test('calculateOverallDora calcula mediana e arredonda para baixo', () => {
  // Exemplo do README: (4, 3, 3, 1) -> mediana 3 -> High (3)
  assert.equal(calculateOverallDora([4, 3, 3, 1]), 3);

  // Mediana com número par com média fracionária: (4, 4, 3, 2) -> mediana 3.5 -> floor 3
  assert.equal(calculateOverallDora([4, 4, 3, 2]), 3);

  // (4, 4, 4, 3) -> mediana 4 -> Elite (4)
  assert.equal(calculateOverallDora([4, 4, 4, 3]), 4);

  // (2, 2, 1, 1) -> mediana 1.5 -> floor 1 (Low)
  assert.equal(calculateOverallDora([2, 2, 1, 1]), 1);

  // 3 métricas disponíveis (ex.: recovery ausente por 0 falhas):
  // (4, 3, 2) -> mediana 3 -> High (3)
  assert.equal(calculateOverallDora([4, 3, 2]), 3);
  // (4, 4, 2) -> mediana 4 -> Elite (4)
  assert.equal(calculateOverallDora([4, 4, 2]), 4);

  // Todos nulos
  assert.equal(calculateOverallDora([]), null);
  assert.equal(calculateOverallDora([null, null]), null);
});

test('weightedCohenKappaLinear e compareClassifications conferem concordância e transições', () => {
  const y1 = [4, 4, 3, 2, 1];
  const y2 = [4, 4, 3, 2, 1];

  // Concordância perfeita
  const kPerf = weightedCohenKappaLinear(y1, y2, 4);
  assert.equal(kPerf, 1.0);

  const cmpPerf = compareClassifications(y1, y2, 4);
  assert.equal(cmpPerf.changed, 0);
  assert.equal(cmpPerf.same, 5);
  assert.equal(cmpPerf.changed_percent, 0.0);

  // Transições parciais
  const yA = [4, 3, 2, 1];
  const yB = [3, 3, 2, 2]; // 1º caiu (4->3), 4º subiu (1->2)
  const cmp = compareClassifications(yA, yB, 4);
  assert.equal(cmp.total, 4);
  assert.equal(cmp.changed, 2);
  assert.equal(cmp.upgraded, 1);
  assert.equal(cmp.downgraded, 1);
  assert.equal(cmp.changed_percent, 50.0);

  // Verificação de erro com tamanhos incompatíveis
  assert.throws(() => buildContingencyMatrix([1], [1, 2]), /Tamanhos incompatíveis/i);
  assert.throws(() => buildContingencyMatrix([0], [1]), /fora do intervalo/i);
  assert.throws(() => weightedCohenKappaLinear([], []), /não-vazios/i);
  assert.throws(() => compareClassifications([1], [1, 2]), /não-vazios/i);

  // Caso degenerado onde pe = 1.0 (todos na mesma categoria)
  assert.equal(weightedCohenKappaLinear([4, 4], [4, 4], 4), 1.0);
});

test('interpretKappa classifica as faixas de concordância', () => {
  assert.match(interpretKappa(-0.1), /Pobre/);
  assert.match(interpretKappa(0.15), /Leve/);
  assert.match(interpretKappa(0.35), /Razoável/);
  assert.match(interpretKappa(0.55), /Moderada/);
  assert.match(interpretKappa(0.75), /Substancial/);
  assert.match(interpretKappa(0.95), /Quase perfeita/);
});

test('rank e spearmanCorrelation calculam ordenação com empates e correlação de Spearman', () => {
  // Teste de postos com empates
  const vals = [10, 20, 20, 40];
  const rk = rank(vals);
  // Postos esperados: 10 -> 1, 20 e 20 -> (2+3)/2 = 2.5, 40 -> 4
  assert.deepEqual(rk, [1, 2.5, 2.5, 4]);

  // Correlação monotônica perfeita direta (rho = 1.0)
  const x = [1, 2, 3, 4, 5];
  const y = [10, 20, 30, 40, 50];
  assert.equal(spearmanCorrelation(x, y), 1.0);

  // Correlação monotônica perfeita inversa (rho = -1.0)
  const yInv = [50, 40, 30, 20, 10];
  assert.equal(spearmanCorrelation(x, yInv), -1.0);

  // Sem variação em Y -> correlação 0
  assert.equal(spearmanCorrelation(x, [5, 5, 5, 5, 5]), 0.0);

  // Erros de entrada inválida
  assert.throws(() => spearmanCorrelation([1], [1]), /pelo menos dois elementos/i);
  assert.throws(() => spearmanCorrelation([1, 2], [1]), /pelo menos dois elementos/i);
});


