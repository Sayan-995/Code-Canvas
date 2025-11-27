import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileCode, FileText, FileJson, File, X, ZoomIn, ZoomOut } from 'lucide-react';
import { FileStructure } from '../store/useFileStore';

interface TreeNode {
  name: string;
  path: string;
  isFolder: boolean;
  children: TreeNode[];
  file?: FileStructure;
  depth?: number;
  x?: number;
  y?: number;
}

interface FullscreenTreeViewProps {
  files: FileStructure[];
  onFileClick: (path: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

const getFileIcon = (filename: string, size = 16) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
      return <FileCode size={size} className="text-blue-400" />;
    case 'js':
    case 'jsx':
      return <FileCode size={size} className="text-yellow-400" />;
    case 'json':
      return <FileJson size={size} className="text-amber-400" />;
    case 'md':
      return <FileText size={size} className="text-gray-400" />;
    case 'css':
    case 'scss':
      return <FileCode size={size} className="text-pink-400" />;
    case 'html':
      return <FileCode size={size} className="text-orange-400" />;
    default:
      return <File size={size} className="text-gray-400" />;
  }
};

const getFileColor = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
      return '#3b82f6';
    case 'js':
    case 'jsx':
      return '#eab308';
    case 'json':
      return '#f59e0b';
    case 'css':
    case 'scss':
      return '#ec4899';
    case 'html':
      return '#f97316';
    default:
      return '#6b7280';
  }
};


const buildTree = (files: FileStructure[]): TreeNode => {
  const root: TreeNode = { name: 'root', path: '', isFolder: true, children: [] };
  
  files.forEach(file => {
    const parts = file.path.split('/');
    let currentLevel = root.children;
    
    parts.forEach((part, index) => {
      const isLast = index === parts.length - 1;
      let existingNode = currentLevel.find(n => n.name === part);
      
      if (!existingNode) {
        existingNode = {
          name: part,
          path: parts.slice(0, index + 1).join('/'),
          isFolder: !isLast,
          children: [],
          file: isLast ? file : undefined,
        };
        currentLevel.push(existingNode);
      }
      if (!isLast) currentLevel = existingNode.children;
    });
  });
  
  const sortNodes = (nodes: TreeNode[]): TreeNode[] => {
    return nodes.sort((a, b) => {
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
      return a.name.localeCompare(b.name);
    }).map(node => ({ ...node, children: sortNodes(node.children) }));
  };
  
  root.children = sortNodes(root.children);
  return root;
};

interface AnimatedNodeProps {
  node: TreeNode;
  depth: number;
  index: number;
  totalSiblings: number;
  parentX: number;
  parentY: number;
  expandedFolders: Set<string>;
  toggleFolder: (path: string) => void;
  onFileClick: (path: string) => void;
  hoveredNode: string | null;
  setHoveredNode: (path: string | null) => void;
  scale: number;
}

const AnimatedNode: React.FC<AnimatedNodeProps> = ({
  node,
  depth,
  index,
  totalSiblings,
  parentX,
  parentY,
  expandedFolders,
  toggleFolder,
  onFileClick,
  hoveredNode,
  setHoveredNode,
  scale,
}) => {
  const isExpanded = expandedFolders.has(node.path);
  const isHovered = hoveredNode === node.path;
  const nodeRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  
  // Calculate position based on radial layout
  const horizontalSpacing = 180 / scale;
  const verticalSpacing = 100 / scale;
  
  const x = parentX + horizontalSpacing;
  const y = parentY + (index - (totalSiblings - 1) / 2) * verticalSpacing;
  
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), depth * 50 + index * 30);
    return () => clearTimeout(timer);
  }, [depth, index]);

  const handleClick = () => {
    if (node.isFolder) {
      toggleFolder(node.path);
    } else {
      onFileClick(node.path);
    }
  };

  return (
    <>
      {/* Connection line from parent */}
      {depth > 0 && (
        <svg
          className="absolute pointer-events-none"
          style={{
            left: Math.min(parentX, x),
            top: Math.min(parentY, y) + 20,
            width: Math.abs(x - parentX) + 10,
            height: Math.abs(y - parentY) + 10,
            overflow: 'visible',
            zIndex: 1,
          }}
        >
          <path
            d={`M ${parentX < x ? 0 : Math.abs(x - parentX)} ${parentY < y ? 0 : Math.abs(y - parentY)} 
                Q ${Math.abs(x - parentX) / 2} ${parentY < y ? 0 : Math.abs(y - parentY)},
                  ${Math.abs(x - parentX) / 2} ${Math.abs(y - parentY) / 2}
                T ${parentX < x ? Math.abs(x - parentX) : 0} ${parentY < y ? Math.abs(y - parentY) : 0}`}
            stroke={isHovered ? '#3b82f6' : '#374151'}
            strokeWidth={isHovered ? 2 : 1}
            fill="none"
            className="transition-all duration-300"
            style={{
              opacity: isVisible ? 1 : 0,
              strokeDasharray: isVisible ? 'none' : '1000',
              strokeDashoffset: isVisible ? 0 : 1000,
              transition: 'stroke-dashoffset 0.8s ease-out, opacity 0.3s ease-out',
            }}
          />
        </svg>
      )}
      
      {/* Node */}
      <div
        ref={nodeRef}
        className={`absolute flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all duration-300 ${
          isHovered ? 'scale-110 z-20' : 'z-10'
        }`}
        style={{
          left: x,
          top: y,
          transform: `translate(-50%, -50%) scale(${isVisible ? 1 : 0})`,
          opacity: isVisible ? 1 : 0,
          background: isHovered 
            ? 'linear-gradient(135deg, #1e3a5f 0%, #1e1e2e 100%)' 
            : 'linear-gradient(135deg, #1e1e2e 0%, #252536 100%)',
          border: `1px solid ${isHovered ? '#3b82f6' : '#374151'}`,
          boxShadow: isHovered 
            ? '0 0 20px rgba(59, 130, 246, 0.4), 0 4px 20px rgba(0,0,0,0.5)' 
            : '0 4px 15px rgba(0,0,0,0.3)',
        }}
        onClick={handleClick}
        onMouseEnter={() => setHoveredNode(node.path)}
        onMouseLeave={() => setHoveredNode(null)}
      >
        {node.isFolder ? (
          <>
            <span className="text-gray-400">
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
            {isExpanded ? (
              <FolderOpen size={18} className="text-yellow-500" />
            ) : (
              <Folder size={18} className="text-yellow-500" />
            )}
          </>
        ) : (
          getFileIcon(node.name, 18)
        )}
        <span className={`text-sm font-medium whitespace-nowrap ${
          node.isFolder ? 'text-gray-200' : 'text-gray-300'
        }`}>
          {node.name}
        </span>
        
        {/* Glow effect for files */}
        {!node.isFolder && isHovered && (
          <div 
            className="absolute inset-0 rounded-lg opacity-20 pointer-events-none"
            style={{ 
              background: `radial-gradient(circle, ${getFileColor(node.name)} 0%, transparent 70%)`,
            }}
          />
        )}
      </div>
      
      {/* Render children if expanded */}
      {node.isFolder && isExpanded && node.children.map((child, i) => (
        <AnimatedNode
          key={child.path}
          node={child}
          depth={depth + 1}
          index={i}
          totalSiblings={node.children.length}
          parentX={x}
          parentY={y}
          expandedFolders={expandedFolders}
          toggleFolder={toggleFolder}
          onFileClick={onFileClick}
          hoveredNode={hoveredNode}
          setHoveredNode={setHoveredNode}
          scale={scale}
        />
      ))}
    </>
  );
};


export const FullscreenTreeView: React.FC<FullscreenTreeViewProps> = ({ 
  files, 
  onFileClick, 
  isOpen, 
  onClose 
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  
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
    collectFolders(tree.children);
    setExpandedFolders(allFolders);
  }, [tree]);
  
  const collapseAll = useCallback(() => {
    setExpandedFolders(new Set());
  }, []);
  
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(prev => Math.min(Math.max(prev * delta, 0.3), 2));
  }, []);
  
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    }
  }, [offset]);
  
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  }, [isDragging, dragStart]);
  
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);
  
  const resetView = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  // Auto-expand first level on open
  useEffect(() => {
    if (isOpen) {
      const firstLevel = new Set(tree.children.filter(n => n.isFolder).map(n => n.path));
      setExpandedFolders(firstLevel);
    }
  }, [isOpen, tree]);
  
  if (!isOpen) return null;
  
  const centerX = typeof window !== 'undefined' ? window.innerWidth / 2 : 500;
  const centerY = typeof window !== 'undefined' ? window.innerHeight / 2 : 400;
  
  return (
    <div className="fixed inset-0 z-[100] bg-[#0a0a0f] overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/10 via-transparent to-purple-900/10" />
        {/* Floating particles */}
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-blue-500/30 rounded-full animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${5 + Math.random() * 10}s`,
            }}
          />
        ))}
        {/* Grid lines */}
        <svg className="absolute inset-0 w-full h-full opacity-10">
          <defs>
            <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#3b82f6" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>
      
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-gradient-to-b from-[#0a0a0f] to-transparent">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Folder className="text-yellow-500" size={28} />
            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Repository Structure
            </span>
          </h1>
          <span className="text-gray-500 text-sm">{files.length} files</span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={expandAll}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
          >
            Collapse All
          </button>
          <button
            onClick={resetView}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
          >
            Reset View
          </button>
          <div className="flex items-center gap-1 ml-2 bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setScale(s => Math.max(s - 0.1, 0.3))}
              className="p-1.5 hover:bg-gray-700 rounded text-gray-400"
            >
              <ZoomOut size={18} />
            </button>
            <span className="text-gray-400 text-sm w-12 text-center">{Math.round(scale * 100)}%</span>
            <button
              onClick={() => setScale(s => Math.min(s + 0.1, 2))}
              className="p-1.5 hover:bg-gray-700 rounded text-gray-400"
            >
              <ZoomIn size={18} />
            </button>
          </div>
          <button
            onClick={onClose}
            className="ml-4 p-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>
      </div>
      
      {/* Tree Canvas */}
      <div
        ref={containerRef}
        className={`absolute inset-0 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          className="absolute transition-transform duration-100"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: 'center center',
          }}
        >
          {/* Root node and children */}
          {tree.children.map((child, i) => (
            <AnimatedNode
              key={child.path}
              node={child}
              depth={0}
              index={i}
              totalSiblings={tree.children.length}
              parentX={centerX - 100}
              parentY={centerY}
              expandedFolders={expandedFolders}
              toggleFolder={toggleFolder}
              onFileClick={(path) => { onFileClick(path); onClose(); }}
              hoveredNode={hoveredNode}
              setHoveredNode={setHoveredNode}
              scale={scale}
            />
          ))}
        </div>
      </div>
      
      {/* Instructions */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 text-gray-500 text-sm">
        <span>🖱️ Drag to pan</span>
        <span>⚙️ Scroll to zoom</span>
        <span>📁 Click folders to expand</span>
        <span>📄 Click files to navigate</span>
      </div>
      
      {/* CSS for animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.3; }
          25% { transform: translateY(-20px) translateX(10px); opacity: 0.6; }
          50% { transform: translateY(-10px) translateX(-10px); opacity: 0.3; }
          75% { transform: translateY(-30px) translateX(5px); opacity: 0.5; }
        }
        .animate-float {
          animation: float 10s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};
