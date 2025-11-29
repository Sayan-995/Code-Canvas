import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, GitBranch, Loader2 } from 'lucide-react';
import { useGitHistoryStore } from '../../store/useGitHistoryStore';
import { fetchCommitHistory } from '../../services/gitHistoryService';
import { CommitCanvas } from './CommitCanvas';
import { CommitSidebar } from './CommitSidebar';
import { CommitTimeline } from './CommitTimeline';

interface GitVisualizerProps {
  owner: string;
  repo: string;
  token?: string;
  onBack: () => void;
}

export const GitVisualizer: React.FC<GitVisualizerProps> = ({
  owner,
  repo,
  token,
  onBack,
}) => {
  const {
    commits,
    currentCommitIndex,
    isLoading,
    error,
    isPlaying,
    playSpeed,
    filesAtCurrentCommit,
    setCommits,
    setCurrentCommitIndex,
    setIsLoading,
    setError,
    setIsPlaying,
    setPlaySpeed,
    nextCommit,
    prevCommit,
    reset,
  } = useGitHistoryStore();

  const [highlightedFile, setHighlightedFile] = useState<string | null>(null);
  const playIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch commit history on mount
  useEffect(() => {
    const loadHistory = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const history = await fetchCommitHistory(owner, repo, token, 50);
        setCommits(history);
      } catch (e: any) {
        setError(e.message || 'Failed to fetch commit history');
      } finally {
        setIsLoading(false);
      }
    };

    loadHistory();

    return () => {
      reset();
    };
  }, [owner, repo, token]);

  // Auto-play logic - base interval is 3500ms (slower default)
  useEffect(() => {
    if (isPlaying) {
      playIntervalRef.current = setInterval(() => {
        nextCommit();
      }, 3500 / playSpeed);
    } else {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
        playIntervalRef.current = null;
      }
    }

    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, [isPlaying, playSpeed, nextCommit]);

  // Clear highlight after delay
  useEffect(() => {
    if (highlightedFile) {
      const timer = setTimeout(() => setHighlightedFile(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [highlightedFile]);

  const currentCommit = commits[currentCommitIndex] || null;

  const handleFileClick = (path: string) => {
    setHighlightedFile(path);
  };

  const handlePlayToggle = () => {
    setIsPlaying(!isPlaying);
  };

  if (isLoading) {
    return (
      <div className="h-screen bg-black flex flex-col items-center justify-center">
        <Loader2 size={48} className="text-blue-500 animate-spin mb-4" />
        <div className="text-white text-lg">Loading commit history...</div>
        <div className="text-gray-500 text-sm mt-2">
          Fetching commits from {owner}/{repo}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen bg-black flex flex-col items-center justify-center">
        <div className="text-red-400 text-lg mb-4">{error}</div>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  if (commits.length === 0) {
    return (
      <div className="h-screen bg-black flex flex-col items-center justify-center">
        <div className="text-gray-400 text-lg mb-4">No commits found</div>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen bg-black flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900/80 border-b border-gray-800">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white transition-colors"
          >
            <ArrowLeft size={18} />
            <span>Back to Canvas</span>
          </button>
          <div className="flex items-center gap-2 text-white">
            <GitBranch size={20} className="text-purple-400" />
            <span className="font-medium">{owner}/{repo}</span>
          </div>
          {!token && (
            <div className="text-yellow-500 text-xs bg-yellow-500/10 px-2 py-1 rounded">
              No token - API rate limited (60 req/hr)
            </div>
          )}
        </div>
        <div className="text-gray-400 text-sm">
          Git History Visualizer • {commits.length} commits loaded
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 relative">
          <CommitCanvas
            files={filesAtCurrentCommit}
            highlightedFile={highlightedFile}
          />
        </div>

        {/* Sidebar */}
        <CommitSidebar
          commit={currentCommit}
          commitNumber={currentCommitIndex + 1}
          totalCommits={commits.length}
          onFileClick={handleFileClick}
        />
      </div>

      {/* Timeline */}
      <CommitTimeline
        commits={commits}
        currentIndex={currentCommitIndex}
        isPlaying={isPlaying}
        playSpeed={playSpeed}
        onCommitSelect={setCurrentCommitIndex}
        onPlayToggle={handlePlayToggle}
        onSpeedChange={setPlaySpeed}
        onPrev={prevCommit}
        onNext={nextCommit}
      />
    </div>
  );
};
