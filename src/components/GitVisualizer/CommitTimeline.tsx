import React, { useRef, useEffect } from 'react';
import { GitCommit } from '../../store/useGitHistoryStore';
import { ChevronLeft, ChevronRight, Play, Pause } from 'lucide-react';

interface CommitTimelineProps {
  commits: GitCommit[];
  currentIndex: number;
  isPlaying: boolean;
  playSpeed: number;
  onCommitSelect: (index: number) => void;
  onPlayToggle: () => void;
  onSpeedChange: (speed: number) => void;
  onPrev: () => void;
  onNext: () => void;
}

export const CommitTimeline: React.FC<CommitTimelineProps> = ({
  commits,
  currentIndex,
  isPlaying,
  playSpeed,
  onCommitSelect,
  onPlayToggle,
  onSpeedChange,
  onPrev,
  onNext,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to current commit
  useEffect(() => {
    if (scrollRef.current) {
      const container = scrollRef.current;
      const dot = container.children[currentIndex] as HTMLElement;
      if (dot) {
        const containerWidth = container.offsetWidth;
        const dotLeft = dot.offsetLeft;
        const dotWidth = dot.offsetWidth;
        const scrollLeft = dotLeft - containerWidth / 2 + dotWidth / 2;
        container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
      }
    }
  }, [currentIndex]);

  return (
    <div className="bg-gray-900/80 border-t border-gray-800 p-4">
      <div className="flex items-center gap-4">
        {/* Prev Button */}
        <button
          onClick={onPrev}
          disabled={currentIndex === 0}
          className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={20} className="text-white" />
        </button>

        {/* Timeline Dots */}
        <div 
          ref={scrollRef}
          className="flex-1 flex items-center gap-2 overflow-x-auto scrollbar-hide py-2"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {commits.map((commit, index) => (
            <button
              key={commit.sha}
              onClick={() => onCommitSelect(index)}
              className={`
                relative flex-shrink-0 rounded-full transition-all duration-300
                ${index === currentIndex 
                  ? 'w-5 h-5 bg-blue-500 ring-4 ring-blue-500/30' 
                  : 'w-3 h-3 bg-gray-600 hover:bg-gray-500'
                }
                ${index < currentIndex ? 'bg-blue-400/50' : ''}
              `}
              title={`${commit.message.substring(0, 50)}${commit.message.length > 50 ? '...' : ''}`}
            >
              {index === currentIndex && (
                <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-gray-400 whitespace-nowrap">
                  {index + 1}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Next Button */}
        <button
          onClick={onNext}
          disabled={currentIndex === commits.length - 1}
          className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight size={20} className="text-white" />
        </button>

        {/* Divider */}
        <div className="w-px h-8 bg-gray-700" />

        {/* Play/Pause Button */}
        <button
          onClick={onPlayToggle}
          className={`
            p-3 rounded-lg transition-colors
            ${isPlaying 
              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
              : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
            }
          `}
        >
          {isPlaying ? <Pause size={20} /> : <Play size={20} />}
        </button>

        {/* Speed Control */}
        <select
          value={playSpeed}
          onChange={(e) => onSpeedChange(Number(e.target.value))}
          className="bg-gray-800 text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:outline-none focus:border-blue-500"
        >
          <option value={0.5}>0.5x</option>
          <option value={1}>1x</option>
          <option value={2}>2x</option>
          <option value={3}>3x</option>
        </select>

        {/* Commit Counter */}
        <div className="text-gray-400 text-sm whitespace-nowrap">
          {currentIndex + 1} / {commits.length}
        </div>
      </div>
    </div>
  );
};
