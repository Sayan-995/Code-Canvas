import React, { useState, useEffect, useMemo } from 'react';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import * as Diff from 'diff';
import { X, Check, ArrowRight, ArrowLeft } from 'lucide-react';

interface Conflict {
  path: string;
  local: string;
  remote: string;
}

interface ConflictResolverProps {
  conflicts: Conflict[];
  onResolve: (resolutions: { path: string; content: string }[]) => void;
  onCancel: () => void;
}

export const ConflictResolver: React.FC<ConflictResolverProps> = ({ conflicts, onResolve, onCancel }) => {
  const [resolvedFiles, setResolvedFiles] = useState<Record<string, string>>({});
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [editContent, setEditContent] = useState('');

  const currentConflict = conflicts[currentFileIndex];
  // const isResolved = !!resolvedFiles[currentConflict.path];

  useEffect(() => {
    if (currentConflict) {
      // If we already have a resolution, show that. Otherwise show local content.
      setEditContent(resolvedFiles[currentConflict.path] || currentConflict.local);
    }
  }, [currentConflict, resolvedFiles]);

  const handleResolveCurrent = () => {
    setResolvedFiles(prev => ({
      ...prev,
      [currentConflict.path]: editContent
    }));
    
    if (currentFileIndex < conflicts.length - 1) {
      setCurrentFileIndex(prev => prev + 1);
    }
  };

  const handleFinish = () => {
    const resolutions = Object.entries(resolvedFiles).map(([path, content]) => ({ path, content }));
    onResolve(resolutions);
  };

  const highlightCode = (code: string) => {
    return Prism.highlight(code, Prism.languages.javascript, 'javascript');
  };

  const diff = useMemo(() => {
    if (!currentConflict) return [];
    return Diff.diffLines(currentConflict.local, currentConflict.remote);
  }, [currentConflict]);

  const allResolved = conflicts.every(c => resolvedFiles[c.path]);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-8">
      <div className="bg-[#1e1e1e] w-full max-w-6xl h-[90vh] rounded-xl border border-gray-700 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-gray-700 flex items-center justify-between bg-[#252526]">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="text-orange-500">⚠</span> Resolve Conflicts
            <span className="text-sm font-normal text-gray-400 ml-4">
              {Object.keys(resolvedFiles).length} / {conflicts.length} resolved
            </span>
          </h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar - File List */}
          <div className="w-64 bg-[#252526] border-r border-gray-700 overflow-y-auto">
            {conflicts.map((conflict, idx) => (
              <button
                key={conflict.path}
                onClick={() => setCurrentFileIndex(idx)}
                className={`w-full text-left px-4 py-3 text-sm border-b border-gray-800 transition-colors flex items-center justify-between ${
                  currentFileIndex === idx ? 'bg-blue-600/20 text-blue-400' : 'text-gray-300 hover:bg-gray-800'
                }`}
              >
                <span className="truncate" title={conflict.path}>{conflict.path.split('/').pop()}</span>
                {resolvedFiles[conflict.path] && <Check size={14} className="text-green-500" />}
              </button>
            ))}
          </div>

          {/* Main Content - Diff View */}
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            <div className="flex-1 flex gap-4 p-4 overflow-hidden">
              {/* Remote (Incoming) */}
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-purple-400">Incoming (Diff)</span>
                  <button 
                    onClick={() => setEditContent(currentConflict.remote)}
                    className="text-xs bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 px-2 py-1 rounded flex items-center gap-1"
                  >
                    <ArrowRight size={12} /> Accept Remote
                  </button>
                </div>
                <div className="flex-1 bg-black/30 border border-gray-700 rounded overflow-auto p-2 font-mono text-xs">
                  {diff.map((part, index) => {
                    const color = part.added ? 'bg-green-500/20 text-green-100' :
                                  part.removed ? 'bg-red-500/20 text-red-100' :
                                  'text-gray-400';
                    const prefix = part.added ? '+' : part.removed ? '-' : ' ';
                    
                    const lines = part.value.split('\n');
                    if (lines[lines.length - 1] === '') lines.pop();

                    return lines.map((line, lineIdx) => (
                      <div key={`${index}-${lineIdx}`} className={`${color} px-1`}>
                        <span className="inline-block w-4 select-none opacity-50">{prefix}</span>
                        {line}
                      </div>
                    ));
                  })}
                </div>
              </div>

              {/* Local (Yours/Result) */}
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-blue-400">Result (Editable)</span>
                  <button 
                    onClick={() => setEditContent(currentConflict.local)}
                    className="text-xs bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 px-2 py-1 rounded flex items-center gap-1"
                  >
                    <ArrowLeft size={12} /> Revert to Local
                  </button>
                </div>
                <div className="flex-1 bg-black/30 border border-gray-700 rounded overflow-auto font-mono text-xs relative">
                  <Editor
                    value={editContent}
                    onValueChange={setEditContent}
                    highlight={highlightCode}
                    padding={10}
                    style={{
                      fontFamily: '"Fira code", "Fira Mono", monospace',
                      fontSize: 12,
                      minHeight: '100%',
                    }}
                    textareaClassName="focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-gray-700 bg-[#252526] flex justify-end gap-4">
              <button 
                onClick={handleResolveCurrent}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                {resolvedFiles[currentConflict.path] ? 'Update Resolution' : 'Mark Resolved'}
              </button>
              
              {allResolved && (
                <button 
                  onClick={handleFinish}
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold transition-colors flex items-center gap-2"
                >
                  <Check size={18} /> Complete Merge
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
