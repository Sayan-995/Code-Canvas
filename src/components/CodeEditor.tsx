import { useState, useEffect, useRef } from 'react';
import { useFileStore } from '../store/useFileStore';
import { UploadScreen } from './UploadScreen';
import { CodeCanvas } from './CodeCanvas';
import { ConflictResolver } from './ConflictResolver';
import { SegmentSwitcher } from './SegmentSwitcher';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { Download, Github, Loader2, GitPullRequest } from 'lucide-react';
import { Octokit } from '@octokit/rest';
import { io, Socket } from 'socket.io-client';

import { ExplanationPanel } from './ExplanationPanel';

interface Conflict {
  path: string;
  local: string;
  remote: string;
}

const getSocket = () => {
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
  return io(backendUrl);
};

let socketInstance: Socket | null = null;

const getSocketInstance = (): Socket => {
  if (!socketInstance) {
    socketInstance = getSocket();
  }
  return socketInstance;
};

export function CodeEditor() {
  const { files, setFiles, updateFileContent, githubContext, markAllAsSynced, setGitHubContext, clearFiles } = useFileStore();
  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [showConflictResolver, setShowConflictResolver] = useState(false);
  const [pendingSha, setPendingSha] = useState<string | null>(null);
  const [isFlowPlaying, setIsFlowPlaying] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const isRemoteUpdate = useRef(false);
  const socket = getSocketInstance();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlRoomId = params.get('room');

    if (urlRoomId) {
      setRoomId(urlRoomId);
      setIsJoining(true);
      socket.emit('join_room', urlRoomId);

      socket.on('sync_files', (syncedFiles: any) => {
        console.log('Received synced files:', syncedFiles);
        isRemoteUpdate.current = true;
        setFiles(syncedFiles);
        setIsJoining(false);
      });
    }

    return () => {
      socket.off('sync_files');
    };
  }, [socket]);

  useEffect(() => {
    if (files.length > 0 && !isJoining) {
      if (isRemoteUpdate.current) {
        isRemoteUpdate.current = false;
        return;
      }

      let currentRoomId = roomId;
      if (!currentRoomId) {
        const params = new URLSearchParams(window.location.search);
        currentRoomId = params.get('room');
      }

      if (!currentRoomId) {
        currentRoomId = Math.random().toString(36).substring(7);
        window.history.pushState({}, '', `?room=${currentRoomId}`);
        setRoomId(currentRoomId);
        socket.emit('join_room', currentRoomId);
      } else if (currentRoomId !== roomId) {
          setRoomId(currentRoomId);
      }

      socket.emit('upload_files', { roomId: currentRoomId, files });
    }
  }, [files, isJoining, roomId]);

  const handleDownload = async () => {
    const zip = new JSZip();
    
    files.forEach(file => {
      zip.file(file.path, file.content);
    });

    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, 'project-canvas-export.zip');
  };

  const handlePullFromGithub = async () => {
    if (!githubContext || !githubContext.token) {
      alert('No GitHub token found. Please re-import with a token.');
      return;
    }

    setIsPulling(true);
    try {
      const octokit = new Octokit({ auth: githubContext.token });
      const { owner, repo, branch } = githubContext;

      // 1. Get latest commit
      const { data: refData } = await octokit.git.getRef({
        owner,
        repo,
        ref: `heads/${branch}`,
      });
      const latestCommitSha = refData.object.sha;

      // 2. Get the tree
      const { data: treeData } = await octokit.git.getTree({
        owner,
        repo,
        tree_sha: latestCommitSha,
        recursive: 'true',
      });

      const newConflicts: Conflict[] = [];
      const updates: { path: string; content: string }[] = [];
      const processedPaths = new Set<string>();

      // 3. Process remote files
      for (const item of treeData.tree) {
        if (item.type === 'blob' && item.path) {
          processedPaths.add(item.path);
          
          // Fetch content
          const { data: blobData } = await octokit.git.getBlob({
            owner,
            repo,
            file_sha: item.sha!,
          });

          const remoteContent = atob(blobData.content);
          const localFile = files.find(f => f.path === item.path);

          if (!localFile) {
            // New file from remote
            updates.push({ path: item.path, content: remoteContent });
          } else {
            // File exists locally
            if (localFile.content !== remoteContent) {
              // Content differs
              if (localFile.content === localFile.lastSyncedContent) {
                // Local hasn't changed since last sync, safe to update
                updates.push({ path: item.path, content: remoteContent });
              } else {
                // Local HAS changed. Conflict!
                newConflicts.push({
                  path: item.path,
                  local: localFile.content,
                  remote: remoteContent
                });
              }
            } else {
              // Content is same, just ensure lastSyncedContent is up to date
              // We can do this by "updating" it with same content
              updates.push({ path: item.path, content: remoteContent });
            }
          }
        }
      }

      // 4. Apply safe updates
      if (updates.length > 0) {
        const newFiles = [...files];
        updates.forEach(update => {
          const index = newFiles.findIndex(f => f.path === update.path);
          if (index >= 0) {
            newFiles[index] = {
              ...newFiles[index],
              content: update.content,
              lastSyncedContent: update.content
            };
          } else {
            const name = update.path.split('/').pop() || update.path;
            const ext = name.split('.').pop();
            const language = ext === 'ts' || ext === 'tsx' ? 'typescript' : 
                             ext === 'js' || ext === 'jsx' ? 'javascript' :
                             ext === 'css' ? 'css' :
                             ext === 'html' ? 'html' : 'plaintext';

            newFiles.push({
              path: update.path,
              name,
              language,
              content: update.content,
              lastSyncedContent: update.content
            });
          }
        });
        setFiles(newFiles);
      }

      // 5. Handle conflicts
      if (newConflicts.length > 0) {
        setConflicts(newConflicts);
        setPendingSha(latestCommitSha);
        setShowConflictResolver(true);
      } else {
        if (githubContext) {
          setGitHubContext({ ...githubContext, sha: latestCommitSha });
        }
        alert('Project successfully synced with GitHub!');
      }

    } catch (error) {
      console.error('Error pulling from GitHub:', error);
      alert('Failed to pull changes. Check console for details.');
    } finally {
      setIsPulling(false);
    }
  };

  const handlePushToGithub = async () => {
    if (!githubContext || !githubContext.token) {
      alert('No GitHub token found. Please re-import with a token.');
      return;
    }

    setIsPushing(true);
    try {
      const octokit = new Octokit({ auth: githubContext.token });
      const { owner, repo, branch } = githubContext;

      // 1. Get the latest commit SHA
      const { data: refData } = await octokit.git.getRef({
        owner,
        repo,
        ref: `heads/${branch}`,
      });
      const latestCommitSha = refData.object.sha;

      // 2. Create blobs for changed files
      const treeItems = [];
      for (const file of files) {
        const { data: blobData } = await octokit.git.createBlob({
          owner,
          repo,
          content: file.content,
          encoding: 'utf-8',
        });
        treeItems.push({
          path: file.path,
          mode: '100644', // file mode
          type: 'blob',
          sha: blobData.sha,
        });
      }

      // 3. Create a new tree
      const { data: treeData } = await octokit.git.createTree({
        owner,
        repo,
        base_tree: latestCommitSha,
        tree: treeItems as any,
      });

      // 4. Create a new commit
      const { data: commitData } = await octokit.git.createCommit({
        owner,
        repo,
        message: 'Update from Code Canvas',
        tree: treeData.sha,
        parents: [latestCommitSha],
      });

      // 5. Update the reference
      await octokit.git.updateRef({
        owner,
        repo,
        ref: `heads/${branch}`,
        sha: commitData.sha,
      });

      markAllAsSynced(); // Mark all files as synced after successful push
      if (githubContext) {
        setGitHubContext({ ...githubContext, sha: commitData.sha });
      }
      alert('Successfully pushed changes to GitHub!');
    } catch (error) {
      console.error('Error pushing to GitHub:', error);
      alert('Failed to push changes. Check console for details.');
    } finally {
      setIsPushing(false);
    }
  };

  const handleResolveConflicts = (resolutions: { path: string; content: string }[]) => {
    const newFiles = [...files];
    
    resolutions.forEach(resolution => {
      const index = newFiles.findIndex(f => f.path === resolution.path);
      if (index >= 0) {
        newFiles[index] = {
          ...newFiles[index],
          content: resolution.content,
          lastSyncedContent: resolution.content // Assume resolved state is now the synced state
        };
      }
    });

    setFiles(newFiles);
    setConflicts([]);
    setShowConflictResolver(false);
    if (githubContext && pendingSha) {
      setGitHubContext({ ...githubContext, sha: pendingSha });
      setPendingSha(null);
    }
    alert('Conflicts resolved and changes applied!');
  };

  return (
    <div className="w-full h-screen bg-[#1e1e1e] text-white overflow-hidden">
      {showConflictResolver && (
        <ConflictResolver
          conflicts={conflicts}
          onResolve={handleResolveConflicts}
          onCancel={() => setShowConflictResolver(false)}
        />
      )}
      
      {files.length === 0 ? (
        isJoining ? (
          <div className="flex items-center justify-center h-screen text-white">
            <Loader2 className="animate-spin mr-2" size={48} />
            <span className="text-xl">Joining Room...</span>
          </div>
        ) : (
          <UploadScreen />
        )
      ) : (
        <>
          {!isFlowPlaying && (
            <div className="absolute top-4 right-4 z-50 flex gap-2">
              {githubContext && (
                <>
                  <button
                    onClick={handlePullFromGithub}
                    disabled={isPulling || isPushing}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-lg"
                  >
                    {isPulling ? <Loader2 className="animate-spin" size={20} /> : <GitPullRequest size={20} />}
                    Pull
                  </button>
                  <button
                    onClick={handlePushToGithub}
                    disabled={isPushing || isPulling}
                    className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-lg"
                  >
                    {isPushing ? <Loader2 className="animate-spin" size={20} /> : <Github size={20} />}
                    Push
                  </button>
                </>
              )}
              <button
                onClick={handleDownload}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-lg"
              >
                <Download size={20} />
                Download Zip
              </button>

            </div>
          )}
          <SegmentSwitcher />
          <CodeCanvas 
            files={files} 
            onBack={() => clearFiles()} 
            onFileUpdate={updateFileContent}
            onFlowStateChange={setIsFlowPlaying}
            roomId={roomId}
          />
          <ExplanationPanel />

        </>
      )}
    </div>
  );
}
