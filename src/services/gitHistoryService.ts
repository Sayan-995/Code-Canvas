import { Octokit } from '@octokit/rest';
import { GitCommit, CommitFile } from '../store/useGitHistoryStore';

// Files/folders to exclude from visualization
const EXCLUDED_PATTERNS = [
  /node_modules\//,           // Anywhere in path
  /\/node_modules\//,         // With leading slash
  /^node_modules\//,          // At start
  /\.git\//,
  /\.github\//,
  /\.vscode\//,
  /\.idea\//,
  /\/dist\//,
  /^dist\//,
  /\/build\//,
  /^build\//,
  /\/coverage\//,
  /^coverage\//,
  /\.next\//,
  /\.nuxt\//,
  /package-lock\.json$/,
  /yarn\.lock$/,
  /pnpm-lock\.yaml$/,
  /\.env(\..+)?$/,
  /\.DS_Store$/,
  /Thumbs\.db$/,
  /\.min\.js$/,               // Minified files
  /\.min\.css$/,
  /\.map$/,                   // Source maps
  /\.chunk\./,                // Webpack chunks
];

// Config files to exclude (optional - can be toggled)
const CONFIG_PATTERNS = [
  /^tsconfig.*\.json$/,
  /^\.eslintrc/,
  /^\.prettierrc/,
  /^\.babelrc/,
  /^jest\.config/,
  /^vite\.config/,
  /^webpack\.config/,
  /^rollup\.config/,
  /^tailwind\.config/,
  /^postcss\.config/,
  /^\.gitignore$/,
  /^\.npmrc$/,
  /^\.nvmrc$/,
  /^Dockerfile$/,
  /^docker-compose/,
  /^Makefile$/,
];

function shouldIncludeFile(path: string, includeConfig: boolean = false): boolean {
  // Quick string checks for common exclusions
  if (path.includes('node_modules')) return false;
  if (path.includes('.git/')) return false;
  if (path.includes('/dist/') || path.startsWith('dist/')) return false;
  if (path.includes('/build/') || path.startsWith('build/')) return false;
  
  // Check excluded patterns
  for (const pattern of EXCLUDED_PATTERNS) {
    if (pattern.test(path)) return false;
  }
  
  // Optionally exclude config files
  if (!includeConfig) {
    const filename = path.split('/').pop() || '';
    for (const pattern of CONFIG_PATTERNS) {
      if (pattern.test(filename)) return false;
    }
  }
  
  return true;
}

export async function fetchCommitHistory(
  owner: string,
  repo: string,
  token?: string,
  maxCommits: number = 50
): Promise<GitCommit[]> {
  const octokit = new Octokit({ auth: token || undefined });

  // Fetch commit list
  const { data: commitsData } = await octokit.repos.listCommits({
    owner,
    repo,
    per_page: maxCommits,
  });

  // Fetch detailed info for each commit (includes files)
  const commits: GitCommit[] = [];

  console.log(`Fetching details for ${commitsData.length} commits...`);
  
  for (const commit of commitsData) {
    try {
      const { data: commitDetail } = await octokit.repos.getCommit({
        owner,
        repo,
        ref: commit.sha,
      });

      // Filter and map files, including patch data
      const files: CommitFile[] = (commitDetail.files || [])
        .filter((f) => shouldIncludeFile(f.filename))
        .map((f) => ({
          path: f.filename,
          status: mapStatus(f.status),
          additions: f.additions,
          deletions: f.deletions,
          patch: f.patch || undefined, // Include the diff patch
        }));

      commits.push({
        sha: commit.sha,
        message: commit.commit.message,
        author: {
          name: commit.commit.author?.name || 'Unknown',
          avatar: commit.author?.avatar_url || '',
          date: commit.commit.author?.date || '',
        },
        files,
      });
    } catch (e: any) {
      // Check for rate limiting
      if (e.status === 403 || e.status === 429) {
        console.error('GitHub API rate limit reached. Please provide a Personal Access Token for more requests.');
        break; // Stop fetching more commits
      }
      console.error(`Failed to fetch commit ${commit.sha}:`, e.message || e);
    }
  }
  
  console.log(`Successfully fetched ${commits.length} commits`);

  // Reverse to get chronological order (oldest first)
  return commits.reverse();
}

function mapStatus(status: string | undefined): CommitFile['status'] {
  switch (status) {
    case 'added':
      return 'added';
    case 'removed':
      return 'deleted';
    case 'modified':
      return 'modified';
    case 'renamed':
      return 'renamed';
    default:
      return 'modified';
  }
}

export function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 30) {
    return date.toLocaleDateString();
  } else if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  } else if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  } else if (diffMins > 0) {
    return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  } else {
    return 'Just now';
  }
}

// Parse patch string into structured diff lines
export function parsePatch(patch: string | undefined): { type: 'add' | 'remove' | 'context'; content: string }[] {
  if (!patch) return [];
  
  const lines = patch.split('\n');
  const result: { type: 'add' | 'remove' | 'context'; content: string }[] = [];
  
  for (const line of lines) {
    // Skip diff headers
    if (line.startsWith('@@')) continue;
    if (line.startsWith('diff --git')) continue;
    if (line.startsWith('index ')) continue;
    if (line.startsWith('---') || line.startsWith('+++')) continue;
    
    if (line.startsWith('+')) {
      result.push({ type: 'add', content: line.substring(1) });
    } else if (line.startsWith('-')) {
      result.push({ type: 'remove', content: line.substring(1) });
    } else {
      result.push({ type: 'context', content: line.startsWith(' ') ? line.substring(1) : line });
    }
  }
  
  return result;
}
