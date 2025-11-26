import React, { useState } from 'react';
import { useFileStore, FileStructure } from '../store/useFileStore';
import { Layers, Check, ChevronDown, X, Loader2 } from 'lucide-react';
import { Octokit } from '@octokit/rest';
import { analyzeCode } from '../utils/codeAnalyzer';

export const SegmentSwitcher: React.FC = () => {
  const { cachedRepoData, switchSegments, githubContext, addToCache, setFiles } = useFileStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  if (!cachedRepoData) return null;

  const { segments, selectedCategories, allFiles, pendingTree } = cachedRepoData;

  const getLanguage = (filename: string) => {
    if (filename.endsWith('.tsx') || filename.endsWith('.ts')) return 'typescript';
    if (filename.endsWith('.jsx') || filename.endsWith('.js')) return 'javascript';
    if (filename.endsWith('.css')) return 'css';
    if (filename.endsWith('.json')) return 'json';
    return 'plaintext';
  };

  const processFiles = (files: FileStructure[]) => {
    return files.map(file => {
      if (file.language === 'typescript' || file.language === 'javascript') {
        try {
          const analysis = analyzeCode(file.path, file.content);
          return { ...file, analysis };
        } catch (e) {
          return file;
        }
      }
      return file;
    });
  };

  const toggleCategory = async (category: string) => {
    const newSelected = new Set(selectedCategories);
    if (newSelected.has(category)) {
      if (newSelected.size > 1) {
        newSelected.delete(category);
      }
    } else {
      newSelected.add(category);
    }

    // Get files needed for new selection
    const neededPaths = new Set(
      segments.filter(s => newSelected.has(s.category)).flatMap(s => s.files)
    );
    const cachedPaths = new Set(allFiles.map(f => f.path));
    const missingPaths = [...neededPaths].filter(p => !cachedPaths.has(p));

    // If we have missing files and GitHub context, fetch them
    if (missingPaths.length > 0 && githubContext?.token && pendingTree) {
      setIsLoading(true);
      try {
        const octokit = new Octokit({ auth: githubContext.token });
        const { owner, repo } = githubContext;
        const missingSet = new Set(missingPaths);
        const nodesToFetch = pendingTree.filter(n => missingSet.has(n.path));

        const newFiles: FileStructure[] = [];
        for (const node of nodesToFetch) {
          try {
            const { data: contentData } = await octokit.git.getBlob({
              owner, repo, file_sha: node.sha,
            });
            const content = atob(contentData.content.replace(/\n/g, ''));
            newFiles.push({
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

        const analyzed = processFiles(newFiles);
        addToCache(analyzed);
        
        // Now switch with updated cache
        const updatedAllFiles = [...allFiles, ...analyzed];
        const displayFiles = updatedAllFiles.filter(f => neededPaths.has(f.path));
        setFiles(displayFiles);
      } catch (e) {
        console.error('Failed to fetch files:', e);
      } finally {
        setIsLoading(false);
      }
    }

    switchSegments(newSelected);
  };

  const selectedCount = selectedCategories.size;
  const totalCount = segments.length;


  return (
    <div className="absolute bottom-4 left-20 z-50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className="bg-gray-800 hover:bg-gray-700 disabled:opacity-70 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg border border-gray-600"
      >
        {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Layers size={18} />}
        <span>Segments ({selectedCount}/{totalCount})</span>
        <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute bottom-12 left-0 bg-gray-800 border border-gray-600 rounded-lg shadow-xl w-72 overflow-hidden">
          <div className="p-3 border-b border-gray-700 flex justify-between items-center">
            <span className="text-sm text-gray-400">Switch code segments</span>
            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white">
              <X size={16} />
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {segments.map((segment) => {
              const isSelected = selectedCategories.has(segment.category);
              const cachedPaths = new Set(allFiles.map(f => f.path));
              const isCached = segment.files.every(f => cachedPaths.has(f));
              
              return (
                <button
                  key={segment.category}
                  onClick={() => toggleCategory(segment.category)}
                  disabled={isLoading}
                  className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-700 transition-colors text-left disabled:opacity-50 ${
                    isSelected ? 'bg-gray-750' : ''
                  }`}
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-500'
                  }`}>
                    {isSelected && <Check size={12} />}
                  </div>
                  <span className="text-lg">{segment.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{segment.category}</div>
                    <div className="text-xs text-gray-400">
                      {segment.files.length} files
                      {!isCached && !isSelected && <span className="text-yellow-500 ml-1">(will fetch)</span>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
