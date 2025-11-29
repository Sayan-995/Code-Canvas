import React from 'react';
import { Handle, Position } from 'reactflow';
import { FileText, FileCode, FileJson, File } from 'lucide-react';
import { parsePatch } from '../../services/gitHistoryService';

interface CommitFileNodeProps {
  data: {
    path: string;
    name: string;
    status: 'added' | 'modified' | 'deleted' | 'unchanged';
    patch?: string;
    animationDelay?: number;
  };
}

const getFileIcon = (name: string) => {
  if (name.endsWith('.ts') || name.endsWith('.tsx')) return FileCode;
  if (name.endsWith('.js') || name.endsWith('.jsx')) return FileCode;
  if (name.endsWith('.json')) return FileJson;
  if (name.endsWith('.md') || name.endsWith('.txt')) return FileText;
  return File;
};

const getGlowClass = (status: string): string => {
  switch (status) {
    case 'added':
      return 'animate-glow-added border-green-500/80';
    case 'modified':
      return 'animate-glow-modified border-blue-500/80';
    case 'deleted':
      return 'animate-glow-deleted border-red-500/80';
    default:
      return 'border-gray-700';
  }
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'added':
      return (
        <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold z-10">
          +
        </span>
      );
    case 'modified':
      return (
        <span className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold z-10">
          ~
        </span>
      );
    case 'deleted':
      return (
        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold z-10">
          -
        </span>
      );
    default:
      return null;
  }
};

const MAX_DIFF_LINES = 8;

export const CommitFileNode: React.FC<CommitFileNodeProps> = ({ data }) => {
  const { path, name, status, patch, animationDelay = 0 } = data;
  const Icon = getFileIcon(name);
  const glowClass = getGlowClass(status);
  const isChanged = status !== 'unchanged';

  // Parse diff lines
  const diffLines = parsePatch(patch).slice(0, MAX_DIFF_LINES);
  const hasDiff = diffLines.length > 0;

  return (
    <div
      className={`
        relative bg-gray-900 border rounded-lg overflow-hidden
        transition-all duration-500
        ${glowClass}
        ${status === 'deleted' ? 'opacity-60' : ''}
        ${isChanged ? 'animate-fade-in' : ''}
      `}
      style={{
        animationDelay: `${animationDelay}ms`,
        minWidth: hasDiff ? '280px' : '160px',
        maxWidth: hasDiff ? '320px' : '200px',
      }}
    >
      <Handle type="target" position={Position.Left} className="opacity-0" />
      <Handle type="source" position={Position.Right} className="opacity-0" />

      {getStatusBadge(status)}

      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b border-gray-800">
        <Icon
          size={18}
          className={`flex-shrink-0
            ${status === 'added' ? 'text-green-400' : ''}
            ${status === 'modified' ? 'text-blue-400' : ''}
            ${status === 'deleted' ? 'text-red-400' : ''}
            ${status === 'unchanged' ? 'text-gray-400' : ''}
          `}
        />
        <div className="flex flex-col overflow-hidden min-w-0">
          <span className="text-white text-sm font-medium truncate">{name}</span>
          <span className="text-gray-500 text-xs truncate">{path}</span>
        </div>
      </div>

      {/* Diff Preview */}
      {hasDiff && (
        <div className="bg-gray-950 p-2 font-mono text-xs overflow-hidden max-h-[160px]">
          {diffLines.map((line, i) => (
            <div
              key={i}
              className={`
                px-1 whitespace-pre overflow-hidden text-ellipsis
                ${line.type === 'add' ? 'bg-green-500/20 text-green-300' : ''}
                ${line.type === 'remove' ? 'bg-red-500/20 text-red-300' : ''}
                ${line.type === 'context' ? 'text-gray-500' : ''}
              `}
            >
              <span className="select-none mr-1 opacity-60">
                {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
              </span>
              {line.content || ' '}
            </div>
          ))}
          {patch && parsePatch(patch).length > MAX_DIFF_LINES && (
            <div className="text-gray-600 text-center mt-1 text-xs">
              +{parsePatch(patch).length - MAX_DIFF_LINES} more lines
            </div>
          )}
        </div>
      )}

      {/* No diff - show placeholder for unchanged files */}
      {!hasDiff && status === 'unchanged' && (
        <div className="p-2 text-gray-600 text-xs text-center">
          No changes
        </div>
      )}
    </div>
  );
};
