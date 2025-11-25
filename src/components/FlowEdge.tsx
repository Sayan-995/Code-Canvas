import React from 'react';
import { EdgeProps, getBezierPath } from 'reactflow';

export const FlowEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
}) => {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      {/* Glow effect behind the line */}
      <path
        d={edgePath}
        fill="none"
        stroke={style.stroke}
        strokeWidth={(Number(style.strokeWidth) || 2) + 4}
        strokeOpacity={0.1}
        className="react-flow__edge-path"
        style={{ filter: 'blur(4px)', transition: 'all 0.5s ease' }}
      />
      
      {/* The main drawing line */}
      <path
        id={id}
        className="react-flow__edge-path animate-draw-line"
        d={edgePath}
        markerEnd={markerEnd}
        fill="none"
        pathLength={1}
        style={{
            ...style,
            strokeDasharray: 1,
        }}
      />
    </>
  );
};
