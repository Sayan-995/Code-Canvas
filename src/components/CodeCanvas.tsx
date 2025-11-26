import React, { useEffect, useCallback, useRef, useState } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  MiniMap, 
  useNodesState, 
  useEdgesState,
  Edge,
  MarkerType,
  ReactFlowProvider,
  useReactFlow,
  useViewport,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { FileStructure, useFileStore, Drawing } from '../store/useFileStore';
import { FileNode } from './FileNode';
import { FlowEdge } from './FlowEdge';
import { DrawingNode } from './DrawingNode';
import { PenTool, MousePointer2, Eraser, Circle, Square, Minus, Type, Hand, Link as LinkIcon } from 'lucide-react';
import { useCollaboration } from '../hooks/useCollaboration';

const nodeTypes = {
  fileNode: FileNode,
  drawingNode: DrawingNode,
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
  | { type: 'return-edge'; fromFile: string; toFile: string; fromFunc: string; toLine: number }
  | { type: 'execute-line'; file: string; line: number }
  | { type: 'animate-edge-with-dot'; fromFile: string; toFile: string; fromLine: number; toFunc: string }
  | { type: 'return-edge-with-dot'; fromFile: string; toFile: string; fromFunc: string; toLine: number }
  | { type: 'prepare-return'; file: string; func: string };

interface CodeCanvasProps {
  files: FileStructure[];
  onBack: () => void;
  onFileUpdate: (path: string, newContent: string) => void;
  onFlowStateChange?: (isPlaying: boolean) => void;
}

const CodeCanvasContent: React.FC<CodeCanvasProps> = ({ files, onBack, onFileUpdate, onFlowStateChange }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedFunction, setSelectedFunction] = useState<string | null>(null);
  const { drawings, addDrawing, setDrawings } = useFileStore();
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<{x:number, y:number}[]>([]);
  const { screenToFlowPosition, setCenter } = useReactFlow();
  const { x, y, zoom } = useViewport();

  // Drawing Options
  const [currentColor, setCurrentColor] = useState('#ef4444');
  const [currentWidth, setCurrentWidth] = useState(4);
  const [tool, setTool] = useState<'select' | 'hand' | 'pen' | 'eraser' | 'rectangle' | 'circle' | 'line' | 'text'>('pen');
  
  // Flow Tracking State
  const [flowPath, setFlowPath] = useState<FlowStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlayingFlow, setIsPlayingFlow] = useState(false);
  const [executedLines, setExecutedLines] = useState<Map<string, Set<number>>>(new Map());
  const [flowSpeed, setFlowSpeed] = useState(0.5);
  const [dotProgress, setDotProgress] = useState(0);
  const animationFrameRef = useRef<number | null>(null);

  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  
  useEffect(() => {
      const params = new URLSearchParams(window.location.search);
      const room = params.get('room');
      if (room) {
          setRoomId(room);
      } else {
          const newRoom = Math.random().toString(36).substring(7);
          setRoomId(newRoom);
          const newUrl = window.location.pathname + '?room=' + newRoom;
          window.history.replaceState(null, '', newUrl);
      }
  }, []);

  const { status, addDrawingToYjs, updateDrawingInYjs, removeDrawingFromYjs } = useCollaboration(roomId);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        setIsSpacePressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const nodesRef = useRef(nodes);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  // Sync drawings to nodes
  useEffect(() => {
    setNodes(prev => {
      const nonDrawings = prev.filter(n => n.type !== 'drawingNode');
      const drawingNodes = drawings.map(d => {
          // Calculate bounding box
          if (d.points.length === 0) return null;
          
          // Use reduce to avoid stack overflow with spread operator on large arrays
          const { minX, minY } = d.points.reduce((acc, p) => ({
            minX: Math.min(acc.minX, p.x),
            minY: Math.min(acc.minY, p.y),
          }), { minX: Infinity, minY: Infinity });
          
          return {
            id: d.id,
            type: 'drawingNode',
            position: { x: minX, y: minY },
            data: { 
                id: d.id, // Pass ID for updates
                type: d.type, // Pass the type (freehand, rectangle, circle)
                points: d.points, 
                color: d.color, 
                strokeWidth: d.strokeWidth,
                text: d.text,
                onUpdate: (id: string, updates: any) => {
                    // Update local store
                    // updateDrawing(id, updates); // DrawingNode calls store directly, but we need to sync
                    // Actually DrawingNode calls store.updateDrawing. 
                    // We need to intercept or let it happen and also sync.
                    // Since we can't easily intercept store calls from here without changing DrawingNode,
                    // let's pass a special function if we want to override.
                    // But DrawingNode uses useFileStore directly.
                    // We should update DrawingNode to use the prop if available.
                    updateDrawingInYjs(id, updates);
                },
                onRemove: (id: string) => {
                    removeDrawingFromYjs(id);
                }
            },
            style: { 
                zIndex: 0, 
                pointerEvents: !isDrawing || tool === 'select' || tool === 'hand' || tool === 'eraser' || d.type === 'text' ? 'all' : 'none' 
            },
            draggable: !isDrawing || tool === 'select',
            selectable: !isDrawing || tool === 'select',
          };
      }).filter(Boolean) as any[];
      
      return [...nonDrawings, ...drawingNodes];
    });
  }, [drawings, setNodes, tool, isDrawing]);

  const onMouseDown = useCallback((event: React.MouseEvent) => {
    if (!isDrawing || isSpacePressed || tool === 'select' || tool === 'hand') return;
    
    if (tool === 'eraser') {
        return;
    }

    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    setCurrentPath([position]);
  }, [isDrawing, tool, screenToFlowPosition, isSpacePressed]);

  const onMouseMove = useCallback((event: React.MouseEvent) => {
    if (!isDrawing || currentPath.length === 0 || tool === 'eraser' || isSpacePressed || tool === 'text' || tool === 'select' || tool === 'hand') return;
    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    
    if (tool === 'pen') {
        setCurrentPath(prev => [...prev, position]);
    } else {
        // For shapes, we only need start and current end point
        setCurrentPath(prev => [prev[0], position]);
    }
  }, [isDrawing, currentPath, tool, screenToFlowPosition, isSpacePressed]);

  const onMouseUp = useCallback(() => {
    if (!isDrawing || currentPath.length === 0 || tool === 'eraser' || isSpacePressed || tool === 'select' || tool === 'hand') return;
    
    if (tool === 'text') {
        const newDrawing: Drawing = {
            id: `drawing-${Date.now()}`,
            type: 'text',
            points: [currentPath[0]], // Use only the start point
            color: currentColor,
            strokeWidth: currentWidth,
            text: '' // Start with empty text to trigger edit mode
        };
        addDrawing(newDrawing);
        addDrawingToYjs(newDrawing);
        setCurrentPath([]);
        setTool('hand'); // Switch to hand tool after placing text
        return;
    }

    const newDrawing: Drawing = {
        id: `drawing-${Date.now()}`,
        type: tool === 'pen' ? 'freehand' : tool,
        points: currentPath,
        color: currentColor,
        strokeWidth: currentWidth
    };
    
    addDrawing(newDrawing);
    addDrawingToYjs(newDrawing);
    setCurrentPath([]);
  }, [isDrawing, currentPath, tool, currentColor, currentWidth, addDrawing, isSpacePressed, addDrawingToYjs]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: any) => {
      if (isDrawing && tool === 'eraser' && node.type === 'drawingNode') {
          // Defer removal to avoid React Flow event conflicts
          requestAnimationFrame(() => {
            setDrawings(prev => prev.filter(d => d.id !== node.id));
            removeDrawingFromYjs(node.id);
          });
      }
  }, [isDrawing, tool, setDrawings, removeDrawingFromYjs]);

  const onNodeMouseEnter = useCallback((event: React.MouseEvent, node: any) => {
      if (isDrawing && tool === 'eraser' && event.buttons === 1 && node.type === 'drawingNode') {
          // Defer removal to avoid React Flow event conflicts
          requestAnimationFrame(() => {
            setDrawings(prev => prev.filter(d => d.id !== node.id));
            removeDrawingFromYjs(node.id);
          });
      }
  }, [isDrawing, tool, setDrawings, removeDrawingFromYjs]);

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

      const fileData = files.find(f => f.path === currentFile);
      if (!fileData?.analysis) return;
      const funcInfo = fileData.analysis.functions.find(f => f.name === currentFunc);
      if (!funcInfo) return;

      // Execute line by line
      for (let lineNum = funcInfo.startLine; lineNum <= funcInfo.endLine; lineNum++) {
        const callAtLine = funcInfo.calls.find(c => c.line === lineNum);
        
        if (callAtLine) {
          // Execute the line with the call
          steps.push({ type: 'execute-line', file: currentFile, line: lineNum });
          
          // Find target file
          const targetFile = files.find(f => 
            f.analysis?.functions.some(func => func.name === callAtLine.name)
          );

          if (targetFile) {
            // Animate edge with dot to target
            steps.push({ 
              type: 'animate-edge-with-dot', 
              fromFile: currentFile, 
              toFile: targetFile.path, 
              fromLine: lineNum, 
              toFunc: callAtLine.name 
            });

            // Recurse into called function
            traverse(targetFile.path, callAtLine.name);
            
            // Prepare for return - smooth zoom out
            steps.push({
              type: 'prepare-return',
              file: targetFile.path,
              func: callAtLine.name
            });
            
            // Return edge with dot back
            steps.push({
              type: 'return-edge-with-dot',
              fromFile: targetFile.path,
              toFile: currentFile,
              fromFunc: callAtLine.name,
              toLine: lineNum
            });
          }
        } else {
          // Regular line execution
          steps.push({ type: 'execute-line', file: currentFile, line: lineNum });
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
      // Add initial prepare step for smooth zoom-out at start
      const stepsWithPrepare: FlowStep[] = [
        { type: 'prepare-return', file: path, func: name },
        ...pathSteps
      ];
      
      setFlowPath(stepsWithPrepare);
      setCurrentStepIndex(0);
      setIsPlayingFlow(true);
      onFlowStateChange?.(true);
      setSelectedFunction(null); // Clear selection to focus on flow
    }
  }, [generateFlowPath, onFlowStateChange]);

  // Animation Loop
  useEffect(() => {
    if (!isPlayingFlow || flowPath.length === 0) return;

    const step = flowPath[currentStepIndex];
    
    // Handle different step types
    if (step.type === 'execute-line') {
      // Add line to executed set
      setExecutedLines(prev => {
        const newMap = new Map(prev);
        const fileLines = newMap.get(step.file) || new Set();
        fileLines.add(step.line);
        newMap.set(step.file, fileLines);
        return newMap;
      });
      
      // Pan camera to the line
      const node = nodesRef.current.find(n => n.id === step.file);
      if (node) {
        const nodeWidth = node.width || 500;
        const lineOffset = (step.line - 1) * 20; // Approximate line height
        
        // Shift center slightly right to account for line numbers and left padding
        // This ensures line numbers are visible and reduces right-side space
        const centerX = node.position.x + nodeWidth * 0.45; // Shift left from center
        const centerY = node.position.y + lineOffset + 100;
        
        setCenter(centerX, centerY, { duration: 150 / flowSpeed, zoom: 1.1 });
      }
      
      // Move to next step
      const timer = setTimeout(() => {
        if (currentStepIndex < flowPath.length - 1) {
          setCurrentStepIndex(prev => prev + 1);
        } else {
          finishFlow();
        }
      }, 180 / flowSpeed);
      
      return () => clearTimeout(timer);
      
    } else if (step.type === 'prepare-return') {
      // Smooth zoom out before returning or starting
      const node = nodesRef.current.find(n => n.id === step.file);
      if (node) {
        const nodeWidth = node.width || 500;
        const nodeHeight = node.height || 400;
        const centerX = node.position.x + nodeWidth * 0.45;
        const centerY = node.position.y + nodeHeight / 2;
        
        // Smoothly zoom out to show the whole function
        setCenter(centerX, centerY, { duration: 500 / flowSpeed, zoom: 0.75 });
      }
      
      // Wait for zoom animation to complete with extra pause for smoothness
      const timer = setTimeout(() => {
        if (currentStepIndex < flowPath.length - 1) {
          setCurrentStepIndex(prev => prev + 1);
        } else {
          finishFlow();
        }
      }, 700 / flowSpeed);
      
      return () => clearTimeout(timer);
      
    } else if (step.type === 'animate-edge-with-dot' || step.type === 'return-edge-with-dot') {
      // Animate red dot along the edge
      const sourceNode = nodesRef.current.find(n => n.id === step.fromFile);
      const targetNode = nodesRef.current.find(n => n.id === step.toFile);
      
      if (sourceNode && targetNode) {
        const isReturn = step.type === 'return-edge-with-dot';
        let progress = 0;
        const duration = isReturn ? 2200 / flowSpeed : 2500 / flowSpeed; // Slightly slower return for smoothness
        const startTime = Date.now();
        
        // Calculate center points of nodes for better positioning
        const sourceWidth = sourceNode.width || 500;
        const sourceHeight = sourceNode.height || 400;
        const targetWidth = targetNode.width || 500;
        const targetHeight = targetNode.height || 400;
        
        // Calculate source and target positions
        const sourceCenterX = sourceNode.position.x + sourceWidth * 0.45;
        const sourceCenterY = sourceNode.position.y + sourceHeight / 2;
        const targetCenterX = targetNode.position.x + targetWidth * 0.45;
        
        // For calls, calculate target as function head; for returns, use center
        let targetCenterY = targetNode.position.y + targetHeight / 2;
        
        if (!isReturn) {
          // For calls, aim for function head from the start
          const targetFileData = files.find(f => f.path === step.toFile);
          const targetFunc = targetFileData?.analysis?.functions.find(f => f.name === step.toFunc);
          if (targetFunc) {
            const firstLineOffset = (targetFunc.startLine - 1) * 20;
            targetCenterY = targetNode.position.y + firstLineOffset + 100;
          }
        }
        
        // Determine appropriate zoom based on distance
        const distance = Math.sqrt(
          Math.pow(targetCenterX - sourceCenterX, 2) + 
          Math.pow(targetCenterY - sourceCenterY, 2)
        );
        const appropriateZoom = distance > 1500 ? 0.6 : distance > 1000 ? 0.7 : 0.8;
        
        const animate = () => {
          const elapsed = Date.now() - startTime;
          progress = Math.min(elapsed / duration, 1);
          
          // Smoother ease-in-out cubic
          const eased = progress < 0.5
            ? 4 * progress * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;
          
          // Interpolate position along the path with easing
          const x = sourceCenterX + (targetCenterX - sourceCenterX) * eased;
          const y = sourceCenterY + (targetCenterY - sourceCenterY) * eased;
          
          setDotProgress(progress);
          
          // Gradually zoom in as we approach target
          const currentZoom = appropriateZoom + (1.1 - appropriateZoom) * eased;
          
          // Smooth camera follow - stays centered on the dot
          setCenter(x, y, { duration: 0, zoom: currentZoom });
          
          if (progress < 1) {
            animationFrameRef.current = requestAnimationFrame(animate);
          } else {
            // Arrived at target
            setDotProgress(0);
            
            // Different handling for return vs call
            if (isReturn) {
              // For returns, we're already at the right position, just continue
              setTimeout(() => {
                if (currentStepIndex < flowPath.length - 1) {
                  setCurrentStepIndex(prev => prev + 1);
                } else {
                  finishFlow();
                }
              }, 300 / flowSpeed);
            } else {
              // For calls, we're already at function head, just pause briefly
              setTimeout(() => {
                if (currentStepIndex < flowPath.length - 1) {
                  setCurrentStepIndex(prev => prev + 1);
                } else {
                  finishFlow();
                }
              }, 400 / flowSpeed);
            }
          }
        };
        
        animate();
        
        return () => {
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
          }
        };
      }
    }
    
    // Fallback for other step types
    const timer = setTimeout(() => {
      if (currentStepIndex < flowPath.length - 1) {
        setCurrentStepIndex(prev => prev + 1);
      } else {
        finishFlow();
      }
    }, 300 / flowSpeed);
    
    return () => clearTimeout(timer);
  }, [isPlayingFlow, currentStepIndex, flowPath, flowSpeed]);
  
  const finishFlow = () => {
    setIsPlayingFlow(false);
    onFlowStateChange?.(false);
    setCurrentStepIndex(0);
    setFlowPath([]);
    setExecutedLines(new Map());
    setEdges(prev => prev.filter(e => !e.id.startsWith('flow-')));
  };

  // Update Nodes and Edges based on current step
  useEffect(() => {
    if (!isPlayingFlow || flowPath.length === 0) {
        // Reset active states when not playing
        setNodes(prev => prev.map(n => {
            if (n.type === 'drawingNode') return n;
            return {
                ...n,
                data: { ...n.data, executedLines: new Set() }
            };
        }));
        return;
    }

    const step = flowPath[currentStepIndex];

    // Update Nodes with executed lines
    setNodes(prev => prev.map(n => {
      if (n.type === 'drawingNode') return n;
      const fileExecutedLines = executedLines.get(n.id) || new Set();
      return {
        ...n,
        data: { ...n.data, executedLines: fileExecutedLines }
      };
    }));

    // Update Edges for arrow animations
    if (step.type === 'animate-edge-with-dot' || step.type === 'return-edge-with-dot') {
      const currentNodes = nodesRef.current;
      const sourceNode = currentNodes.find(n => n.id === step.fromFile);
      const targetNode = currentNodes.find(n => n.id === step.toFile);
      const isTargetRight = (sourceNode?.position.x || 0) < (targetNode?.position.x || 0);

      const isReturn = step.type === 'return-edge-with-dot';
      
      let sourceHandle, targetHandle;
      let edgeId;

      if (isReturn) {
         sourceHandle = `def-return-${step.fromFunc}-${isTargetRight ? 'right' : 'left'}`;
         targetHandle = `call-return-${step.fromFunc}-${step.toLine}-${isTargetRight ? 'left' : 'right'}`;
         edgeId = `flow-return-${step.fromFile}-${step.toFile}-${step.fromFunc}`;
      } else {
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
          data: { isReturning: isReturn, dotProgress },
          style: { 
              stroke: isReturn ? '#e879f9' : '#22d3ee',
              strokeWidth: 3,
          }, 
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: isReturn ? '#e879f9' : '#22d3ee',
          },
        }];
      });
    }

  }, [isPlayingFlow, currentStepIndex, flowPath, executedLines, dotProgress, setNodes, setEdges]);

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
      const existingFileNodes = prevNodes.filter(n => n.type === 'fileNode');
      const drawingNodes = prevNodes.filter(n => n.type === 'drawingNode');

      const newFileNodes = files.map((file, index) => {
        const existingNode = existingFileNodes.find((n) => n.id === file.path);
        
        // If node exists, keep its position, otherwise calculate initial position
        const position = existingNode 
          ? existingNode.position 
          : (() => {
              // Create a more organic scattered layout
              const cols = Math.ceil(Math.sqrt(files.length * 1.5)); // Wider spread
              const row = Math.floor(index / cols);
              const col = index % cols;
              
              // Base position with more spacing
              const baseX = col * 700;
              const baseY = row * 900;
              
              // Add controlled randomness for organic feel
              const offsetX = (Math.random() - 0.5) * 250;
              const offsetY = (Math.random() - 0.5) * 250;
              
              return {
                x: baseX + offsetX,
                y: baseY + offsetY
              };
            })();

        return {
          id: file.path,
          type: 'fileNode',
          position,
          // Preserve width/height/style if they exist (from resizing)
          style: { ...existingNode?.style, zIndex: 10 },
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
      
      return [...newFileNodes, ...drawingNodes];
    });
  }, [files, setNodes, handleHover, handleLeave, handleClick, handleTrackFlow, selectedFunction, onFileUpdate]);

  return (
    <div 
        className={`w-full h-screen bg-[#1e1e1e] relative ${isSpacePressed || tool === 'hand' ? 'cursor-grab' : (isDrawing ? (tool === 'eraser' ? 'cursor-eraser' : tool === 'text' ? 'cursor-text' : tool === 'select' ? '' : 'cursor-pen') : '')}`}
    >
      <style>{`
        .cursor-grab .react-flow__pane,
        .cursor-grab .react-flow__node,
        .cursor-grab .react-flow__edge {
          cursor: grab !important;
        }
        .cursor-grab:active .react-flow__pane,
        .cursor-grab:active .react-flow__node,
        .cursor-grab:active .react-flow__edge {
          cursor: grabbing !important;
        }

        .cursor-text .react-flow__pane,
        .cursor-text .react-flow__node,
        .cursor-text .react-flow__edge {
          cursor: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="20" y1="6" y2="6"/><line x1="12" x2="12" y1="6" y2="21"/></svg>') 12 12, text !important;
        }

        .cursor-pen .react-flow__pane,
        .cursor-pen .react-flow__node,
        .cursor-pen .react-flow__edge {
          cursor: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>') 0 24, crosshair !important;
        }
        
        .cursor-eraser .react-flow__pane,
        .cursor-eraser .react-flow__node,
        .cursor-eraser .react-flow__edge {
          cursor: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/></svg>') 12 12, alias !important;
        }

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
        
        @keyframes pulse-once {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        
        .animate-pulse-once {
          animation: pulse-once 0.3s ease-in-out;
        }
      `}</style>
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        <button 
          onClick={onBack}
          className="bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-700 hover:bg-gray-700 transition-colors"
        >
          Back to Upload
        </button>
        <button
          onClick={() => setIsDrawing(!isDrawing)}
          className={`px-4 py-2 rounded-lg border transition-colors flex items-center gap-2 ${
            isDrawing 
              ? 'bg-orange-600 border-orange-500 text-white' 
              : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
          }`}
        >
          {isDrawing ? <PenTool size={18} /> : <MousePointer2 size={18} />}
          {isDrawing ? 'Drawing Mode' : 'Selection Mode'}
        </button>
        <button
          onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              alert('Link copied to clipboard!');
          }}
          className="bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-700 hover:bg-gray-700 transition-colors flex items-center gap-2"
          title="Share Link"
        >
          <LinkIcon size={18} />
          {status === 'connected' ? 'Share' : 'Connecting...'}
        </button>
      </div>

      {isPlayingFlow && (
        <div 
          className="absolute z-50 bg-gray-800 border border-gray-700 rounded-lg p-3 flex items-center gap-3 shadow-xl"
          style={{ 
            right: '20px', 
            top: '20px',
            userSelect: 'none'
          }}
        >
          <span className="text-white text-sm">Flow Speed:</span>
          <input 
            type="range" 
            min="0.25" 
            max="3" 
            step="0.25"
            value={flowSpeed} 
            onChange={(e) => setFlowSpeed(parseFloat(e.target.value))}
            className="w-32 accent-blue-500 cursor-pointer"
          />
          <span className="text-white text-sm font-mono">{flowSpeed}x</span>
          <button
            onClick={finishFlow}
            className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm cursor-pointer"
          >
            Stop
          </button>
        </div>
      )}

      {isDrawing && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-gray-800 border border-gray-700 rounded-lg p-1 flex items-center gap-2 shadow-xl">
            <div className="flex items-center gap-1 border-r border-gray-700 pr-2">
                <button 
                    onClick={() => setTool('hand')}
                    className={`p-1.5 rounded hover:bg-gray-700 ${tool === 'hand' ? 'bg-gray-700 text-blue-400' : 'text-gray-400'}`}
                    title="Hand (Pan)"
                >
                    <Hand size={18} />
                </button>
                <button 
                    onClick={() => setTool('select')}
                    className={`p-1.5 rounded hover:bg-gray-700 ${tool === 'select' ? 'bg-gray-700 text-blue-400' : 'text-gray-400'}`}
                    title="Select (Move)"
                >
                    <MousePointer2 size={18} />
                </button>
                <button 
                    onClick={() => setTool('pen')}
                    className={`p-1.5 rounded hover:bg-gray-700 ${tool === 'pen' ? 'bg-gray-700 text-blue-400' : 'text-gray-400'}`}
                    title="Pen"
                >
                    <PenTool size={18} />
                </button>
                <button 
                    onClick={() => setTool('rectangle')}
                    className={`p-1.5 rounded hover:bg-gray-700 ${tool === 'rectangle' ? 'bg-gray-700 text-blue-400' : 'text-gray-400'}`}
                    title="Rectangle"
                >
                    <Square size={18} />
                </button>
                <button 
                    onClick={() => setTool('circle')}
                    className={`p-1.5 rounded hover:bg-gray-700 ${tool === 'circle' ? 'bg-gray-700 text-blue-400' : 'text-gray-400'}`}
                    title="Circle"
                >
                    <Circle size={18} />
                </button>
                <button 
                    onClick={() => setTool('line')}
                    className={`p-1.5 rounded hover:bg-gray-700 ${tool === 'line' ? 'bg-gray-700 text-blue-400' : 'text-gray-400'}`}
                    title="Line"
                >
                    <Minus size={18} />
                </button>
                <button 
                    onClick={() => setTool('text')}
                    className={`p-1.5 rounded hover:bg-gray-700 ${tool === 'text' ? 'bg-gray-700 text-blue-400' : 'text-gray-400'}`}
                    title="Text"
                >
                    <Type size={18} />
                </button>
                <button 
                    onClick={() => setTool('eraser')}
                    className={`p-1.5 rounded hover:bg-gray-700 ${tool === 'eraser' ? 'bg-gray-700 text-red-400' : 'text-gray-400'}`}
                    title="Eraser (Click to delete)"
                >
                    <Eraser size={18} />
                </button>
            </div>

            <div className="flex items-center gap-1 border-r border-gray-700 pr-2">
                {['#ef4444', '#22c55e', '#3b82f6', '#eab308', '#a855f7', '#ffffff', '#000000'].map(color => (
                    <button
                        key={color}
                        onClick={() => setCurrentColor(color)}
                        className={`w-5 h-5 rounded-full border-2 ${currentColor === color ? 'border-white scale-110' : 'border-transparent hover:scale-110'} transition-transform`}
                        style={{ backgroundColor: color }}
                    />
                ))}
            </div>

            <div className="flex items-center gap-2">
                <input 
                    type="range" 
                    min="1" 
                    max="20" 
                    value={currentWidth} 
                    onChange={(e) => setCurrentWidth(parseInt(e.target.value))}
                    className="w-16 accent-blue-500"
                />
                <div 
                    className="w-6 h-6 flex items-center justify-center bg-gray-900 rounded"
                >
                    <div 
                        className="rounded-full bg-white"
                        style={{ width: Math.min(currentWidth, 20), height: Math.min(currentWidth, 20), backgroundColor: currentColor }}
                    />
                </div>
            </div>
        </div>
      )}

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
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onNodeClick={onNodeClick}
        onNodeMouseEnter={onNodeMouseEnter}
        panOnDrag={isSpacePressed || tool === 'hand' ? true : (isDrawing && tool !== 'select' ? [1, 2] : true)}
        selectionOnDrag={!isDrawing && !isSpacePressed && tool !== 'hand'}
        panOnScroll={true}
        zoomOnScroll={true}
        preventScrolling={true}
      >
        <Background color="#333" gap={20} />
        <Controls />
        <MiniMap style={{ background: '#252526' }} nodeColor="#555" />
        
        <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-[2000]" style={{overflow: 'visible'}}>
            <g transform={`translate(${x},${y}) scale(${zoom})`}>
                {currentPath.length > 0 && (
                    <>
                        {tool === 'pen' && currentPath.length > 1 && (
                            <path 
                                d={`M ${currentPath.map(p => `${p.x} ${p.y}`).join(' L ')}`} 
                                stroke={currentColor} 
                                strokeWidth={currentWidth} 
                                fill="none" 
                                strokeLinecap="round" 
                                strokeLinejoin="round"
                            />
                        )}
                        {tool === 'rectangle' && currentPath.length > 1 && (
                            <rect
                                x={Math.min(currentPath[0].x, currentPath[currentPath.length - 1].x)}
                                y={Math.min(currentPath[0].y, currentPath[currentPath.length - 1].y)}
                                width={Math.abs(currentPath[currentPath.length - 1].x - currentPath[0].x)}
                                height={Math.abs(currentPath[currentPath.length - 1].y - currentPath[0].y)}
                                stroke={currentColor}
                                strokeWidth={currentWidth}
                                fill="none"
                            />
                        )}
                        {tool === 'circle' && currentPath.length > 1 && (
                            <ellipse
                                cx={(currentPath[0].x + currentPath[currentPath.length - 1].x) / 2}
                                cy={(currentPath[0].y + currentPath[currentPath.length - 1].y) / 2}
                                rx={Math.abs(currentPath[currentPath.length - 1].x - currentPath[0].x) / 2}
                                ry={Math.abs(currentPath[currentPath.length - 1].y - currentPath[0].y) / 2}
                                stroke={currentColor}
                                strokeWidth={currentWidth}
                                fill="none"
                            />
                        )}
                        {tool === 'line' && currentPath.length > 1 && (
                            <line
                                x1={currentPath[0].x}
                                y1={currentPath[0].y}
                                x2={currentPath[currentPath.length - 1].x}
                                y2={currentPath[currentPath.length - 1].y}
                                stroke={currentColor}
                                strokeWidth={currentWidth}
                                strokeLinecap="round"
                            />
                        )}
                    </>
                )}
            </g>
        </svg>
      </ReactFlow>
    </div>
  );
};

export const CodeCanvas: React.FC<CodeCanvasProps> = (props) => (
  <ReactFlowProvider>
    <CodeCanvasContent {...props} />
  </ReactFlowProvider>
);
