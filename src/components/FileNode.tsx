import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Handle, Position, NodeProps, useReactFlow, useNodeId } from 'reactflow';
import { FileCode, Edit2, Save, X, Play, Sparkles } from 'lucide-react';
import { FileAnalysis } from '../utils/codeAnalyzer';
import { explainCode } from '../services/gemini';
import { useExplanationStore } from '../store/useExplanationStore';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-css';
import 'prismjs/themes/prism-tomorrow.css'; // Import a dark theme for syntax highlighting

interface FileNodeData {
  name: string;
  path: string;
  content: string;
  language: string;
  analysis?: FileAnalysis;
  onHover: (name: string, type: 'def' | 'call', path: string) => void;
  onLeave: () => void;
  onClick: (name: string, type: 'def' | 'call', path: string) => void;
  onContentChange: (path: string, newContent: string) => void;
  onTrackFlow: (name: string, path: string, type?: 'func' | 'endpoint') => void;
  selectedFunction?: string | null;
  activeFlowLine?: number | null;
  activeFlowFunction?: string | null;
  activeReturnLines?: number[] | null;
}

const tokenColors: Record<string, string> = {
  'comment': '#6a9955',
  'string': '#ce9178',
  'keyword': '#569cd6',
  'boolean': '#569cd6',
  'function': '#dcdcaa',
  'class-name': '#4ec9b0',
  'operator': '#d4d4d4',
  'punctuation': '#d4d4d4',
  'number': '#b5cea8',
  'property': '#9cdcfe',
  'variable': '#9cdcfe',
  'parameter': '#9cdcfe',
  'builtin': '#4ec9b0',
  'console': '#9cdcfe',
};

const flattenTokens = (token: string | Prism.Token, parentType?: string): { text: string, type: string }[] => {
  if (typeof token === 'string') {
    return [{ text: token, type: parentType || 'plain' }];
  }
  
  const type = token.type;
  const content = token.content;
  
  if (typeof content === 'string') {
    return [{ text: content, type }];
  }
  
  if (Array.isArray(content)) {
    return content.flatMap(t => flattenTokens(t, type));
  }
  
  return flattenTokens(content as any, type);
};

export const FileNode: React.FC<NodeProps<FileNodeData>> = ({ data }) => {
  const [hoveredFunction, setHoveredFunction] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(data.content);
  
  const { openExplanation } = useExplanationStore();
  
  const nodeId = useNodeId();
  const { setNodes, getNode } = useReactFlow();
  const resizeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setEditContent(data.content);
  }, [data.content]);

  // Custom resize logic to allow width resizing while keeping height auto
  useEffect(() => {
    const handle = resizeRef.current;
    if (!handle || !nodeId) return;

    const onMouseDown = (e: MouseEvent) => {
      e.stopPropagation(); // Prevent node dragging
      const startX = e.clientX;
      const node = getNode(nodeId);
      const startWidth = node?.width || node?.style?.width || 500; // Default width

      const onMouseMove = (evt: MouseEvent) => {
        const deltaX = evt.clientX - startX;
        const currentWidth = (typeof startWidth === 'number' ? startWidth : parseInt(startWidth as string));
        const newWidth = Math.max(300, currentWidth + deltaX);
        
        setNodes(nodes => nodes.map(n => {
          if (n.id === nodeId) {
            return {
              ...n,
              style: { ...n.style, width: newWidth, height: 'auto' },
              width: newWidth,
              // Ensure height is undefined/auto so it grows with content
            };
          }
          return n;
        }));
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    handle.addEventListener('mousedown', onMouseDown);
    return () => {
      handle.removeEventListener('mousedown', onMouseDown);
    };
  }, [nodeId, setNodes, getNode]);

  const handleSave = () => {
    data.onContentChange(data.path, editContent);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditContent(data.content);
    setIsEditing(false);
  };

  const highlightCode = (code: string) => {
    const lang = data.language === 'typescript' ? 'typescript' : data.language;
    const grammar = Prism.languages[lang] || Prism.languages.javascript;
    return Prism.highlight(code, grammar, lang);
  };

  const renderSegment = (text: string, type: string, lineNumber: number, key: string) => {
    const trimmedText = text.trim();
    // Remove quotes for endpoint check if it's a string
    const cleanText = type === 'string' ? trimmedText.replace(/['"`]/g, '') : trimmedText;
    
    const isFuncDef = data.analysis?.functions.find(f => f.name === trimmedText && f.startLine === lineNumber);
    const isFuncCall = data.analysis?.functions.flatMap(f => f.calls).find(c => c.name === trimmedText && c.line === lineNumber);
    const isEndpoint = data.analysis?.endpoints?.find(e => e.path === cleanText && e.line === lineNumber);

    if (isEndpoint) {
        const isSelected = data.selectedFunction === cleanText;
        const isActiveFlow = data.activeFlowLine === lineNumber; // Reusing activeFlowLine for endpoint highlight

        return (
            <span key={key} className="relative inline-block">
              <span 
                style={{ color: isActiveFlow ? '#22d3ee' : (tokenColors['string'] || '#ce9178') }}
                className={`cursor-pointer rounded transition-all duration-500 relative z-10 ${
                  (isSelected || hoveredFunction === cleanText)
                    ? 'bg-green-500 text-white shadow-[0_0_0_2px_#22c55e,0_0_10px_rgba(34,197,94,0.8)]' 
                    : isActiveFlow
                      ? 'text-cyan-400 font-bold drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]'
                      : 'hover:bg-green-500/20'
                }`}
                onMouseEnter={() => {
                    // data.onHover(cleanText, 'endpoint', data.path); // Endpoint hover not implemented yet
                    setHoveredFunction(cleanText);
                }}
                onMouseLeave={() => {
                    // data.onLeave();
                    setHoveredFunction(null);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  // data.onClick(cleanText, 'endpoint', data.path);
                  // Select it to show button
                  data.onClick(cleanText, 'def', data.path); // Reusing 'def' type for selection logic for now
                }}
              >
                {text}
              </span>
              {isSelected && (
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex gap-1 z-50 animate-in fade-in slide-in-from-bottom-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        data.onTrackFlow(cleanText, data.path, 'endpoint');
                      }}
                      className="bg-gradient-to-r from-gray-900 to-black hover:from-black hover:to-gray-900 text-white border border-gray-700 text-xs font-bold px-3 py-1.5 rounded-full shadow-xl flex items-center gap-2 whitespace-nowrap"
                    >
                      <Play size={10} fill="currentColor" className="text-white" /> Track API
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExplain('endpoint', cleanText);
                      }}
                      className="bg-gradient-to-r from-purple-900 to-black hover:from-black hover:to-purple-900 text-white border border-purple-700 text-xs font-bold px-3 py-1.5 rounded-full shadow-xl flex items-center gap-2 whitespace-nowrap"
                    >
                      <Sparkles size={10} className="text-purple-300" /> Explain
                    </button>
                </div>
              )}
            </span>
          );
    } else if (isFuncDef) {
      const isSelected = data.selectedFunction === trimmedText;
      const isActiveFlow = data.activeFlowFunction === trimmedText;
      
      return (
        <span key={key} className="relative inline-block">
          <span 
            style={{ color: isActiveFlow ? '#22d3ee' : (tokenColors['function'] || '#dcdcaa') }}
            className={`cursor-pointer rounded transition-all duration-500 relative z-10 ${
              (isSelected || hoveredFunction === trimmedText)
                ? 'bg-blue-500 text-white shadow-[0_0_0_2px_#3b82f6,0_0_10px_rgba(59,130,246,0.8)]' 
                : isActiveFlow
                  ? 'text-cyan-400 font-bold drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]'
                  : 'hover:bg-blue-500/20'
            }`}
            onMouseEnter={() => {
                data.onHover(trimmedText, 'def', data.path);
                setHoveredFunction(trimmedText);
            }}
            onMouseLeave={() => {
                data.onLeave();
                setHoveredFunction(null);
            }}
            onClick={(e) => {
              e.stopPropagation();
              data.onClick(trimmedText, 'def', data.path);
            }}
          >
            {text}
          </span>
          {isSelected && (
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex gap-1 z-50 animate-in fade-in slide-in-from-bottom-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    data.onTrackFlow(trimmedText, data.path);
                  }}
                  className="bg-gradient-to-r from-gray-900 to-black hover:from-black hover:to-gray-900 text-white border border-gray-700 text-xs font-bold px-3 py-1.5 rounded-full shadow-xl flex items-center gap-2 whitespace-nowrap"
                >
                  <Play size={10} fill="currentColor" className="text-white" /> Track Flow
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExplain('function', trimmedText);
                  }}
                  className="bg-gradient-to-r from-purple-900 to-black hover:from-black hover:to-purple-900 text-white border border-purple-700 text-xs font-bold px-3 py-1.5 rounded-full shadow-xl flex items-center gap-2 whitespace-nowrap"
                >
                  <Sparkles size={10} className="text-purple-300" /> Explain
                </button>
            </div>
          )}
        </span>
      );
    } else if (isFuncCall) {
      const isActiveFlow = data.activeFlowLine === lineNumber;
      return (
        <span 
          key={key} 
          style={{ color: tokenColors['function'] || '#dcdcaa' }}
          className={`cursor-pointer rounded transition-colors relative z-10 ${
            (data.selectedFunction === trimmedText || hoveredFunction === trimmedText)
              ? 'bg-purple-500 text-white shadow-[0_0_0_2px_#a855f7,0_0_10px_rgba(168,85,247,0.8)]' 
              : 'hover:bg-purple-500/20'
          } ${isActiveFlow ? 'text-cyan-400 font-bold' : ''}`}
          onMouseEnter={() => {
              data.onHover(trimmedText, 'call', data.path);
              setHoveredFunction(trimmedText);
          }}
          onMouseLeave={() => {
              data.onLeave();
              setHoveredFunction(null);
          }}
          onClick={(e) => {
            e.stopPropagation();
            data.onClick(trimmedText, 'call', data.path);
          }}
        >
          {text}
        </span>
      );
    } else {
      return (
        <span key={key} style={{ color: tokenColors[type] || '#d4d4d4' }}>
          {text}
        </span>
      );
    }
  };

  const lines = useMemo(() => {
    if (isEditing) return [];
    const grammar = Prism.languages[data.language === 'typescript' ? 'typescript' : data.language] || Prism.languages.javascript;
    const tokens = Prism.tokenize(data.content, grammar);
    const segments = tokens.flatMap(t => flattenTokens(t));
    
    const result: React.ReactNode[][] = [];
    let currentLine: React.ReactNode[] = [];
    let lineNumber = 1;

    segments.forEach((segment, segIndex) => {
      const { text, type } = segment;
      if (text.includes('\n')) {
        const parts = text.split('\n');
        parts.forEach((part, index) => {
          if (part) {
             currentLine.push(renderSegment(part, type, lineNumber, `${segIndex}-${index}`));
          }
          if (index < parts.length - 1) {
            result.push(currentLine);
            currentLine = [];
            lineNumber++;
          }
        });
      } else {
        currentLine.push(renderSegment(text, type, lineNumber, `${segIndex}`));
      }
    });
    
    if (currentLine.length > 0) result.push(currentLine);
    
    return result;
  }, [data.content, data.language, data.analysis, data.selectedFunction, hoveredFunction, data.path, isEditing]);

  const isLineInHighlightedFunction = (lineIndex: number) => {
    const targetFunc = data.selectedFunction || hoveredFunction;
    if (!targetFunc || !data.analysis) return false;
    const func = data.analysis.functions.find(f => f.name === targetFunc);
    if (!func) return false;
    const lineNumber = lineIndex + 1;
    return lineNumber >= func.startLine && lineNumber <= func.endLine;
  };

  useEffect(() => {
    if (data.activeFlowLine && resizeRef.current) {
      // Scroll to line logic could go here if we had a ref to the container
      // For now, the visual highlight is enough
    }
  }, [data.activeFlowLine]);

  // Helper to get handles for a line
  const getHandlesForLine = (lineIndex: number) => {
    if (!data.analysis) return null;
    const lineNumber = lineIndex + 1;
    
    const defs = data.analysis.functions.filter(f => f.startLine === lineNumber);
    const calls = data.analysis.functions.flatMap(f => f.calls).filter(c => c.line === lineNumber);
    const endpoints = data.analysis.endpoints?.filter(e => e.line === lineNumber) || [];
    
    return (
      <>
        {defs.map(f => (
          <React.Fragment key={`def-${f.name}`}>
            <Handle 
              type="target" 
              position={Position.Left} 
              id={`def-${f.name}-left`} 
              style={{ top: '50%', left: 0, transform: 'translate(-50%, -50%)', opacity: 0, width: 1, height: 1, pointerEvents: 'none' }} 
            />
            <Handle 
              type="target" 
              position={Position.Right} 
              id={`def-${f.name}-right`} 
              style={{ top: '50%', right: 0, transform: 'translate(50%, -50%)', opacity: 0, width: 1, height: 1, pointerEvents: 'none' }} 
            />
            {/* Return Source Handles */}
            <Handle 
              type="source" 
              position={Position.Left} 
              id={`def-return-${f.name}-left`} 
              style={{ top: '50%', left: 0, transform: 'translate(-50%, -50%)', opacity: 0, width: 1, height: 1, pointerEvents: 'none' }} 
            />
            <Handle 
              type="source" 
              position={Position.Right} 
              id={`def-return-${f.name}-right`} 
              style={{ top: '50%', right: 0, transform: 'translate(50%, -50%)', opacity: 0, width: 1, height: 1, pointerEvents: 'none' }} 
            />
          </React.Fragment>
        ))}
        {calls.map(c => (
          <React.Fragment key={`call-${c.name}-${c.line}`}>
            <Handle 
              type="source" 
              position={Position.Left} 
              id={`call-${c.name}-${c.line}-left`} 
              style={{ top: '50%', left: 0, transform: 'translate(-50%, -50%)', opacity: 0, width: 1, height: 1, pointerEvents: 'none' }} 
            />
            <Handle 
              type="source" 
              position={Position.Right} 
              id={`call-${c.name}-${c.line}-right`} 
              style={{ top: '50%', right: 0, transform: 'translate(50%, -50%)', opacity: 0, width: 1, height: 1, pointerEvents: 'none' }} 
            />
            {/* Return Target Handles */}
            <Handle 
              type="target" 
              position={Position.Left} 
              id={`call-return-${c.name}-${c.line}-left`} 
              style={{ top: '50%', left: 0, transform: 'translate(-50%, -50%)', opacity: 0, width: 1, height: 1, pointerEvents: 'none' }} 
            />
            <Handle 
              type="target" 
              position={Position.Right} 
              id={`call-return-${c.name}-${c.line}-right`} 
              style={{ top: '50%', right: 0, transform: 'translate(50%, -50%)', opacity: 0, width: 1, height: 1, pointerEvents: 'none' }} 
            />
          </React.Fragment>
        ))}
        {endpoints.map(e => (
          <React.Fragment key={`endpoint-${e.method}-${e.path}`}>
            {/* Source Handles for calling the handler */}
            <Handle 
              type="source" 
              position={Position.Left} 
              id={`call-${e.handler}-${e.line}-left`} 
              style={{ top: '50%', left: 0, transform: 'translate(-50%, -50%)', opacity: 0, width: 1, height: 1, pointerEvents: 'none' }} 
            />
            <Handle 
              type="source" 
              position={Position.Right} 
              id={`call-${e.handler}-${e.line}-right`} 
              style={{ top: '50%', right: 0, transform: 'translate(50%, -50%)', opacity: 0, width: 1, height: 1, pointerEvents: 'none' }} 
            />
            {/* Target Handles for return from handler */}
            <Handle 
              type="target" 
              position={Position.Left} 
              id={`call-return-${e.handler}-${e.line}-left`} 
              style={{ top: '50%', left: 0, transform: 'translate(-50%, -50%)', opacity: 0, width: 1, height: 1, pointerEvents: 'none' }} 
            />
            <Handle 
              type="target" 
              position={Position.Right} 
              id={`call-return-${e.handler}-${e.line}-right`} 
              style={{ top: '50%', right: 0, transform: 'translate(50%, -50%)', opacity: 0, width: 1, height: 1, pointerEvents: 'none' }} 
            />
          </React.Fragment>
        ))}
      </>
    );
  };

  const handleExplain = async (type: 'file' | 'function' | 'endpoint', targetName?: string) => {
    const title = targetName ? `Explaining ${targetName}` : `Explaining ${data.name}`;
    openExplanation(title, '', true);

    try {
      let codeToExplain = data.content;
      let context = `File: ${data.path}`;

      if (type === 'function' && targetName && data.analysis) {
        const func = data.analysis.functions.find(f => f.name === targetName);
        if (func) {
            const lines = data.content.split('\n');
            codeToExplain = lines.slice(func.startLine - 1, func.endLine).join('\n');
            context = `Function: ${targetName} in ${data.path}`;
        }
      } else if (type === 'endpoint' && targetName && data.analysis) {
         const endpoint = data.analysis.endpoints?.find(e => e.path === targetName);
         
         if (endpoint) {
             const func = data.analysis.functions.find(f => f.name === endpoint.handler);
             if (func) {
                const lines = data.content.split('\n');
                codeToExplain = lines.slice(func.startLine - 1, func.endLine).join('\n');
                context = `Endpoint: ${endpoint.method} ${endpoint.path} (Handler: ${endpoint.handler})`;
             } else {
                const lines = data.content.split('\n');
                const start = Math.max(0, endpoint.line - 5);
                const end = Math.min(lines.length, endpoint.line + 20);
                codeToExplain = lines.slice(start, end).join('\n');
                context = `Endpoint: ${endpoint.method} ${endpoint.path}`;
             }
         }
      }

      const explanation = await explainCode(codeToExplain, type, context);
      // We need to update the store with the result, but openExplanation overwrites everything.
      // So we need a way to update just content/loading.
      // Let's use the store's setContent and setIsLoading directly if we exposed them, 
      // or just call openExplanation again with the result.
      useExplanationStore.getState().setContent(explanation);
      useExplanationStore.getState().setIsLoading(false);
    } catch (error) {
      useExplanationStore.getState().setContent('Failed to generate explanation. Please check your API key and try again.');
      useExplanationStore.getState().setIsLoading(false);
      console.error(error);
    }
  };

  return (
    <div className="relative group h-auto w-full">
      {/* Custom Resize Handle */}
      <div 
        ref={resizeRef}
        className="absolute right-[-5px] top-0 bottom-0 w-4 cursor-ew-resize z-50 bg-transparent"
        title="Drag to resize width"
      />

      <div className="bg-[#1e1e1e] border border-[#333] rounded-lg shadow-xl w-full h-auto overflow-hidden flex flex-row">
        <div className="flex-1 flex flex-col min-w-[300px]">
        {/* Header */}
        <div className="bg-[#252526] px-4 py-2 border-b border-[#333] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCode size={16} className="text-blue-400" />
            <span className="text-gray-300 text-sm font-mono truncate" title={data.path}>
              {data.path}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <button onClick={handleSave} className="p-1 hover:bg-green-500/20 rounded text-green-400" title="Save">
                  <Save size={14} />
                </button>
                <button onClick={handleCancel} className="p-1 hover:bg-red-500/20 rounded text-red-400" title="Cancel">
                  <X size={14} />
                </button>
              </>
            ) : (
              <>
                <button 
                  onClick={() => handleExplain('file')} 
                  className="p-1 hover:bg-purple-500/20 rounded text-purple-400 mr-1" 
                  title="Explain File with AI"
                >
                  <Sparkles size={14} />
                </button>
                <button onClick={() => setIsEditing(true)} className="p-1 hover:bg-gray-700 rounded text-gray-400" title="Edit">
                  <Edit2 size={14} />
                </button>
              </>
            )}
          </div>
        </div>
        
        {/* Content */}
        <div className={`p-4 bg-[#1e1e1e] text-[#d4d4d4] font-mono text-xs nodrag cursor-text select-text ${isEditing ? '' : ''}`}>
          {isEditing ? (
            <Editor
              value={editContent}
              onValueChange={setEditContent}
              highlight={highlightCode}
              padding={10}
              style={{
                fontFamily: '"Fira code", "Fira Mono", monospace',
                fontSize: 12,
                backgroundColor: '#1e1e1e',
                minHeight: '100%',
              }}
              textareaClassName="focus:outline-none"
            />
          ) : (
            <div className="whitespace-pre-wrap break-words">
              {lines.map((line, i) => {
                const isFlowLine = data.activeFlowLine === i + 1;
                const isReturnLine = data.activeReturnLines?.includes(i + 1);
                const isFlowFunc = isLineInHighlightedFunction(i);
                
                const endpointOnLine = data.analysis?.endpoints?.find(e => e.line === i + 1);
                const isEndpointLine = endpointOnLine && (
                    hoveredFunction === endpointOnLine.path || 
                    data.selectedFunction === endpointOnLine.path
                );
                
                return (
                <div 
                  key={i} 
                  id={`line-${data.path}-${i + 1}`}
                  className={`relative min-h-[1.2em] leading-relaxed pl-2 transition-colors duration-300 ${
                    isFlowLine 
                      ? 'bg-cyan-500/20 border-l-2 border-cyan-400' 
                      : isReturnLine
                        ? 'bg-purple-500/20 border-l-2 border-purple-400'
                        : isEndpointLine
                          ? 'bg-green-500/10 border-l-2 border-green-500/30'
                          : isFlowFunc 
                            ? 'bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
                            : ''
                  }`}
                >
                  {/* Line Number */}
                  <span className={`inline-block w-8 select-none text-right mr-4 ${isFlowLine ? 'text-cyan-400 font-bold' : isReturnLine ? 'text-purple-400 font-bold' : isEndpointLine ? 'text-green-400 font-bold' : 'text-[#858585]'}`}>{i + 1}</span>
                  {/* Code */}
                  {line}
                  {/* Handles for this line */}
                  {getHandlesForLine(i)}
                </div>
              )})}
            </div>
          )}
        </div>

        {/* Default Handles for file-level connections if needed */}
        <Handle type="target" position={Position.Top} className="!bg-gray-500 !w-2 !h-2 opacity-0" />
        <Handle type="source" position={Position.Bottom} className="!bg-gray-500 !w-2 !h-2 opacity-0" />
        </div>
      </div>
    </div>
  );
};
