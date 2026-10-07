import fs from 'node:fs';
import path from 'node:path';
import { GitHub } from '../lib/github.mjs';
import { parseCSV, repositories, toCSV } from '../lib/csv.mjs';
import { windowDates, calculateLeadTime } from '../lib/metrics.mjs';
import { collectReleasesAndCommits } from '../lib/releases.mjs';

try {
  const args = {};
  for (let i = 2; i < process.argv.length; i += 2) {
    const key = process.argv[i];
    if (!['--config', '--csv', '--start', '--end', '--limit', '--output'].includes(key) || !process.argv[i + 1]) {
      throw new Error(`Argumento inválido ou sem valor: ${key}\nUso: node scripts/collect-releases.mjs [--config config.json] [--csv repositories.csv] [--start AAAA-MM-DD] [--end AAAA-MM-DD] [--limit N] [--output pasta]`);
    }
    args[key.slice(2)] = process.argv[i + 1];
  }
  const config = fs.existsSync(args.config || 'config.json') ? JSON.parse(fs.readFileSync(args.config || 'config.json', 'utf8')) : {};
  const start = args.start || config.start;
  const end = args.end || config.end;
  if (!start || !end) throw new Error('Informe --start e --end (AAAA-MM-DD) ou defina-os no config.json.');
  const { start: startMs, end: endMs } = windowDates(start, end);

  const outputDir = path.resolve(args.output || config.outputDir || 'data/releases-2024');
  fs.mkdirSync(outputDir, { recursive: true });

  let csvPath = args.csv;
  if (!csvPath) {
    const candidatePath = path.join(config.outputDir || '', 'repositories.csv');
    if (fs.existsSync(candidatePath)) csvPath = candidatePath;
    else if (fs.existsSync('examples/repositories.csv')) csvPath = 'examples/repositories.csv';
    else throw new Error('Arquivo de repositórios não encontrado. Use --csv <caminho>.');
  }

  const rawRepos = repositories(fs.readFileSync(csvPath, 'utf8'));
  const targetRepos = args.limit ? rawRepos.slice(0, Number(args.limit)) : rawRepos;

  const controller = new AbortController();
  process.on('SIGINT', () => controller.abort());

  const api = new GitHub({
    token: process.env.GITHUB_TOKEN || '',
    cacheDir: path.join(outputDir, 'cache'),
    signal: controller.signal,
    log: console.log,
    maxRateLimitWaitMs: config.maxRateLimitWaitMs ?? Infinity
  });

  const releasesRows = [];
  const commitsRows = [];
  const metricsRows = [];
  const errors = [];

  function save(status, errorMessage = '') {
    const releaseHeaders = [
      'repository', 'tag_name', 'published_at', 'base_tag',
      'has_previous_release', 'commits_count', 'lead_time_hours',
      'lead_time_days', 'compare_error'
    ];
    const commitHeaders = [
      'repository', 'release_tag', 'release_published_at',
      'commit_sha', 'author_date', 'lead_time_hours', 'lead_time_days'
    ];
    const metricHeaders = [
      'repository', 'default_branch', 'releases_in_window', 'releases_evaluated',
      'releases_ignored', 'releases_ignored_no_previous', 'releases_ignored_compare_error',
      'releases_ignored_no_commits', 'commits_total', 'deployment_frequency',
      'lead_time_release_median_hours', 'lead_time_release_iqr_hours',
      'lead_time_release_median_days', 'lead_time_release_iqr_days',
      'lead_time_commit_median_hours', 'lead_time_commit_iqr_hours',
      'lead_time_commit_median_days', 'lead_time_commit_iqr_days',
      'eligible_releases', 'error'
    ];

    fs.writeFileSync(path.join(outputDir, 'releases.csv'), toCSV(releasesRows, releaseHeaders));
    fs.writeFileSync(path.join(outputDir, 'commits.csv'), toCSV(commitsRows, commitHeaders));
    fs.writeFileSync(path.join(outputDir, 'lead_time_metrics.csv'), toCSV(metricsRows, metricHeaders));
    fs.writeFileSync(path.join(outputDir, 'collection.json'), JSON.stringify({
      status,
      error: errorMessage,
      window: { start, end },
      total_target: targetRepos.length,
      processed: metricsRows.length,
      errors_count: errors.length,
      updated_at: new Date().toISOString()
    }, null, 2));
  }

  save('running');

  for (let i = 0; i < targetRepos.length; i++) {
    controller.signal.throwIfAborted();
    const repo = targetRepos[i];
    console.log(`[${i + 1}/${targetRepos.length}] Coletando releases: ${repo.full_name}`);

    try {
      const releasesData = await collectReleasesAndCommits(api, repo.full_name, startMs, endMs, { log: console.log });
      const stats = calculateLeadTime(releasesData, endMs, startMs);

      for (const r of releasesData) {
        const evalInfo = stats.evaluated_releases.find(e => e.tag_name === r.tag_name);
        releasesRows.push({
          repository: repo.full_name,
          tag_name: r.tag_name,
          published_at: r.published_at,
          base_tag: r.base_tag || '',
          has_previous_release: r.has_previous_release,
          commits_count: r.commits.length,
          lead_time_hours: evalInfo ? evalInfo.lead_time_hours : '',
          lead_time_days: evalInfo ? evalInfo.lead_time_days : '',
          compare_error: r.compare_error || ''
        });

        const pubMs = Date.parse(r.published_at);
        for (const c of r.commits) {
          const authMs = Date.parse(c.author_date);
          const diffHours = (pubMs - authMs) / 3600000;
          commitsRows.push({
            repository: repo.full_name,
            release_tag: r.tag_name,
            release_published_at: r.published_at,
            commit_sha: c.sha,
            author_date: c.author_date,
            lead_time_hours: diffHours,
            lead_time_days: diffHours / 24
          });
        }
      }

      metricsRows.push({
        repository: repo.full_name,
        default_branch: repo.default_branch,
        releases_in_window: stats.releases_in_window,
        releases_evaluated: stats.releases_evaluated,
        releases_ignored: stats.releases_ignored,
        releases_ignored_no_previous: stats.releases_ignored_no_previous,
        releases_ignored_compare_error: stats.releases_ignored_compare_error,
        releases_ignored_no_commits: stats.releases_ignored_no_commits,
        commits_total: stats.commits_total,
        deployment_frequency: stats.deployment_frequency ?? '',
        lead_time_release_median_hours: stats.lead_time_release_median_hours ?? '',
        lead_time_release_iqr_hours: stats.lead_time_release_iqr_hours ?? '',
        lead_time_release_median_days: stats.lead_time_release_median_days ?? '',
        lead_time_release_iqr_days: stats.lead_time_release_iqr_days ?? '',
        lead_time_commit_median_hours: stats.lead_time_commit_median_hours ?? '',
        lead_time_commit_iqr_hours: stats.lead_time_commit_iqr_hours ?? '',
        lead_time_commit_median_days: stats.lead_time_commit_median_days ?? '',
        lead_time_commit_iqr_days: stats.lead_time_commit_iqr_days ?? '',
        eligible_releases: stats.eligible_releases,
        error: ''
      });
    } catch (err) {
      controller.signal.throwIfAborted();
      if (err.code === 'RATE_LIMIT_WAIT') throw err;
      errors.push({ repository: repo.full_name, error: err.message });
      metricsRows.push({
        repository: repo.full_name,
        default_branch: repo.default_branch,
        releases_in_window: '',
        releases_evaluated: '',
        releases_ignored: '',
        releases_ignored_no_previous: '',
        releases_ignored_compare_error: '',
        releases_ignored_no_commits: '',
        commits_total: '',
        deployment_frequency: '',
        lead_time_release_median_hours: '',
        lead_time_release_iqr_hours: '',
        lead_time_release_median_days: '',
        lead_time_release_iqr_days: '',
        lead_time_commit_median_hours: '',
        lead_time_commit_iqr_hours: '',
        lead_time_commit_median_days: '',
        lead_time_commit_iqr_days: '',
        eligible_releases: false,
        error: err.message
      });
    }

    save('running');
  }

  const finalStatus = errors.length ? 'partial' : 'completed';
  save(finalStatus);
  console.log(`Concluído! Status: ${finalStatus}. Arquivos salvos em ${outputDir}`);
  if (errors.length) process.exitCode = 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
