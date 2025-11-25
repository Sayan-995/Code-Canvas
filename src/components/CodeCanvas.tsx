import React, { useEffect, useCallback, useRef, useState } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  MiniMap, 
  useNodesState, 
  useEdgesState,
  Edge,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { FileStructure } from '../store/useFileStore';
import { FileNode } from './FileNode';
import { FlowEdge } from './FlowEdge';

const nodeTypes = {
  fileNode: FileNode,
};

const edgeTypes = {
  flowEdge: FlowEdge,
};

type FlowStep = 
  | { type: 'highlight-def'; file: string; func: string }
  | { type: 'highlight-call'; file: string; line: number }
  | { type: 'highlight-return'; file: string; lines: number[] }
  | { type: 'highlight-endpoint'; file: string; line: number }
  | { type: 'animate-edge'; fromFile: string; toFile: string; fromLine: number; toFunc: string }
  | { type: 'return-edge'; fromFile: string; toFile: string; fromFunc: string; toLine: number };

interface CodeCanvasProps {
  files: FileStructure[];
  onBack: () => void;
  onFileUpdate: (path: string, newContent: string) => void;
}

export const CodeCanvas: React.FC<CodeCanvasProps> = ({ files, onBack, onFileUpdate }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedFunction, setSelectedFunction] = useState<string | null>(null);
  
  // Flow Tracking State
  const [flowPath, setFlowPath] = useState<FlowStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlayingFlow, setIsPlayingFlow] = useState(false);

  const nodesRef = useRef(nodes);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  const resolveFunctionDefinition = useCallback((currentFile: FileStructure, funcName: string) => {
      // Check local functions
      if (currentFile.analysis?.functions.some(f => f.name === funcName)) {
          return { file: currentFile.path, func: funcName };
      }
      
      // Check imports
      const importInfo = currentFile.analysis?.imports.find(i => 
          i.namedImports.includes(funcName) || i.defaultImport === funcName
      );
      
      if (importInfo) {
          // Resolve module path to file path
          // This is tricky without a real resolver, but we can try to match filenames
          // import ... from './controllers/authController' -> authController.ts
          const moduleName = importInfo.moduleSpecifier.split('/').pop(); // authController
          const targetFile = files.find(f => f.name.startsWith(moduleName!));
          if (targetFile) {
              return { file: targetFile.path, func: funcName };
          }
      }
      return null;
  }, [files]);

  const generateFlowPath = useCallback((startFile: string, startName: string, startType: 'func' | 'endpoint' = 'func') => {
    const steps: FlowStep[] = [];
    const visited = new Set<string>();

    const traverse = (currentFile: string, currentFunc: string) => {
      const key = `${currentFile}:${currentFunc}`;
      if (visited.has(key)) return;
      visited.add(key);

      // 1. Highlight Definition
      steps.push({ type: 'highlight-def', file: currentFile, func: currentFunc });

      const fileData = files.find(f => f.path === currentFile);
      if (!fileData?.analysis) return;
      const funcInfo = fileData.analysis.functions.find(f => f.name === currentFunc);
      if (!funcInfo) return;

      // 2. Process calls
      for (const call of funcInfo.calls) {
        const targetFile = files.find(f => 
          f.analysis?.functions.some(func => func.name === call.name)
        );

        if (targetFile) {
          // Highlight the call site
          steps.push({ type: 'highlight-call', file: currentFile, line: call.line });
          
          // Animate edge to target
          steps.push({ 
            type: 'animate-edge', 
            fromFile: currentFile, 
            toFile: targetFile.path, 
            fromLine: call.line, 
            toFunc: call.name 
          });

          // Recurse
          traverse(targetFile.path, call.name);
          
          // Highlight returns in the called function before returning
          const calledFunc = targetFile.analysis?.functions.find(f => f.name === call.name);
          if (calledFunc && calledFunc.returns && calledFunc.returns.length > 0) {
             steps.push({
                 type: 'highlight-return',
                 file: targetFile.path,
                 lines: calledFunc.returns
             });
          }

          // Return edge (Data returning)
          steps.push({
            type: 'return-edge',
            fromFile: targetFile.path,
            toFile: currentFile,
            fromFunc: call.name,
            toLine: call.line
          });

          // Return focus to current file
          steps.push({ type: 'highlight-def', file: currentFile, func: currentFunc });
        }
      }
    };

    if (startType === 'endpoint') {
        const fileData = files.find(f => f.path === startFile);
        if (fileData?.analysis) {
            const endpoint = fileData.analysis.endpoints.find(e => e.path === startName);
            if (endpoint) {
                // 1. Highlight Endpoint
                steps.push({ type: 'highlight-endpoint', file: startFile, line: endpoint.line });
                
                // 2. Resolve Handler
                const handlerLoc = resolveFunctionDefinition(fileData, endpoint.handler);
                if (handlerLoc) {
                    // 3. Animate Edge to Handler
                    steps.push({
                        type: 'animate-edge',
                        fromFile: startFile,
                        toFile: handlerLoc.file,
                        fromLine: endpoint.line,
                        toFunc: handlerLoc.func
                    });
                    
                    // 4. Traverse Handler
                    traverse(handlerLoc.file, handlerLoc.func);

                    // 5. Highlight Returns in Handler (if any)
                    const handlerFile = files.find(f => f.path === handlerLoc.file);
                    const handlerFuncInfo = handlerFile?.analysis?.functions.find(f => f.name === handlerLoc.func);
                    if (handlerFuncInfo && handlerFuncInfo.returns && handlerFuncInfo.returns.length > 0) {
                        steps.push({
                            type: 'highlight-return',
                            file: handlerLoc.file,
                            lines: handlerFuncInfo.returns
                        });
                    }

                    // 6. Return Edge to Endpoint
                    steps.push({
                        type: 'return-edge',
                        fromFile: handlerLoc.file,
                        toFile: startFile,
                        fromFunc: handlerLoc.func,
                        toLine: endpoint.line
                    });
                    
                    // 7. Highlight Endpoint again
                    steps.push({ type: 'highlight-endpoint', file: startFile, line: endpoint.line });
                }
            }
        }
    } else {
        traverse(startFile, startName);
    }
    
    return steps;
  }, [files, resolveFunctionDefinition]);

  const handleTrackFlow = useCallback((name: string, path: string, type: 'func' | 'endpoint' = 'func') => {
    const pathSteps = generateFlowPath(path, name, type);
    if (pathSteps.length > 0) {
      setFlowPath(pathSteps);
      setCurrentStepIndex(0);
      setIsPlayingFlow(true);
      setSelectedFunction(null); // Clear selection to focus on flow
    }
  }, [generateFlowPath]);

  // Animation Loop
  useEffect(() => {
    if (!isPlayingFlow || flowPath.length === 0) return;

    const step = flowPath[currentStepIndex];
    // Dynamic duration based on step type
    let duration = 1000;
    if (step.type === 'animate-edge') {
        duration = 2500; // 2s animation + buffer
    } else if (step.type === 'return-edge') {
        duration = 2500; // 2s animation + buffer
    } else if (step.type === 'highlight-return') {
        duration = 800; // Slightly longer to see the returns
    } else if (step.type === 'highlight-endpoint') {
        duration = 800;
    } else {
        duration = 300; // Faster for function highlighting
    }

    const timer = setTimeout(() => {
      if (currentStepIndex < flowPath.length - 1) {
        setCurrentStepIndex(prev => prev + 1);
      } else {
        setIsPlayingFlow(false);
        setCurrentStepIndex(0);
        setFlowPath([]);
        setEdges(prev => prev.filter(e => !e.id.startsWith('flow-')));
      }
    }, duration);

    return () => clearTimeout(timer);
  }, [isPlayingFlow, currentStepIndex, flowPath]);

  // Update Nodes and Edges based on current step
  useEffect(() => {
    if (!isPlayingFlow || flowPath.length === 0) {
        // Reset active states when not playing
        setNodes(prev => prev.map(n => ({
            ...n,
            data: { ...n.data, activeFlowLine: null, activeFlowFunction: null }
        })));
        return;
    }

    const step = flowPath[currentStepIndex];

    // Update Nodes
    setNodes(prev => prev.map(n => {
      const newData = { ...n.data, activeFlowLine: null, activeFlowFunction: null, activeReturnLines: null };
      
      if (step.type === 'highlight-def' && n.id === step.file) {
        newData.activeFlowFunction = step.func;
      } else if (step.type === 'highlight-call' && n.id === step.file) {
        newData.activeFlowLine = step.line;
      } else if (step.type === 'animate-edge' && n.id === step.fromFile) {
         newData.activeFlowLine = step.fromLine;
      } else if (step.type === 'highlight-return' && n.id === step.file) {
         newData.activeReturnLines = step.lines;
      } else if (step.type === 'highlight-endpoint' && n.id === step.file) {
         newData.activeFlowLine = step.line;
      }

      return { ...n, data: newData };
    }));

    // Update Edges
    if (step.type === 'animate-edge' || step.type === 'return-edge') {
      const currentNodes = nodesRef.current;
      const sourceNode = currentNodes.find(n => n.id === step.fromFile);
      const targetNode = currentNodes.find(n => n.id === step.toFile);
      const isTargetRight = (sourceNode?.position.x || 0) < (targetNode?.position.x || 0);

      const isReturn = step.type === 'return-edge';
      // For return edge: source is the called function (def), target is the caller (call site)
      // For call edge: source is the caller (call site), target is the called function (def)
      
      let sourceHandle, targetHandle;
      let edgeId;

      if (isReturn) {
         // Returning FROM function def TO call site
         // step.fromFunc is the function name we are returning from
         // step.toLine is the line we are returning to
         sourceHandle = `def-return-${step.fromFunc}-${isTargetRight ? 'right' : 'left'}`;
         targetHandle = `call-return-${step.fromFunc}-${step.toLine}-${isTargetRight ? 'left' : 'right'}`;
         edgeId = `flow-return-${step.fromFile}-${step.toFile}-${step.fromFunc}`;
      } else {
         // Calling FROM call site TO function def
         // step.toFunc is the function we are calling
         // step.fromLine is the line we are calling from
         sourceHandle = `call-${step.toFunc}-${step.fromLine}-${isTargetRight ? 'right' : 'left'}`;
         targetHandle = `def-${step.toFunc}-${isTargetRight ? 'left' : 'right'}`;
         edgeId = `flow-call-${step.fromFile}-${step.toFile}-${step.toFunc}`;
      }
      
      setEdges(prev => {
        const filtered = prev.filter(e => !e.id.startsWith('flow-'));
        return [...filtered, {
          id: edgeId,
          source: step.fromFile,
          target: step.toFile,
          sourceHandle,
          targetHandle,
          type: 'flowEdge',
          animated: false, 
          data: { isReturning: isReturn },
          style: { 
              stroke: isReturn ? '#e879f9' : '#22d3ee', // Brighter Purple (fuchsia-400) for return, Cyan for call
              strokeWidth: 3, // Thicker for both
          }, 
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: isReturn ? '#e879f9' : '#22d3ee',
          },
        }];
      });
    } else {
        // Keep existing flow edges or clear them? 
        // Let's keep the last flow edge until a new one appears or flow ends
        // Actually, better to clear flow edges when not in animate-edge step to avoid clutter?
        // Or keep them to show the path?
        // Let's clear them for now to focus on the "current" movement
        // setEdges(prev => prev.filter(e => !e.id.startsWith('flow-edge-')));
    }

  }, [isPlayingFlow, currentStepIndex, flowPath, setNodes, setEdges]);

  const createEdges = useCallback((name: string, type: 'def' | 'call', sourcePath: string) => {
    // ...existing code...
    const newEdges: Edge[] = [];
    const currentNodes = nodesRef.current;
    const sourceNode = currentNodes.find(n => n.id === sourcePath);

    if (type === 'call') {
      const sourceFile = files.find(f => f.path === sourcePath);
      if (!sourceFile || !sourceFile.analysis) return [];

      const targetFile = files.find(f => 
        f.analysis?.functions.some(func => func.name === name)
      );

      if (targetFile) {
        const targetNode = currentNodes.find(n => n.id === targetFile.path);
        const isTargetRight = (sourceNode?.position.x || 0) < (targetNode?.position.x || 0);

        const calls = sourceFile.analysis.functions.flatMap(f => f.calls).filter(c => c.name === name);
        
        calls.forEach(call => {
          newEdges.push({
            id: `edge-${sourcePath}-${targetFile.path}-${name}-${call.line}`,
            source: sourcePath,
            target: targetFile.path,
            sourceHandle: `call-${name}-${call.line}-${isTargetRight ? 'right' : 'left'}`,
            targetHandle: `def-${name}-${isTargetRight ? 'left' : 'right'}`,
            animated: true,
            style: { stroke: '#a855f7', strokeWidth: 2, pointerEvents: 'none' },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: '#a855f7',
            },
          });
        });
      }
    } else if (type === 'def') {
       files.forEach(f => {
           if (!f.analysis) return;
           const calls = f.analysis.functions.flatMap(func => func.calls).filter(c => c.name === name);
           
           if (calls.length > 0) {
               const callerNode = currentNodes.find(n => n.id === f.path);
               // sourcePath is the def file here
               const defNode = currentNodes.find(n => n.id === sourcePath); 
               const isDefRight = (callerNode?.position.x || 0) < (defNode?.position.x || 0);

               calls.forEach(call => {
                   newEdges.push({
                       id: `edge-${f.path}-${sourcePath}-${name}-${call.line}`,
                       source: f.path,
                       target: sourcePath,
                       sourceHandle: `call-${name}-${call.line}-${isDefRight ? 'right' : 'left'}`,
                       targetHandle: `def-${name}-${isDefRight ? 'left' : 'right'}`,
                       animated: true,
                       style: { stroke: '#3b82f6', strokeWidth: 2, pointerEvents: 'none' },
                       markerEnd: {
                           type: MarkerType.ArrowClosed,
                           color: '#3b82f6',
                       },
                   });
               });
           }
       });
    }
    return newEdges;
  }, [files]);

  const handleHover = useCallback((name: string, type: 'def' | 'call', sourcePath: string) => {
    if (selectedFunction) return; // Don't show hover edges if something is selected
    const newEdges = createEdges(name, type, sourcePath);
    setEdges(prev => [...prev.filter(e => !e.id.startsWith('edge-')), ...newEdges]);
  }, [createEdges, setEdges, selectedFunction]);

  const handleClick = useCallback((name: string, type: 'def' | 'call', sourcePath: string) => {
    setSelectedFunction(name);
    const newEdges = createEdges(name, type, sourcePath);
    setEdges(prev => [...prev.filter(e => !e.id.startsWith('edge-')), ...newEdges]);
  }, [createEdges, setEdges]);

  const handleLeave = useCallback(() => {
    if (selectedFunction) return; // Don't clear edges if something is selected
    setEdges(prev => prev.filter(e => !e.id.startsWith('edge-')));
  }, [setEdges, selectedFunction]);

  const onPaneClick = useCallback(() => {
    setSelectedFunction(null);
    setEdges(prev => prev.filter(e => !e.id.startsWith('edge-')));
  }, [setEdges]);

  useEffect(() => {
    if (files.length === 0) return;

    setNodes((prevNodes) => {
      return files.map((file, index) => {
        const existingNode = prevNodes.find((n) => n.id === file.path);
        
        // If node exists, keep its position, otherwise calculate initial position
        const position = existingNode 
          ? existingNode.position 
          : { x: (index % 4) * 600, y: Math.floor(index / 4) * 800 };

        return {
          id: file.path,
          type: 'fileNode',
          position,
          // Preserve width/height/style if they exist (from resizing)
          style: existingNode?.style,
          width: existingNode?.width,
          height: existingNode?.height,
          data: { 
            name: file.name,
            path: file.path,
            content: file.content,
            language: file.language,
            analysis: file.analysis,
            onHover: handleHover,
            onLeave: handleLeave,
            onClick: handleClick,
            onTrackFlow: handleTrackFlow,
            selectedFunction: selectedFunction,
            onContentChange: onFileUpdate
          },
        };
      });
    });
  }, [files, setNodes, handleHover, handleLeave, handleClick, handleTrackFlow, selectedFunction, onFileUpdate]);

  return (
    <div className="w-full h-screen bg-[#1e1e1e] relative">
      <style>{`
        .react-flow__edges {
          z-index: 2000 !important;
          pointer-events: none;
        }
        .react-flow__nodes {
          z-index: 1000 !important;
        }
        .react-flow__edge-path {
          stroke-linecap: round;
          stroke-linejoin: round;
        }
        
        @keyframes draw-line {
          from { stroke-dashoffset: 1; opacity: 0; }
          to { stroke-dashoffset: 0; opacity: 1; }
        }

        .animate-draw-line {
          animation: draw-line 2s ease-out forwards;
          opacity: 0; /* Start hidden, animate to 1 */
        }
      `}</style>
      <div className="absolute top-4 left-4 z-10">
        <button 
          onClick={onBack}
          className="bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-700 hover:bg-gray-700 transition-colors"
        >
          Back to Upload
        </button>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        minZoom={0.1}
        onPaneClick={onPaneClick}
      >
        <Background color="#333" gap={20} />
        <Controls />
        <MiniMap style={{ background: '#252526' }} nodeColor="#555" />
      </ReactFlow>
    </div>
  );
};
