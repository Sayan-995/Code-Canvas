import { memo, useState, useRef, useEffect } from 'react';
import { useFileStore } from '../store/useFileStore';

interface DrawingNodeProps {
  data: {
    id: string;
    type: 'freehand' | 'rectangle' | 'circle' | 'line' | 'text';
    points: { x: number; y: number }[];
    color: string;
    strokeWidth: number;
    text?: string;
    onUpdate?: (id: string, updates: any) => void;
    onRemove?: (id: string) => void;
  };
}

export const DrawingNode = memo(({ data }: DrawingNodeProps) => {
  const { id, type, points, color, strokeWidth, text, onUpdate, onRemove } = data;
  const { updateDrawing, removeDrawing } = useFileStore();
  const [isEditing, setIsEditing] = useState(!text && type === 'text');
  const [localText, setLocalText] = useState(text || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleUpdate = (id: string, updates: any) => {
      updateDrawing(id, updates);
      if (onUpdate) onUpdate(id, updates);
  };

  const handleRemove = (id: string) => {
      removeDrawing(id);
      if (onRemove) onRemove(id);
  };

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  if (!points || points.length === 0) return null;

  if (type === 'text') {
    const handleBlur = () => {
      setIsEditing(false);
      if (!localText.trim()) {
        handleRemove(id);
      } else {
        handleUpdate(id, { text: localText });
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleBlur();
      }
      if (e.key === 'Escape') {
          // Revert or delete if empty?
          // If it was new (empty text), delete.
          if (!text) {
              handleRemove(id);
          } else {
              setLocalText(text);
              setIsEditing(false);
          }
      }
    };

    if (isEditing) {
        return (
            <textarea
                className="nodrag"
                ref={textareaRef}
                value={localText}
                onChange={(e) => setLocalText(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                style={{
                    color,
                    fontSize: '16px',
                    fontFamily: 'sans-serif',
                    padding: '4px',
                    minWidth: '100px',
                    minHeight: '1.5em',
                    background: 'transparent',
                    border: '1px dashed #666',
                    outline: 'none',
                    resize: 'both',
                    overflow: 'hidden'
                }}
            />
        );
    }

    return (
      <div 
        onDoubleClick={() => setIsEditing(true)}
        style={{ 
          color, 
          fontSize: '16px', 
          fontFamily: 'sans-serif',
          whiteSpace: 'pre-wrap',
          padding: '4px',
          minWidth: '50px',
          cursor: 'text',
          userSelect: 'none'
        }}
      >
        {text || 'Double click to edit'}
      </div>
    );
  }

  // Calculate bounding box to size the SVG correctly
  // Use reduce to avoid stack overflow with spread operator on large arrays
  const { minX, minY, maxX, maxY } = points.reduce((acc, p) => ({
    minX: Math.min(acc.minX, p.x),
    minY: Math.min(acc.minY, p.y),
    maxX: Math.max(acc.maxX, p.x),
    maxY: Math.max(acc.maxY, p.y),
  }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });

  const width = maxX - minX + strokeWidth * 2;
  const height = maxY - minY + strokeWidth * 2;

  // Normalize points relative to the node position (top-left)
  const normalizedPoints = points.map(p => ({
    x: p.x - minX + strokeWidth,
    y: p.y - minY + strokeWidth
  }));

  let content;
  if (type === 'rectangle') {
      const start = normalizedPoints[0];
      const end = normalizedPoints[normalizedPoints.length - 1];
      const rectX = Math.min(start.x, end.x);
      const rectY = Math.min(start.y, end.y);
      const rectW = Math.abs(end.x - start.x);
      const rectH = Math.abs(end.y - start.y);
      
      content = (
          <rect
            x={rectX}
            y={rectY}
            width={rectW}
            height={rectH}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
          />
      );
  } else if (type === 'circle') {
      const start = normalizedPoints[0];
      const end = normalizedPoints[normalizedPoints.length - 1];
      const cx = (start.x + end.x) / 2;
      const cy = (start.y + end.y) / 2;
      const rx = Math.abs(end.x - start.x) / 2;
      const ry = Math.abs(end.y - start.y) / 2;

      content = (
          <ellipse
            cx={cx}
            cy={cy}
            rx={rx}
            ry={ry}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
          />
      );
  } else if (type === 'line') {
      const start = normalizedPoints[0];
      const end = normalizedPoints[normalizedPoints.length - 1];
      content = (
          <line
            x1={start.x}
            y1={start.y}
            x2={end.x}
            y2={end.y}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
      );
  } else {
      // Freehand
      const pathData = normalizedPoints.map((p, i) => {
        return `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`;
      }).join(' ');
      
      content = (
        <path
          d={pathData}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
  }

  return (
    <div style={{ width, height }}>
      <svg width={width} height={height} style={{ overflow: 'visible' }}>
        {content}
      </svg>
    </div>
  );
});
