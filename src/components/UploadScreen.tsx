import React, { useState } from 'react';
import { useFileStore, FileStructure } from '../store/useFileStore';
import { Github, FolderUp, Loader2 } from 'lucide-react';
import { Octokit } from '@octokit/rest';
import { analyzeCode } from '../utils/codeAnalyzer';

export const UploadScreen: React.FC = () => {
  const { setFiles, setGitHubContext } = useFileStore();
  const [loading, setLoading] = useState(false);
  const [repoUrl, setRepoUrl] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [error, setError] = useState('');

  const processFiles = (files: FileStructure[]) => {
    return files.map(file => {
      if (file.language === 'typescript' || file.language === 'javascript') {
        try {
          const analysis = analyzeCode(file.path, file.content);
          return { ...file, analysis };
        } catch (e) {
          console.error(`Failed to analyze ${file.path}`, e);
          return file;
        }
      }
      return file;
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList) return;

    setLoading(true);
    setError('');
    const newFiles: FileStructure[] = [];

    try {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        if (file.webkitRelativePath.includes('node_modules') || file.webkitRelativePath.includes('.git')) {
          continue;
        }

        const text = await file.text();
        newFiles.push({
          path: file.webkitRelativePath,
          name: file.name,
          content: text,
          language: getLanguage(file.name),
        });
      }
      
      const analyzedFiles = processFiles(newFiles);
      setFiles(analyzedFiles);
    } catch (err) {
      console.error(err);
      setError('Failed to process files');
    } finally {
      setLoading(false);
    }
  };

  const handleGithubImport = async () => {
    if (!repoUrl) return;
    setLoading(true);
    setError('');

    try {
      const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (!match) {
        throw new Error('Invalid GitHub URL');
      }
      const owner = match[1];
      const repo = match[2];

      const octokit = new Octokit({
        auth: githubToken || undefined
      });

      const { data: repoData } = await octokit.repos.get({
        owner,
        repo,
      });
      const defaultBranch = repoData.default_branch;

      // Get the commit SHA of the default branch
      const { data: refData } = await octokit.git.getRef({
        owner,
        repo,
        ref: `heads/${defaultBranch}`,
      });
      const latestCommitSha = refData.object.sha;

      const { data: treeData } = await octokit.git.getTree({
        owner,
        repo,
        tree_sha: latestCommitSha,
        recursive: 'true',
      });

      const newFiles: FileStructure[] = [];
      
      const filesToFetch = treeData.tree.filter((node: any) => node.type === 'blob' && !node.path.includes('package-lock.json') && !node.path.includes('yarn.lock'));

      for (const node of filesToFetch) {
         if (isRelevantFile(node.path)) {
            const { data: contentData } = await octokit.git.getBlob({
                owner,
                repo,
                file_sha: node.sha,
            });
            
            const content = atob(contentData.content.replace(/\n/g, ''));
            newFiles.push({
                path: node.path,
                name: node.path.split('/').pop() || node.path,
                content: content,
                lastSyncedContent: content, // Track original content for conflict detection
                language: getLanguage(node.path),
            });
         }
      }

      const analyzedFiles = processFiles(newFiles);
      setFiles(analyzedFiles);
      setGitHubContext({ owner, repo, branch: defaultBranch, token: githubToken, sha: latestCommitSha });

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to import from GitHub');
    } finally {
      setLoading(false);
    }
  };

  const isRelevantFile = (path: string) => {
      return !path.includes('node_modules') && 
             !path.includes('.git') && 
             !path.endsWith('.png') && 
             !path.endsWith('.jpg') &&
             !path.endsWith('.ico');
  }

  const getLanguage = (filename: string) => {
    if (filename.endsWith('.tsx') || filename.endsWith('.ts')) return 'typescript';
    if (filename.endsWith('.jsx') || filename.endsWith('.js')) return 'javascript';
    if (filename.endsWith('.css')) return 'css';
    if (filename.endsWith('.json')) return 'json';
    return 'plaintext';
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white p-4">
      <h1 className="text-4xl font-bold mb-8">Code Canvas</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
        {/* Local Upload */}
        <div className="bg-gray-800 p-8 rounded-xl border border-gray-700 hover:border-blue-500 transition-colors flex flex-col items-center gap-4">
          <FolderUp size={48} className="text-blue-400" />
          <h2 className="text-2xl font-semibold">Upload Folder</h2>
          <p className="text-gray-400 text-center">Select a folder from your local machine to visualize.</p>
          <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors">
            Choose Folder
            <input
              type="file"
              className="hidden"
              // @ts-ignore
              webkitdirectory=""
              directory=""
              multiple
              onChange={handleFileUpload}
            />
          </label>
        </div>

        {/* GitHub Import */}
        <div className="bg-gray-800 p-8 rounded-xl border border-gray-700 hover:border-purple-500 transition-colors flex flex-col items-center gap-4">
          <Github size={48} className="text-purple-400" />
          <h2 className="text-2xl font-semibold">GitHub Repo</h2>
          <p className="text-gray-400 text-center">Import a repository to visualize and edit.</p>
          <div className="flex flex-col w-full gap-2">
            <input
              type="text"
              placeholder="https://github.com/owner/repo"
              className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
            />
            <input
              type="password"
              placeholder="Personal Access Token (Optional for public, Required for private/write)"
              className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500 text-sm"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
            />
            <button
              onClick={handleGithubImport}
              disabled={!repoUrl || loading}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Import
            </button>
          </div>
        </div>
      </div>

      {loading && (
        <div className="mt-8 flex items-center gap-2 text-blue-400">
          <Loader2 className="animate-spin" />
          <span>Processing files...</span>
        </div>
      )}

      {error && (
        <div className="mt-8 text-red-400">
          {error}
        </div>
      )}
    </div>
  );
};
