import { timestamp } from './metrics.mjs';

export async function getReleases(api, repo, includePrereleases = false) {
  const all = await api.pages(`/repos/${repo}/releases?per_page=100`);
  return all
    .filter(r => !r.draft && (includePrereleases || !r.prerelease))
    .sort((a, b) => timestamp(a.published_at) - timestamp(b.published_at));
}

export async function getTags(api, repo) {
  const tags = await api.pages(`/repos/${repo}/tags?per_page=100`);
  return tags.map(t => ({ name: t.name, commit_sha: t.commit?.sha }));
}

export async function compareCommits(api, repo, baseTag, headTag) {
  const baseHead = `${encodeURIComponent(baseTag)}...${encodeURIComponent(headTag)}`;
  const url = `/repos/${repo}/compare/${baseHead}?per_page=100`;
  try {
    const first = await api.get(url);
    const commits = [...(first.data?.commits || [])];
    let next = first.next;
    while (next) {
      const page = await api.get(next);
      commits.push(...(page.data?.commits || []));
      next = page.next;
    }
    const unique=new Set(commits.map(c=>c.sha));
    if(unique.size!==commits.length||Number.isInteger(first.data?.total_commits)&&unique.size!==first.data.total_commits)throw new Error('Paginação de commits incompleta ou duplicada. Retome A para tentar novamente.');
    return {
      total_commits: first.data?.total_commits ?? commits.length,
      collection_method: first.collection_method || 'github-api',
      base_sha: first.base_sha || first.data?.base_commit?.sha || '',
      head_sha: first.head_sha || '',
      commits: commits.map(c => ({
        sha: c.sha,
        author_date: c.commit?.author?.date,
        message: c.commit?.message || ''
      }))
    };
  } catch (error) {
    if(error.code==='COMPARE_UNAVAILABLE')return {error:error.compare_error,commits:[]};
    if (error.code === 'RATE_LIMIT_WAIT') throw error;
    if (/HTTP 404/.test(error.message)) {
      return { error: 'not_found', commits: [] };
    }
    throw error;
  }
}

export async function collectReleasesAndCommits(api, repo, windowStart, windowEnd, { log = () => {} } = {}) {
  const start = typeof windowStart === 'number' ? windowStart : timestamp(windowStart);
  const end = typeof windowEnd === 'number' ? windowEnd : timestamp(windowEnd);

  log(`Coletando releases de ${repo}`);
  const releases = await getReleases(api, repo);
  const windowReleases = [];

  for (let i = 0; i < releases.length; i++) {
    const r = releases[i];
    const pub = timestamp(r.published_at);
    if (pub < start || pub > end) continue;

    const base = i > 0 ? releases[i - 1].tag_name : null;
    const hasPrevious = i > 0;

    let compareResult = { commits: [] };
    if (hasPrevious) {
      log(`${repo}: comparando ${base}...${r.tag_name}`);
      compareResult = await compareCommits(api, repo, base, r.tag_name);
    }

    windowReleases.push({
      tag_name: r.tag_name,
      name: r.name || '',
      body: r.body || '',
      html_url: r.html_url || '',
      published_at: r.published_at,
      base_tag: base || '',
      has_previous_release: hasPrevious,
      compare_error: compareResult.error || '',
      collection_method: compareResult.collection_method || 'no_previous_release',
      base_sha: compareResult.base_sha || '',
      head_sha: compareResult.head_sha || '',
      commits: compareResult.commits || []
    });
  }

  return windowReleases;
}
