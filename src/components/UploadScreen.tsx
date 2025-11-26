import React, { useState } from 'react';
import { useFileStore, FileStructure, FileSegment, ViewMode } from '../store/useFileStore';
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

const VIDEO_WATCHED_KEY = 'code_canvas_video_watched';

export const UploadScreen: React.FC = () => {
  const { setFiles, setGitHubContext, setCachedRepoData } = useFileStore();
  const [loading, setLoading] = useState(false);
  const [repoUrl, setRepoUrl] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [error, setError] = useState('');
<<<<<<< HEAD
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [logs, setLogs] = useState<string[]>([]);
  const terminalRef = React.useRef<HTMLDivElement>(null);
  const [transitionStage, setTransitionStage] = useState<'idle' | 'loading' | 'fading' | 'complete'>('idle');
=======
  
  // Check if user has already watched the video
  const hasWatchedVideo = () => localStorage.getItem(VIDEO_WATCHED_KEY) === 'true';
  const [videoEnded, setVideoEnded] = useState(hasWatchedVideo());
>>>>>>> 7e85a2c7a87ce5608dcc9b2a48237dac803feecf
  
  // Segmentation state
  const [segments, setSegments] = useState<FileSegment[] | null>(null);
  const [pendingGitHubData, setPendingGitHubData] = useState<PendingGitHubData | null>(null);
  const [pendingLocalFiles, setPendingLocalFiles] = useState<FileStructure[] | null>(null);
  const [isLoadingSelected, setIsLoadingSelected] = useState(false);

  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  };

  React.useEffect(() => {
    if (loading) {
      const initialMessages = [
        "Initializing file system stream...",
        "Parsing abstract syntax tree...",
        "Tokenizing source content...",
        "Identifying dependency graph...",
        "Segregating logic layers...",
        "Extracting component definitions...",
        "Analyzing control flow...",
        "Optimizing render cycles...",
        "Generating visualization nodes...",
        "Compiling segment data..."
      ];

      const loopingMessages = [
        "Verifying integrity...",
        "Allocating memory blocks...",
        "Syncing thread pools...",
        "Defragmenting logic clusters...",
        "Resolving circular dependencies...",
        "Indexing symbol table...",
        "Calculating complexity metrics...",
        "Mapping module interconnections...",
        "Hydrating state containers...",
        "Finalizing structure analysis...",
        "Deep scanning modules...",
        "Tracing execution paths...",
        "Validating type definitions...",
        "Constructing dependency tree..."
      ];
      
      let count = 0;
      const interval = setInterval(() => {
        setLogs(prev => {
            let nextMessage;
            if (count < initialMessages.length) {
                nextMessage = initialMessages[count];
            } else {
                nextMessage = loopingMessages[Math.floor(Math.random() * loopingMessages.length)];
            }
            count++;
            return [...prev, nextMessage];
        });
      }, 500);
  
      return () => clearInterval(interval);
    } else {
      setLogs([]);
    }
  }, [loading]);

  React.useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

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
    setTransitionStage('loading');
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

      const filePaths = newFiles.map(f => f.path);
      const result = await categorizeRepository(filePaths);
      
      setPendingLocalFiles(newFiles);
      setSegments(result.segments);
      
      setTransitionStage('fading');
      setTimeout(() => {
        setTransitionStage('complete');
        setLoading(false);
      }, 800);
    } catch (err) {
      console.error(err);
      setError('Failed to process files');
      setLoading(false);
      setTransitionStage('idle');
    }
  };

  const handleGithubImport = async () => {
    if (!repoUrl) return;
    setLoading(true);
    setTransitionStage('loading');
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

      const filePaths = allFiles.map((f: any) => f.path);
      const result = await categorizeRepository(filePaths);

      setPendingGitHubData({
        owner, repo, branch: defaultBranch, sha: latestCommitSha,
        tree: allFiles as GitHubTreeNode[], octokit
      });
      setSegments(result.segments);
      
      setTransitionStage('fading');
      setTimeout(() => {
        setTransitionStage('complete');
        setLoading(false);
      }, 800);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to import from GitHub');
      setLoading(false);
      setTransitionStage('idle');
    }
  };


  const handleSegmentConfirm = async (selectedFiles: string[], selectedCategories: Set<string>, viewMode: ViewMode) => {
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
          selectedCategories,
          viewMode
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
          viewMode,
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
    setTransitionStage('idle');
  };




  return (
<<<<<<< HEAD
    <div 
      className="relative flex flex-col items-center justify-center h-screen bg-black text-white p-4 overflow-hidden"
      onMouseMove={handleMouseMove}
    >
      {/* Glowing Cursor Effect */}
      <div 
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background: `radial-gradient(600px circle at ${mousePos.x}px ${mousePos.y}px, rgba(59, 130, 246, 0.25), transparent 40%)`
        }}
      />
      
      {/* Grid Pattern */}
      <div className="absolute inset-0 z-0 opacity-40 animate-[pulse_2s_ease-in-out_infinite]" 
        style={{
            backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)',
            backgroundSize: '40px 40px'
        }}
      />

      {/* Content overlay */}
      <div className={`relative z-10 flex flex-col items-center w-full transition-opacity duration-700 ${transitionStage === 'fading' || transitionStage === 'complete' ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <h1 className={`text-5xl font-bold mb-12 transition-all duration-500 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600 ${loading ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
=======
    <div className="relative flex flex-col items-center justify-center h-screen text-white p-4 overflow-hidden">
      {/* Background Video - plays once at normal speed during loading */}
      {loading && !videoEnded && (
        <div className="absolute inset-0 flex items-center justify-center z-0 p-6 md:p-12">
          <video
            autoPlay
            muted
            playsInline
            onEnded={() => {
              localStorage.setItem(VIDEO_WATCHED_KEY, 'true');
              setVideoEnded(true);
            }}
            className="rounded-lg shadow-2xl"
            style={{ 
              filter: 'brightness(0.9)',
              maxWidth: 'calc(100% - 48px)',
              maxHeight: 'calc(100% - 48px)',
              width: 'auto',
              height: 'auto',
              objectFit: 'contain',
              margin: 'auto'
            }}
            onLoadedMetadata={(e) => {
              const video = e.currentTarget;
              video.playbackRate = 1.2;
            }}
          >
            <source src="/kiro_bg_2.mp4" type="video/mp4" />
          </video>
        </div>
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
        {/* <h1 className={`text-4xl font-bold mb-8 transition-all duration-500 ${loading ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
>>>>>>> 7e85a2c7a87ce5608dcc9b2a48237dac803feecf
          Code Canvas
        </h1> */}
        
        <div className={`grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl transition-all duration-500 ${loading ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'}`}>
        {/* Local Upload */}
        <div className="group bg-gray-900/50 backdrop-blur-sm p-8 rounded-xl border border-gray-800 hover:border-blue-500/50 transition-all duration-300 flex flex-col items-center gap-4 hover:shadow-[0_0_30px_rgba(59,130,246,0.2)]">
          <div className="p-4 rounded-full bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
            <FolderUp size={48} className="text-blue-400" />
          </div>
          <h2 className="text-2xl font-semibold">Upload Folder</h2>
          <p className="text-gray-400 text-center">Select a folder from your local machine to visualize.</p>
          <label className="cursor-pointer bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-lg font-medium transition-all hover:shadow-lg hover:shadow-blue-500/30 transform hover:-translate-y-0.5">
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
        <div className="group bg-gray-900/50 backdrop-blur-sm p-8 rounded-xl border border-gray-800 hover:border-purple-500/50 transition-all duration-300 flex flex-col items-center gap-4 hover:shadow-[0_0_30px_rgba(168,85,247,0.2)]">
          <div className="p-4 rounded-full bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors">
            <Github size={48} className="text-purple-400" />
          </div>
          <h2 className="text-2xl font-semibold">GitHub Repo</h2>
          <p className="text-gray-400 text-center">Import a repository to visualize and edit.</p>
          <div className="flex flex-col w-full gap-3">
            <input
              type="text"
              placeholder="https://github.com/owner/repo"
              className="w-full bg-black/50 border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500 transition-colors"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
            />
            <input
              type="password"
              placeholder="Personal Access Token (Optional)"
              className="w-full bg-black/50 border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500 text-sm transition-colors"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
            />
            <button
              onClick={handleGithubImport}
              disabled={!repoUrl || loading}
              className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white px-4 py-3 rounded-lg font-medium transition-all hover:shadow-lg hover:shadow-purple-500/30 transform hover:-translate-y-0.5"
            >
              Import Repository
            </button>
          </div>
        </div>
      </div>

        {loading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md">
            <div className="w-full max-w-2xl bg-[#0d1117] rounded-lg border border-gray-800 shadow-2xl overflow-hidden font-mono text-sm">
              {/* Terminal Header */}
              <div className="bg-[#161b22] px-4 py-2 flex items-center gap-2 border-b border-gray-800">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                </div>
                <div className="ml-4 text-gray-400 text-xs">~/kiro/system-analysis</div>
              </div>
              
              {/* Terminal Body */}
              <div 
                ref={terminalRef}
                className="p-6 h-80 overflow-y-auto flex flex-col gap-2 font-mono scrollbar-hide"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {logs.map((log, i) => (
                  <div key={i} className="flex gap-3 text-blue-400">
                    <span className="text-gray-600 shrink-0">
                      {new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}.{Math.floor(Math.random() * 999)}
                    </span>
                    <span className="text-blue-500 font-bold">{'>'}</span>
                    <span className="animate-[type_0.5s_ease-out]">{log}</span>
                  </div>
                ))}
                <div className="flex gap-3">
                   <span className="text-blue-500 font-bold">{'>'}</span>
                   <span className="w-2 h-4 bg-blue-500 animate-pulse"></span>
                </div>
              </div>
            </div>
            <style>{`
                @keyframes type {
                    from { opacity: 0; transform: translateX(-10px); }
                    to { opacity: 1; transform: translateX(0); }
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
            `}</style>
          </div>
        )}

        {error && (
          <div className="mt-8 text-red-400 bg-red-900/20 px-6 py-4 rounded-lg border border-red-500/50 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4">
            {error}
          </div>
        )}
      </div>

      {transitionStage === 'complete' && segments && (
        <div className="absolute inset-0 z-20 animate-[fadeIn_0.7s_ease-out_forwards]">
          <RepoSegmentSelector
            segments={segments}
            onConfirm={handleSegmentConfirm}
            onBack={handleBack}
            isLoading={isLoadingSelected}
          />
        </div>
      )}
    </div>
  );
};
