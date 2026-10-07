import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getReleases, getTags, compareCommits, collectReleasesAndCommits } from '../lib/releases.mjs';

test('getReleases filtra drafts e ordena cronologicamente', async () => {
  const api = {
    pages: async () => [
      { tag_name: 'v2.0', draft: false, prerelease: false, published_at: '2024-06-01T00:00:00Z' },
      { tag_name: 'v1.0', draft: false, prerelease: false, published_at: '2024-01-01T00:00:00Z' },
      { tag_name: 'v1.1-draft', draft: true, prerelease: false, published_at: '2024-02-01T00:00:00Z' },
      { tag_name: 'v1.5-beta', draft: false, prerelease: true, published_at: '2024-03-01T00:00:00Z' }
    ]
  };
  const list = await getReleases(api, 'demo/repo');
  assert.equal(list.length, 2);
  assert.equal(list[0].tag_name, 'v1.0');
  assert.equal(list[1].tag_name, 'v2.0');

  const withPre = await getReleases(api, 'demo/repo', true);
  assert.equal(withPre.length, 3);
  assert.equal(withPre[1].tag_name, 'v1.5-beta');
});

test('getTags lista tags e extrai sha', async () => {
  const api = {
    pages: async () => [{ name: 'v1.0', commit: { sha: 'abcdef' } }]
  };
  const tags = await getTags(api, 'demo/repo');
  assert.equal(tags.length, 1);
  assert.equal(tags[0].name, 'v1.0');
  assert.equal(tags[0].commit_sha, 'abcdef');
});

test('compareCommits suporta paginação e extrai campos de commits', async () => {
  let callCount = 0;
  const api = {
    get: async url => {
      callCount++;
      if (callCount === 1) {
        return {
          data: { total_commits: 2, commits: [{ sha: 'c1', commit: { author: { date: '2024-01-01T10:00:00Z' }, message: 'commit 1' } }] },
          next: 'https://api.github.com/compare/page2'
        };
      }
      return {
        data: { commits: [{ sha: 'c2', commit: { author: { date: '2024-01-02T10:00:00Z' }, message: 'commit 2' } }] },
        next: null
      };
    }
  };
  const res = await compareCommits(api, 'demo/repo', 'v1.0', 'v1.1');
  assert.equal(callCount, 2);
  assert.equal(res.commits.length, 2);
  assert.equal(res.commits[0].sha, 'c1');
  assert.equal(res.commits[1].sha, 'c2');
});

test('compareCommits trata 404 sem lançar exceção', async () => {
  const api = {
    get: async () => {
      throw new Error('GitHub HTTP 404 (/repos/demo/repo/compare/...). Verifique acesso e token.');
    }
  };
  const res = await compareCommits(api, 'demo/repo', 'v1.0', 'v1.1');
  assert.equal(res.error, 'not_found');
  assert.deepEqual(res.commits, []);
});

test('compareCommits propaga RATE_LIMIT_WAIT e erros genéricos', async () => {
  const errRate = new Error('Rate limit');
  errRate.code = 'RATE_LIMIT_WAIT';
  await assert.rejects(() => compareCommits({ get: async () => { throw errRate; } }, 'a/b', 'v1', 'v2'), /Rate limit/);
  await assert.rejects(() => compareCommits({ get: async () => { throw new Error('HTTP 500'); } }, 'a/b', 'v1', 'v2'), /HTTP 500/);
});

test('collectReleasesAndCommits orquestra janela, release anterior e 1ª release', async () => {
  const releases = [
    { tag_name: 'v0.9', draft: false, prerelease: false, published_at: '2023-12-15T00:00:00Z' }, // anterior à janela
    { tag_name: 'v1.0', draft: false, prerelease: false, published_at: '2024-02-01T00:00:00Z' }, // 1ª na janela, usa v0.9 como base
    { tag_name: 'v1.1', draft: false, prerelease: false, published_at: '2024-05-01T00:00:00Z' }, // 2ª na janela, usa v1.0
    { tag_name: 'v2.0', draft: false, prerelease: false, published_at: '2025-01-10T00:00:00Z' }  // posterior à janela
  ];
  const compared = [];
  const logs = [];
  const api = {
    pages: async () => releases,
    get: async url => {
      compared.push(url);
      return {
        data: {
          commits: [
            { sha: 'c10', commit: { author: { date: '2024-01-15T00:00:00Z' } } }
          ]
        },
        next: null
      };
    }
  };

  const start = '2024-01-01T00:00:00Z';
  const end = '2024-12-31T23:59:59Z';
  const res = await collectReleasesAndCommits(api, 'demo/repo', start, end, { log: msg => logs.push(msg) });

  assert.equal(res.length, 2);
  assert.equal(res[0].tag_name, 'v1.0');
  assert.equal(res[0].base_tag, 'v0.9');
  assert.equal(res[0].has_previous_release, true);
  assert.equal(res[0].commits.length, 1);
  assert.equal(res[0].commits[0].message, '');
  assert.ok(logs.length > 0);

  assert.equal(res[1].tag_name, 'v1.1');
  assert.equal(res[1].base_tag, 'v1.0');
  assert.equal(res[1].has_previous_release, true);
});

test('collectReleasesAndCommits identifica 1ª release da história', async () => {
  const releases = [
    { tag_name: 'v1.0', draft: false, prerelease: false, published_at: '2024-02-01T00:00:00Z' }
  ];
  const api = {
    pages: async () => releases,
    get: async () => assert.fail('Não deveria chamar compare para primeira release')
  };
  const res = await collectReleasesAndCommits(api, 'demo/repo', '2024-01-01T00:00:00Z', '2024-12-31T23:59:59Z');
  assert.equal(res.length, 1);
  assert.equal(res[0].has_previous_release, false);
  assert.equal(res[0].commits.length, 0);
});
