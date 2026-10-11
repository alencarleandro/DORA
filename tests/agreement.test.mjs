import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateRaters,
  fleissKappa,
  interpretKappa,
  calculateDimensionAgreement,
  createRNG,
  sampleArray
} from '../lib/agreement.mjs';

test('exemplo clássico de Fleiss (1971) reproduz valores tabelados', () => {
  // Tabela clássica de 10 sujeitos, 5 categorias e 14 avaliadores (Fleiss 1971 / Wikipedia)
  const classicTable = [
    [0, 0, 0, 0, 14],
    [0, 2, 6, 4, 2],
    [0, 0, 3, 5, 6],
    [0, 3, 9, 2, 0],
    [2, 2, 8, 1, 1],
    [7, 7, 0, 0, 0],
    [3, 2, 6, 3, 0],
    [2, 5, 3, 2, 2],
    [6, 5, 2, 1, 0],
    [0, 2, 2, 3, 7]
  ];

  const res = fleissKappa(classicTable);

  // Valores canônicos: P_bar ~ 0.378, P_e ~ 0.213, kappa ~ 0.210 (razoável)
  assert.ok(Math.abs(res.observedAgreement - 0.378) < 0.001);
  assert.ok(Math.abs(res.chanceAgreement - 0.213) < 0.001);
  assert.ok(Math.abs(res.kappa - 0.210) < 0.001);
  assert.equal(res.subjectsCount, 10);
  assert.equal(res.ratersCount, 14);
  assert.equal(res.categoriesCount, 5);

  const interp = interpretKappa(res.kappa);
  assert.equal(interp.code, 'razoavel');
});

test('concordância perfeita resulta em kappa = 1.0', () => {
  const rawData = [
    ['catA', 'catA', 'catA'],
    ['catB', 'catB', 'catB'],
    ['catC', 'catC', 'catC'],
    ['catA', 'catA', 'catA']
  ];

  const { table, categories } = aggregateRaters(rawData);
  assert.equal(categories.length, 3);
  assert.deepEqual(table, [
    [3, 0, 0],
    [0, 3, 0],
    [0, 0, 3],
    [3, 0, 0]
  ]);

  const res = fleissKappa(table);
  assert.equal(res.kappa, 1.0);
  assert.equal(res.observedAgreement, 1.0);

  const interp = interpretKappa(res.kappa);
  assert.equal(interp.code, 'quase_perfeita');
});

test('concordância em uma única categoria para todos os itens tem kappa = 1.0', () => {
  const table = [
    [3, 0],
    [3, 0],
    [3, 0]
  ];
  const res = fleissKappa(table);
  assert.equal(res.kappa, 1.0);
  assert.equal(res.chanceAgreement, 1.0);
});

test('discordância extrema com categorias distribuídas produz kappa negativo (pobre)', () => {
  // 3 avaliadores distribuídos igualmente em padrão cíclico
  const rawData = [
    ['A', 'B', 'C'],
    ['B', 'C', 'A'],
    ['C', 'A', 'B']
  ];

  const { table } = aggregateRaters(rawData);
  const res = fleissKappa(table);

  assert.ok(res.kappa < 0);
  const interp = interpretKappa(res.kappa);
  assert.equal(interp.code, 'pobre');
});

test('faixas de interpretação de Landis & Koch (1977)', () => {
  assert.equal(interpretKappa(-0.1).code, 'pobre');
  assert.equal(interpretKappa(0.0).code, 'leve');
  assert.equal(interpretKappa(0.15).code, 'leve');
  assert.equal(interpretKappa(0.20).code, 'leve');
  assert.equal(interpretKappa(0.21).code, 'razoavel');
  assert.equal(interpretKappa(0.35).code, 'razoavel');
  assert.equal(interpretKappa(0.40).code, 'razoavel');
  assert.equal(interpretKappa(0.41).code, 'moderada');
  assert.equal(interpretKappa(0.55).code, 'moderada');
  assert.equal(interpretKappa(0.60).code, 'moderada');
  assert.equal(interpretKappa(0.61).code, 'substancial');
  assert.equal(interpretKappa(0.75).code, 'substancial');
  assert.equal(interpretKappa(0.80).code, 'substancial');
  assert.equal(interpretKappa(0.81).code, 'quase_perfeita');
  assert.equal(interpretKappa(1.0).code, 'quase_perfeita');
  assert.throws(() => interpretKappa('invalido'), /número válido/);
});

test('aggregateRaters com categorias fixas e tratamento de erros', () => {
  const data = [
    ['sim', 'nao', 'sim'],
    ['nao', 'nao', 'nao']
  ];

  const { table, categories } = aggregateRaters(data, ['nao', 'sim', 'incerto']);
  assert.deepEqual(categories, ['nao', 'sim', 'incerto']);
  assert.deepEqual(table, [
    [1, 2, 0],
    [3, 0, 0]
  ]);

  // Erros esperados
  assert.throws(() => aggregateRaters([]), /não vazio/);
  assert.throws(() => aggregateRaters([['a']]), /pelo menos 2 avaliadores/);
  assert.throws(() => aggregateRaters([['a', 'b'], ['a']]), /mesmo número de avaliadores/);
  assert.throws(() => aggregateRaters([['', '']]), /Nenhuma categoria válida/);
  assert.throws(() => aggregateRaters([['a', 'b']], ['a']), /Valor de categoria desconhecido/);
});

test('fleissKappa valida consistência de linhas, avaliadores e categorias', () => {
  assert.throws(() => fleissKappa([]), /não vazia/);
  assert.throws(() => fleissKappa([[3]]), /pelo menos 2 categorias/);
  assert.throws(() => fleissKappa([[1, 0]]), /pelo menos 2 avaliações/);
  assert.throws(() => fleissKappa([[2, 1], [3]]), /mesmo número de categorias/);
  assert.throws(() => fleissKappa([[2, 1], [1, 1]]), /Número inconsistente de avaliadores/);
});

test('calculateDimensionAgreement funciona com objetos de sujeitos', () => {
  const items = [
    { subjectId: 'repo1', raters: { luis: 'cli', leandro: 'cli', isabella: 'cli' } },
    { subjectId: 'repo2', raters: { luis: 'lib', leandro: 'lib', isabella: 'cli' } },
    { subjectId: 'repo3', raters: { luis: 'app', leandro: 'app', isabella: 'app' } }
  ];

  const res = calculateDimensionAgreement(items, ['app', 'cli', 'lib', 'outro']);
  assert.equal(res.subjectsCount, 3);
  assert.equal(res.ratersCount, 3);
  assert.equal(res.categoriesCount, 4);
  assert.deepEqual(res.raters, ['isabella', 'leandro', 'luis']);
  assert.ok(res.kappa > 0.6); // alta concordância
  assert.ok(['substancial', 'quase_perfeita'].includes(res.interpretation.code));

  assert.throws(() => calculateDimensionAgreement([]), /Nenhum item fornecido/);
});

test('createRNG e sampleArray são determinísticos com semente fixa', () => {
  const rng1 = createRNG(42);
  const val1 = rng1();
  const val2 = rng1();

  const rng2 = createRNG(42);
  assert.equal(rng2(), val1);
  assert.equal(rng2(), val2);

  const items = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  const s1 = sampleArray(items, 4, createRNG(42));
  const s2 = sampleArray(items, 4, createRNG(42));
  assert.deepEqual(s1, s2);
  assert.equal(s1.length, 4);

  // Casos de borda
  assert.deepEqual(sampleArray(items, 0), []);
  assert.deepEqual(sampleArray(items, 20).length, 10);
  assert.throws(() => sampleArray('não array', 2), /deve ser um array/);
});

