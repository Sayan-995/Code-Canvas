import React, { useState } from 'react';
import { useFileStore, FileStructure, FileSegment } from '../store/useFileStore';
import { Github, FolderUp, Loader2 } from 'lucide-react';
import { Octokit } from '@octokit/rest';
import { analyzeCode } from '../utils/codeAnalyzer';
import { categorizeRepository } from '../services/repoSeparator';
import { RepoSegmentSelector } from './RepoSegmentSelector';

interface GitHubTreeNode {
  path: string;
  sha: string;
  type: string;
}

interface PendingGitHubData {
  owner: string;
  repo: string;
  branch: string;
  sha: string;
  tree: GitHubTreeNode[];
  octokit: Octokit;
}

export const UploadScreen: React.FC = () => {
  const { setFiles, setGitHubContext, setCachedRepoData } = useFileStore();
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [error, setError] = useState('');
  const [videoEnded, setVideoEnded] = useState(false);
  
  // Segmentation state
  const [segments, setSegments] = useState<FileSegment[] | null>(null);
  const [pendingGitHubData, setPendingGitHubData] = useState<PendingGitHubData | null>(null);
  const [pendingLocalFiles, setPendingLocalFiles] = useState<FileStructure[] | null>(null);
  const [isLoadingSelected, setIsLoadingSelected] = useState(false);

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

  const getLanguage = (filename: string) => {
    if (filename.endsWith('.tsx') || filename.endsWith('.ts')) return 'typescript';
    if (filename.endsWith('.jsx') || filename.endsWith('.js')) return 'javascript';
    if (filename.endsWith('.css')) return 'css';
    if (filename.endsWith('.json')) return 'json';
    return 'plaintext';
  };


  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList) return;

    setLoading(true);
    setVideoEnded(false);
    setLoadingMessage('Reading files...');
    setError('');

    try {
      const newFiles: FileStructure[] = [];
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

      setLoadingMessage('AI is categorizing your repository...');
      const filePaths = newFiles.map(f => f.path);
      const result = await categorizeRepository(filePaths);
      
      setPendingLocalFiles(newFiles);
      setSegments(result.segments);
    } catch (err) {
      console.error(err);
      setError('Failed to process files');
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  const handleGithubImport = async () => {
    if (!repoUrl) return;
    setLoading(true);
    setVideoEnded(false);
    setLoadingMessage('Fetching repository structure...');
    setError('');

    try {
      const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (!match) throw new Error('Invalid GitHub URL');
      
      const owner = match[1];
      const repo = match[2];
      const octokit = new Octokit({ auth: githubToken || undefined });

      const { data: repoData } = await octokit.repos.get({ owner, repo });
      const defaultBranch = repoData.default_branch;

      const { data: refData } = await octokit.git.getRef({
        owner, repo, ref: `heads/${defaultBranch}`,
      });
      const latestCommitSha = refData.object.sha;

      const { data: treeData } = await octokit.git.getTree({
        owner, repo, tree_sha: latestCommitSha, recursive: 'true',
      });

      const allFiles = treeData.tree.filter((node: any) => 
        node.type === 'blob' && 
        !node.path.includes('node_modules') && 
        !node.path.includes('.git') &&
        !node.path.includes('package-lock.json') &&
        !node.path.includes('yarn.lock')
      );

      setLoadingMessage('AI is categorizing your repository...');
      const filePaths = allFiles.map((f: any) => f.path);
      const result = await categorizeRepository(filePaths);

      setPendingGitHubData({
        owner, repo, branch: defaultBranch, sha: latestCommitSha,
        tree: allFiles as GitHubTreeNode[], octokit
      });
      setSegments(result.segments);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to import from GitHub');
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };


  const handleSegmentConfirm = async (selectedFiles: string[], selectedCategories: Set<string>) => {
    setIsLoadingSelected(true);
    
    try {
      if (pendingLocalFiles && segments) {
        // Local files - process all, then filter for display
        const analyzed = processFiles(pendingLocalFiles);
        const filtered = analyzed.filter(f => selectedFiles.includes(f.path));
        
        setFiles(filtered);
        setCachedRepoData({
          segments,
          allFiles: analyzed,
          selectedCategories
        });
      } else if (pendingGitHubData && segments) {
        // GitHub - fetch only selected files initially, store tree for lazy loading
        const { owner, repo, branch, sha, tree, octokit } = pendingGitHubData;
        const selectedSet = new Set(selectedFiles);
        const filesToFetch = tree.filter(node => selectedSet.has(node.path));
        const pendingTree = tree.filter(node => !selectedSet.has(node.path));

        const fetchedFiles: FileStructure[] = [];
        for (const node of filesToFetch) {
          try {
            const { data: contentData } = await octokit.git.getBlob({
              owner, repo, file_sha: node.sha,
            });
            const content = atob(contentData.content.replace(/\n/g, ''));
            fetchedFiles.push({
              path: node.path,
              name: node.path.split('/').pop() || node.path,
              content,
              lastSyncedContent: content,
              language: getLanguage(node.path),
            });
          } catch (e) {
            console.error(`Failed to fetch ${node.path}`, e);
          }
        }

        const analyzed = processFiles(fetchedFiles);
        
        setFiles(analyzed);
        setCachedRepoData({
          segments,
          allFiles: analyzed,
          selectedCategories,
          pendingTree: pendingTree.map(n => ({ path: n.path, sha: n.sha }))
        });
        setGitHubContext({ owner, repo, branch, token: githubToken, sha });
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load selected files');
    } finally {
      setIsLoadingSelected(false);
    }
  };

  const handleBack = () => {
    setSegments(null);
    setPendingGitHubData(null);
    setPendingLocalFiles(null);
  };

  // Show segment selector only after video has ended (or if not loading)
  if (segments && (!loading || videoEnded)) {
    return (
      <RepoSegmentSelector
        segments={segments}
        onConfirm={handleSegmentConfirm}
        onBack={handleBack}
        isLoading={isLoadingSelected}
      />
    );
  }


  return (
    <div className="relative flex flex-col items-center justify-center h-screen text-white p-4 overflow-hidden">
      {/* Background Video - plays once at normal speed during loading */}
      {loading && !videoEnded && (
        <video
          autoPlay
          muted
          playsInline
          onEnded={() => setVideoEnded(true)}
          className="absolute inset-0 w-full h-full object-cover z-0"
          style={{ filter: 'brightness(0.8)' }}
        >
          <source src="/kiro_bg_2.mp4" type="video/mp4" />
        </video>
      )}

      {/* Dark overlay after video ends but still loading */}
      {loading && videoEnded && (
        <div className="absolute inset-0 w-full h-full bg-gray-900 z-0" />
         
      )}

      {/* Static background when not loading */}
      {!loading && (
        <div 
          className="absolute inset-0 w-full h-full z-0"
          style={{ 
            backgroundImage: 'url(/kiro_bg.png)', 
            backgroundSize: 'cover', 
            backgroundPosition: 'center' 
          }}
        />
      )}

      {/* Content overlay */}
      <div className="relative z-10 flex flex-col items-center w-full">
        <h1 className={`text-4xl font-bold mb-8 transition-all duration-500 ${loading ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
          Code Canvas
        </h1>
        
        <div className={`grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl transition-all duration-500 ${loading ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'}`}>
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
          <div className={`mt-8 flex flex-col items-center gap-4 transition-opacity duration-500 ${videoEnded ? 'opacity-100' : 'opacity-0'}`}>
            <Loader2 className="animate-spin text-blue-400" size={48} />
            <div className="text-center">
              <p className="text-2xl font-bold text-white mb-2">Delivering separator</p>
              <p className="text-lg text-gray-300">Please wait...</p>
              {loadingMessage && <p className="text-sm text-gray-400 mt-2">{loadingMessage}</p>}
            </div>
          </div>
        )}

        {error && (
          <div className="mt-8 text-red-400 bg-red-900/30 px-6 py-3 rounded-lg border border-red-500">
            {error}
          </div>
        )}
      </div>
    </div>
  );
};
