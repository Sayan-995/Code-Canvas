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
  data,
}) => {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const dotProgress = data?.dotProgress || 0;
  const hasDot = dotProgress > 0 && dotProgress < 1;

  // Calculate dot position along the path with easing
  let dotX = sourceX;
  let dotY = sourceY;
  
  if (hasDot) {
    // Apply ease-in-out for smoother movement
    const eased = dotProgress < 0.5 
      ? 2 * dotProgress * dotProgress 
      : 1 - Math.pow(-2 * dotProgress + 2, 2) / 2;
    
    // Interpolate position with easing
    dotX = sourceX + (targetX - sourceX) * eased;
    dotY = sourceY + (targetY - sourceY) * eased;
  }

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
      
      {/* Red dot traveling along the edge */}
      {hasDot && (
        <>
          {/* Glow effect for dot */}
          <circle
            cx={dotX}
            cy={dotY}
            r={8}
            fill="#ef4444"
            opacity={0.3}
            style={{ filter: 'blur(4px)' }}
          />
          {/* Main red dot */}
          <circle
            cx={dotX}
            cy={dotY}
            r={5}
            fill="#ef4444"
            stroke="#ffffff"
            strokeWidth={2}
            style={{ 
              filter: 'drop-shadow(0 0 6px rgba(239, 68, 68, 0.8))',
            }}
          />
        </>
      )}
    </>
  );
};
