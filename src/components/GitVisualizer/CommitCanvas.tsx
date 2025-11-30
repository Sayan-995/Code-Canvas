import React, { useEffect, useCallback, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { FileState } from '../../store/useGitHistoryStore';
import { CommitFileNode } from './CommitFileNode';

const nodeTypes = {
  commitFileNode: CommitFileNode,
};

const MAX_UNCHANGED_FILES = 5;

interface CommitCanvasProps {
  files: FileState[];
  highlightedFile: string | null;
}

// Special node for "X more files" indicator
const MoreFilesNode: React.FC<{ data: { count: number } }> = ({ data }) => (
  <div className="bg-gray-800/50 border border-gray-700 border-dashed rounded-lg p-4 text-center min-w-[160px]">
    <div className="text-gray-500 text-sm">
      +{data.count} more unchanged files
    </div>
  </div>
);

const extendedNodeTypes = {
  ...nodeTypes,
  moreFilesNode: MoreFilesNode,
};

const CommitCanvasContent: React.FC<CommitCanvasProps> = ({ files, highlightedFile }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, , onEdgesChange] = useEdgesState([]);
  const { setCenter, fitView } = useReactFlow();

  // Filter files: all changed + limited unchanged
  const { displayFiles, hiddenCount } = useMemo(() => {
    const changedFiles = files.filter((f) => f.status !== 'unchanged');
    const unchangedFiles = files.filter((f) => f.status === 'unchanged');

    const visibleUnchanged = unchangedFiles.slice(0, MAX_UNCHANGED_FILES);
    const hiddenCount = Math.max(0, unchangedFiles.length - MAX_UNCHANGED_FILES);

    return {
      displayFiles: [...changedFiles, ...visibleUnchanged],
      hiddenCount,
    };
  }, [files]);

  // Generate node positions in a grid layout
  const generateLayout = useCallback(
    (filesToShow: FileState[], hiddenFileCount: number) => {
      // Sort: changed files first, then unchanged
      const sortedFiles = [...filesToShow].sort((a, b) => {
        const aChanged = a.status !== 'unchanged' ? 0 : 1;
        const bChanged = b.status !== 'unchanged' ? 0 : 1;
        return aChanged - bChanged;
      });

      const COLS = 4;
      const NODE_WIDTH_WITH_DIFF = 320;
      const NODE_WIDTH_SIMPLE = 200;
      const NODE_HEIGHT_WITH_DIFF = 220;
      const NODE_HEIGHT_SIMPLE = 100;
      const GAP_X = 30;
      const GAP_Y = 30;

      let currentX = 0;
      let currentY = 0;
      let rowMaxHeight = 0;
      let colCount = 0;

      const nodes = sortedFiles.map((file) => {
        const hasDiff = file.status !== 'unchanged' && file.patch;
        const nodeWidth = hasDiff ? NODE_WIDTH_WITH_DIFF : NODE_WIDTH_SIMPLE;
        const nodeHeight = hasDiff ? NODE_HEIGHT_WITH_DIFF : NODE_HEIGHT_SIMPLE;

        // Check if we need to wrap to next row
        if (colCount >= COLS) {
          currentX = 0;
          currentY += rowMaxHeight + GAP_Y;
          rowMaxHeight = 0;
          colCount = 0;
        }

        const position = { x: currentX, y: currentY };

        currentX += nodeWidth + GAP_X;
        rowMaxHeight = Math.max(rowMaxHeight, nodeHeight);
        colCount++;

        return {
          id: file.path,
          type: 'commitFileNode',
          position,
          data: {
            path: file.path,
            name: file.path.split('/').pop() || file.path,
            status: file.status,
            patch: file.patch,
            animationDelay: file.animationDelay || 0,
          },
        };
      });

      // Add "more files" indicator if needed
      if (hiddenFileCount > 0) {
        if (colCount >= COLS) {
          currentX = 0;
          currentY += rowMaxHeight + GAP_Y;
          colCount = 0;
        }

        nodes.push({
          id: 'more-files-indicator',
          type: 'moreFilesNode',
          position: { x: currentX, y: currentY },
          data: { count: hiddenFileCount } as any,
        });
      }

      return nodes;
    },
    []
  );

  // Update nodes when files change with smooth transition
  useEffect(() => {
    const newNodes = generateLayout(displayFiles, hiddenCount);
    setNodes(newNodes);

    // Fit view after layout with delay for animations
    const maxDelay = Math.max(...displayFiles.map((f) => f.animationDelay || 0), 0);
    setTimeout(
      () => {
        fitView({ padding: 0.2, duration: 500 }); // Faster fit
      },
      maxDelay + 300
    );
  }, [displayFiles, hiddenCount, generateLayout, setNodes, fitView]);

  // Pan to highlighted file
  useEffect(() => {
    if (highlightedFile) {
      const node = nodes.find((n) => n.id === highlightedFile);
      if (node) {
        setCenter(node.position.x + 150, node.position.y + 100, { duration: 400, zoom: 1.2 });
      }
    }
  }, [highlightedFile, nodes, setCenter]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={extendedNodeTypes}
      fitView
      minZoom={0.1}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
    >
      <Background color="#333" gap={20} />
      <Controls className="bg-gray-800 border-gray-700" />
    </ReactFlow>
  );
};

export const CommitCanvas: React.FC<CommitCanvasProps> = (props) => {
  return (
    <ReactFlowProvider>
      <CommitCanvasContent {...props} />
    </ReactFlowProvider>
  );
};
