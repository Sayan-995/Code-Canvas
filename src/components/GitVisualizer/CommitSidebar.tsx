import React from 'react';
import { GitCommit } from '../../store/useGitHistoryStore';
import { formatRelativeDate } from '../../services/gitHistoryService';
import { User, Calendar, FileText, Plus, Minus, Edit } from 'lucide-react';

interface CommitSidebarProps {
  commit: GitCommit | null;
  commitNumber: number;
  totalCommits: number;
  onFileClick: (path: string) => void;
}

export const CommitSidebar: React.FC<CommitSidebarProps> = ({
  commit,
  commitNumber,
  totalCommits,
  onFileClick,
}) => {
  if (!commit) {
    return (
      <div className="w-72 bg-gray-900/80 border-l border-gray-800 p-4 flex items-center justify-center">
        <span className="text-gray-500">No commit selected</span>
      </div>
    );
  }

  const addedFiles = commit.files.filter((f) => f.status === 'added');
  const modifiedFiles = commit.files.filter((f) => f.status === 'modified');
  const deletedFiles = commit.files.filter((f) => f.status === 'deleted');

  return (
    <div className="w-72 bg-gray-900/80 border-l border-gray-800 flex flex-col overflow-hidden">
      {/* Header - with transition */}
      <div className="p-4 border-b border-gray-800 transition-all duration-300">
        <div className="text-xs text-gray-500 mb-1">
          Commit {commitNumber} of {totalCommits}
        </div>
        <div className="text-xs text-gray-600 font-mono truncate transition-all duration-300">
          {commit.sha.substring(0, 7)}
        </div>
      </div>

      {/* Author Info - with smooth transition */}
      <div className="p-4 border-b border-gray-800 transition-all duration-500 ease-out">
        <div className="flex items-center gap-3 mb-3">
          {commit.author.avatar ? (
            <img
              src={commit.author.avatar}
              alt={commit.author.name}
              className="w-10 h-10 rounded-full transition-all duration-300"
              key={commit.author.avatar}
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
              <User size={20} className="text-gray-400" />
            </div>
          )}
          <div className="transition-all duration-300">
            <div className="text-white font-medium">{commit.author.name}</div>
            <div className="text-gray-500 text-sm flex items-center gap-1">
              <Calendar size={12} />
              {formatRelativeDate(commit.author.date)}
            </div>
          </div>
        </div>
      </div>

      {/* Commit Message - with fade transition */}
      <div className="p-4 border-b border-gray-800 transition-all duration-300">
        <div className="text-gray-400 text-sm leading-relaxed animate-fade-in-text">
          {commit.message}
        </div>
      </div>

      {/* Stats - with smooth number transitions */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1 text-green-400 transition-all duration-300">
            <Plus size={14} />
            <span className="tabular-nums">{addedFiles.length}</span>
          </div>
          <div className="flex items-center gap-1 text-blue-400 transition-all duration-300">
            <Edit size={14} />
            <span className="tabular-nums">{modifiedFiles.length}</span>
          </div>
          <div className="flex items-center gap-1 text-red-400 transition-all duration-300">
            <Minus size={14} />
            <span className="tabular-nums">{deletedFiles.length}</span>
          </div>
        </div>
      </div>

      {/* Changed Files List - with staggered animation */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">
          Changed Files
        </div>
        <div className="space-y-2">
          {commit.files.map((file, index) => (
            <button
              key={file.path}
              onClick={() => onFileClick(file.path)}
              className="w-full text-left p-2 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition-all duration-200 group animate-fade-in-text"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`
                  text-xs font-bold w-5 h-5 rounded flex items-center justify-center flex-shrink-0
                  ${file.status === 'added' ? 'bg-green-500/20 text-green-400' : ''}
                  ${file.status === 'modified' ? 'bg-blue-500/20 text-blue-400' : ''}
                  ${file.status === 'deleted' ? 'bg-red-500/20 text-red-400' : ''}
                `}
                >
                  {file.status === 'added' && '+'}
                  {file.status === 'modified' && '~'}
                  {file.status === 'deleted' && '-'}
                </span>
                <FileText size={14} className="text-gray-500 flex-shrink-0" />
                <span className="text-gray-300 text-sm truncate flex-1">
                  {file.path.split('/').pop()}
                </span>
              </div>
              <div className="flex items-center justify-between mt-1 pl-7">
                <span className="text-gray-600 text-xs truncate flex-1">{file.path}</span>
                {(file.additions || file.deletions) && (
                  <span className="text-xs flex gap-1 flex-shrink-0 ml-2">
                    {file.additions ? (
                      <span className="text-green-500">+{file.additions}</span>
                    ) : null}
                    {file.deletions ? (
                      <span className="text-red-500">-{file.deletions}</span>
                    ) : null}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
