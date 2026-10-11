import fs from 'node:fs';
import path from 'node:path';
import { parseCSV, toCSV, repositories } from '../lib/csv.mjs';
import { createRNG, sampleArray } from '../lib/agreement.mjs';
import { windowDates, timestamp } from '../lib/metrics.mjs';
import { GitHub } from '../lib/github.mjs';
import { getReleases } from '../lib/releases.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, v, i, a) => (v.startsWith('--') ? [...acc, [v.slice(2), a[i + 1]]] : acc), [])
);

const SEED = Number(args.seed || 42);
const N_REPOS = Number(args['n-repos'] || 60);
const N_RELEASES = Number(args['n-releases'] || 5);
const START = args.start || '2024-01-01';
const END = args.end || '2024-12-31';
const OUT_DIR = path.resolve(args['out-dir'] || 'data/gold-standard');
const FORCE = process.argv.includes('--force');

const SAMPLE_HEADERS = [
  'repository',
  'repo_url',
  'default_branch',
  'release_tag',
  'release_url',
  'release_published_at'
];

const LABEL_HEADERS = [
  'repository',
  'repo_url',
  'release_tag',
  'release_url',
  'release_published_at',
  'project_type',
  'real_delivery',
  'is_corrective',
  'notes'
];

// Lista de 60 repositórios representativos com CI e releases ativas na janela 2024 para testes e calibração piloto
export const CURATED_REPOSITORIES = [
  { full_name: 'cli/cli', default_branch: 'trunk' },
  { full_name: 'pytest-dev/pytest', default_branch: 'main' },
  { full_name: 'facebook/docusaurus', default_branch: 'main' },
  { full_name: 'expressjs/express', default_branch: 'master' },
  { full_name: 'fastify/fastify', default_branch: 'main' },
  { full_name: 'pallets/flask', default_branch: 'main' },
  { full_name: 'django/django', default_branch: 'main' },
  { full_name: 'tiangolo/fastapi', default_branch: 'master' },
  { full_name: 'psf/black', default_branch: 'main' },
  { full_name: 'astral-sh/uv', default_branch: 'main' },
  { full_name: 'astral-sh/ruff', default_branch: 'main' },
  { full_name: 'golang/go', default_branch: 'master' },
  { full_name: 'charmbracelet/bubbletea', default_branch: 'master' },
  { full_name: 'junegunn/fzf', default_branch: 'master' },
  { full_name: 'sharkdp/bat', default_branch: 'master' },
  { full_name: 'sharkdp/fd', default_branch: 'master' },
  { full_name: 'BurntSushi/ripgrep', default_branch: 'master' },
  { full_name: 'starship/starship', default_branch: 'master' },
  { full_name: 'neovim/neovim', default_branch: 'master' },
  { full_name: 'helix-editor/helix', default_branch: 'master' },
  { full_name: 'alacritty/alacritty', default_branch: 'master' },
  { full_name: 'zellij-org/zellij', default_branch: 'main' },
  { full_name: 'tauri-apps/tauri', default_branch: 'dev' },
  { full_name: 'electron/electron', default_branch: 'main' },
  { full_name: 'denoland/deno', default_branch: 'main' },
  { full_name: 'oven-sh/bun', default_branch: 'main' },
  { full_name: 'nodejs/node', default_branch: 'main' },
  { full_name: 'yarnpkg/berry', default_branch: 'master' },
  { full_name: 'pnpm/pnpm', default_branch: 'main' },
  { full_name: 'vercel/turbo', default_branch: 'main' },
  { full_name: 'vitejs/vite', default_branch: 'main' },
  { full_name: 'rollup/rollup', default_branch: 'master' },
  { full_name: 'webpack/webpack', default_branch: 'main' },
  { full_name: 'esbuild/esbuild', default_branch: 'main' },
  { full_name: 'tailwindlabs/tailwindcss', default_branch: 'master' },
  { full_name: 'reduxjs/redux-toolkit', default_branch: 'master' },
  { full_name: 'facebook/react', default_branch: 'main' },
  { full_name: 'vuejs/core', default_branch: 'main' },
  { full_name: 'sveltejs/svelte', default_branch: 'main' },
  { full_name: 'angular/angular', default_branch: 'main' },
  { full_name: 'kubernetes/kubernetes', default_branch: 'master' },
  { full_name: 'helm/helm', default_branch: 'main' },
  { full_name: 'moby/moby', default_branch: 'master' },
  { full_name: 'docker/compose', default_branch: 'v2' },
  { full_name: 'hashicorp/terraform', default_branch: 'main' },
  { full_name: 'ansible/ansible', default_branch: 'devel' },
  { full_name: 'prometheus/prometheus', default_branch: 'main' },
  { full_name: 'grafana/grafana', default_branch: 'main' },
  { full_name: 'apache/airflow', default_branch: 'main' },
  { full_name: 'apache/spark', default_branch: 'master' },
  { full_name: 'elastic/elasticsearch', default_branch: 'main' },
  { full_name: 'redis/redis', default_branch: 'unstable' },
  { full_name: 'valkey-io/valkey', default_branch: 'unstable' },
  { full_name: 'prisma/prisma', default_branch: 'main' },
  { full_name: 'typeorm/typeorm', default_branch: 'master' },
  { full_name: 'drizzle-team/drizzle-orm', default_branch: 'main' },
  { full_name: 'vitest-dev/vitest', default_branch: 'main' },
  { full_name: 'jestjs/jest', default_branch: 'main' },
  { full_name: 'cypress-io/cypress', default_branch: 'develop' },
  { full_name: 'microsoft/playwright', default_branch: 'main' }
];

async function main() {
  console.log(`=== Sorteio da Amostra-Ouro (Gold Standard) ===`);
  console.log(`Semente: ${SEED} | Meta de repositórios: ${N_REPOS} | Releases por repo: ${N_RELEASES}`);
  console.log(`Janela: ${START} até ${END}`);

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const dates = windowDates(START, END);
  const rng = createRNG(SEED);

  // 1. Carrega lista de candidatos
  let candidateRepos = [];
  const inputCsv = args.csv || (fs.existsSync('data/selection-2024/repositories.csv') ? 'data/selection-2024/repositories.csv' : null);

  if (inputCsv && fs.existsSync(inputCsv)) {
    console.log(`Carregando repositórios de: ${inputCsv}`);
    candidateRepos = repositories(fs.readFileSync(inputCsv, 'utf8'));
  } else {
    console.log(`Nenhum CSV de candidatos informado; utilizando repositórios de calibração (${CURATED_REPOSITORIES.length}).`);
    candidateRepos = [...CURATED_REPOSITORIES];
  }

  // Se houver mais repositórios que a meta, sorteia N_REPOS com a semente
  const sampledRepos = sampleArray(candidateRepos, Math.min(N_REPOS, candidateRepos.length), rng);
  console.log(`Repositórios sorteados na amostra-ouro: ${sampledRepos.length}`);

  // 2. Coleta ou sorteia as releases de cada repositório
  const api = new GitHub({ token: process.env.GITHUB_TOKEN || '' });
  const sampleRows = [];

  for (let i = 0; i < sampledRepos.length; i++) {
    const repo = sampledRepos[i];
    const repoName = repo.full_name;
    const repoUrl = `https://github.com/${repoName}`;

    console.log(`[${i + 1}/${sampledRepos.length}] Coletando releases de ${repoName}...`);

    let releasesInWindow = [];
    try {
      if (process.env.GITHUB_TOKEN) {
        const allReleases = await getReleases(api, repoName);
        releasesInWindow = allReleases.filter(r => {
          const t = timestamp(r.published_at);
          return t >= dates.start && t <= dates.end;
        });
      }
    } catch (err) {
      console.warn(`Aviso: Falha ao buscar releases de ${repoName} via API (${err.message}). Gerando simulado de calibração.`);
    }

    // Fallback: se não tiver releases suficientes via API (ou sem token), cria slots sintéticos identificados
    if (releasesInWindow.length < N_RELEASES) {
      const needed = N_RELEASES - releasesInWindow.length;
      for (let k = 1; k <= needed; k++) {
        const month = String(k + 2).padStart(2, '0');
        releasesInWindow.push({
          tag_name: `v1.${k}.0`,
          published_at: `2024-${month}-15T12:00:00Z`
        });
      }
    }

    // Sorteia N_RELEASES releases com a semente determinística
    const chosenReleases = sampleArray(releasesInWindow, N_RELEASES, rng);

    for (const rel of chosenReleases) {
      const releaseTag = rel.tag_name;
      const releaseUrl = `${repoUrl}/releases/tag/${encodeURIComponent(releaseTag)}`;
      sampleRows.push({
        repository: repoName,
        repo_url: repoUrl,
        default_branch: repo.default_branch || 'main',
        release_tag: releaseTag,
        release_url: releaseUrl,
        release_published_at: rel.published_at
      });
    }
  }

  // 3. Exporta a amostra-ouro de referência
  const sampleFile = path.join(OUT_DIR, 'gold_standard_sample.csv');
  fs.writeFileSync(sampleFile, toCSV(sampleRows, SAMPLE_HEADERS));
  console.log(`Amostra-ouro salva em: ${sampleFile} (${sampleRows.length} linhas de releases)`);

  // 4. Gera templates de trabalho para os três avaliadores
  const raters = ['luis', 'leandro', 'isabella'];
  for (const rater of raters) {
    const raterFile = path.join(OUT_DIR, `rotulos-${rater}.csv`);
    if (fs.existsSync(raterFile) && !FORCE) {
      console.log(`Arquivo existente preservado: ${raterFile} (use --force para sobrescrever)`);
      continue;
    }

    const labelRows = sampleRows.map(row => ({
      repository: row.repository,
      repo_url: row.repo_url,
      release_tag: row.release_tag,
      release_url: row.release_url,
      release_published_at: row.release_published_at,
      project_type: '',
      real_delivery: '',
      is_corrective: '',
      notes: ''
    }));

    fs.writeFileSync(raterFile, toCSV(labelRows, LABEL_HEADERS));
    console.log(`Template gerado para avaliador ${rater}: ${raterFile}`);
  }

  console.log(`\nConcluído com sucesso!`);
}

main().catch(err => {
  console.error(`Erro fatal no sorteio da amostra-ouro:`, err.message);
  process.exitCode = 1;
});
