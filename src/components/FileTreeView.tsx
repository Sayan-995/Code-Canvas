import React, { useState, useMemo, useCallback } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileCode, FileText, FileJson, File, X, FolderTree } from 'lucide-react';
import { FileStructure } from '../store/useFileStore';

interface TreeNode {
  name: string;
  path: string;
  isFolder: boolean;
  children: TreeNode[];
  file?: FileStructure;
}

interface FileTreeViewProps {
  files: FileStructure[];
  onFileClick: (path: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
      return <FileCode size={14} className="text-blue-400" />;
    case 'json':
      return <FileJson size={14} className="text-yellow-400" />;
    case 'md':
    case 'txt':
      return <FileText size={14} className="text-gray-400" />;
    case 'css':
    case 'scss':
      return <FileCode size={14} className="text-pink-400" />;
    case 'html':
      return <FileCode size={14} className="text-orange-400" />;
    default:
      return <File size={14} className="text-gray-400" />;
  }
};

const buildTree = (files: FileStructure[]): TreeNode[] => {
  const root: TreeNode[] = [];
  
  files.forEach(file => {
    const parts = file.path.split('/');
    let currentLevel = root;
    
    parts.forEach((part, index) => {
      const isLast = index === parts.length - 1;
      const existingNode = currentLevel.find(n => n.name === part);
      
      if (existingNode) {
        if (!isLast) currentLevel = existingNode.children;
      } else {
        const newNode: TreeNode = {
          name: part,
          path: parts.slice(0, index + 1).join('/'),
          isFolder: !isLast,
          children: [],
          file: isLast ? file : undefined,
        };
        currentLevel.push(newNode);
        if (!isLast) currentLevel = newNode.children;
      }
    });
  });
  
  const sortNodes = (nodes: TreeNode[]): TreeNode[] => {
    return nodes.sort((a, b) => {
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
      return a.name.localeCompare(b.name);
    }).map(node => ({ ...node, children: sortNodes(node.children) }));
  };
  
  return sortNodes(root);
};


interface TreeNodeItemProps {
  node: TreeNode;
  depth: number;
  onFileClick: (path: string) => void;
  expandedFolders: Set<string>;
  toggleFolder: (path: string) => void;
}

const TreeNodeItem: React.FC<TreeNodeItemProps> = ({ node, depth, onFileClick, expandedFolders, toggleFolder }) => {
  const isExpanded = expandedFolders.has(node.path);
  const paddingLeft = depth * 16 + 8;
  
  const handleClick = useCallback(() => {
    if (node.isFolder) {
      toggleFolder(node.path);
    } else {
      onFileClick(node.path);
    }
  }, [node, onFileClick, toggleFolder]);
  
  return (
    <>
      <div
        className={`flex items-center gap-1.5 py-1 px-2 cursor-pointer hover:bg-gray-700/50 rounded transition-colors group ${
          !node.isFolder ? 'hover:bg-blue-600/20' : ''
        }`}
        style={{ paddingLeft }}
        onClick={handleClick}
      >
        {node.isFolder ? (
          <>
            <span className="text-gray-500 w-4 flex-shrink-0">
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
            {isExpanded ? (
              <FolderOpen size={14} className="text-yellow-500 flex-shrink-0" />
            ) : (
              <Folder size={14} className="text-yellow-500 flex-shrink-0" />
            )}
          </>
        ) : (
          <>
            <span className="w-4 flex-shrink-0" />
            {getFileIcon(node.name)}
          </>
        )}
        <span className={`text-sm truncate ${node.isFolder ? 'text-gray-300' : 'text-gray-400 group-hover:text-white'}`}>
          {node.name}
        </span>
      </div>
      
      {node.isFolder && isExpanded && (
        <div className="animate-in slide-in-from-top-1 duration-150">
          {node.children.map(child => (
            <TreeNodeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              onFileClick={onFileClick}
              expandedFolders={expandedFolders}
              toggleFolder={toggleFolder}
            />
          ))}
        </div>
      )}
    </>
  );
};


export const FileTreeView: React.FC<FileTreeViewProps> = ({ files, onFileClick, isOpen, onClose }) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [searchFilter, setSearchFilter] = useState('');
  
  const tree = useMemo(() => buildTree(files), [files]);
  
  const toggleFolder = useCallback((path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);
  
  const expandAll = useCallback(() => {
    const allFolders = new Set<string>();
    const collectFolders = (nodes: TreeNode[]) => {
      nodes.forEach(node => {
        if (node.isFolder) {
          allFolders.add(node.path);
          collectFolders(node.children);
        }
      });
    };
    collectFolders(tree);
    setExpandedFolders(allFolders);
  }, [tree]);
  
  const collapseAll = useCallback(() => setExpandedFolders(new Set()), []);
  
  const filteredTree = useMemo(() => {
    if (!searchFilter.trim()) return tree;
    const filterTerm = searchFilter.toLowerCase();
    
    const filterNodes = (nodes: TreeNode[]): TreeNode[] => {
      return nodes.reduce<TreeNode[]>((acc, node) => {
        const nameMatches = node.name.toLowerCase().includes(filterTerm);
        const filteredChildren = filterNodes(node.children);
        if (nameMatches || filteredChildren.length > 0) {
          acc.push({ ...node, children: filteredChildren });
        }
        return acc;
      }, []);
    };
    return filterNodes(tree);
  }, [tree, searchFilter]);
  
  React.useEffect(() => {
    if (searchFilter.trim()) expandAll();
  }, [searchFilter, expandAll]);
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed top-0 left-0 h-full w-full md:w-[400px] bg-[#1e1e1e] border-r border-[#333] shadow-2xl z-[100] flex flex-col animate-in slide-in-from-left duration-300">
      <div className="flex items-center justify-between px-4 py-4 border-b border-[#333] bg-[#252526]">
        <span className="text-base font-semibold text-gray-100 flex items-center gap-2">
          <FolderTree size={18} className="text-blue-400" />
          File Explorer
        </span>
        <div className="flex items-center gap-1">
          <button onClick={expandAll} className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors" title="Expand All">
            <ChevronDown size={16} />
          </button>
          <button onClick={collapseAll} className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors" title="Collapse All">
            <ChevronRight size={16} />
          </button>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors" title="Close">
            <X size={18} />
          </button>
        </div>
      </div>
      
      <div className="px-3 py-3 border-b border-[#333]">
        <input
          type="text"
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          placeholder="Filter files..."
          className="w-full bg-[#2d2d2d] border border-[#444] rounded-md px-3 py-1.5 text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500 transition-colors"
        />
      </div>
      
      <div className="flex-1 overflow-y-auto py-2 custom-scrollbar">
        {(!filteredTree || filteredTree.length === 0) ? (
          <div className="text-center text-gray-500 text-sm py-8">No files found</div>
        ) : (
          filteredTree.map(node => (
            <TreeNodeItem
              key={node.path}
              node={node}
              depth={0}
              onFileClick={onFileClick}
              expandedFolders={expandedFolders}
              toggleFolder={toggleFolder}
            />
          ))
        )}
      </div>
      
      <div className="px-4 py-3 border-t border-[#333] bg-[#252526] text-xs text-gray-500 flex justify-between items-center">
        <span>{files.length} files</span>
        <span>Project Root</span>
      </div>
    </div>
  );
};
