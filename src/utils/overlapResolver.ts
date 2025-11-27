import { Node } from 'reactflow';
import { layoutConfig } from '../config/layoutConfig';

interface NodeBounds {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Check if two nodes overlap (with padding)
 */
function checkOverlap(a: NodeBounds, b: NodeBounds, padding: number): boolean {
  return (
    a.x < b.x + b.width + padding &&
    a.x + a.width + padding > b.x &&
    a.y < b.y + b.height + padding &&
    a.y + a.height + padding > b.y
  );
}

/**
 * Calculate how much two nodes overlap
 */
function calculateOverlap(a: NodeBounds, b: NodeBounds): { x: number; y: number } {
  const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  
  return { x: overlapX, y: overlapY };
}

/**
 * Nudge two overlapping nodes apart
 */
function nudgeApart(
  a: NodeBounds,
  b: NodeBounds,
  positions: Map<string, { x: number; y: number }>
): number {
  const overlap = calculateOverlap(a, b);
  
  // Add organic variation to padding (each pair gets slightly different spacing)
  const basepadding = layoutConfig.nodePadding;
  const variation = layoutConfig.spacingVariation;
  const randomFactor = 1 + (Math.random() - 0.5) * variation * 2; // e.g., 0.75 to 1.25 for 25% variation
  const padding = basepadding * randomFactor;
  
  // Add padding to the overlap amount
  const overlapX = overlap.x + padding;
  const overlapY = overlap.y + padding;
  
  // Choose the direction that requires less movement
  if (overlapX < overlapY) {
    // Push apart horizontally
    const moveAmount = overlapX / 2;
    
    if (a.x < b.x) {
      // A is on the left, B is on the right
      positions.set(a.id, { x: a.x - moveAmount, y: a.y });
      positions.set(b.id, { x: b.x + moveAmount, y: b.y });
    } else {
      // B is on the left, A is on the right
      positions.set(a.id, { x: a.x + moveAmount, y: a.y });
      positions.set(b.id, { x: b.x - moveAmount, y: b.y });
    }
    
    return moveAmount * 2;
  } else {
    // Push apart vertically
    const moveAmount = overlapY / 2;
    
    if (a.y < b.y) {
      // A is above, B is below
      positions.set(a.id, { x: a.x, y: a.y - moveAmount });
      positions.set(b.id, { x: b.x, y: b.y + moveAmount });
    } else {
      // B is above, A is below
      positions.set(a.id, { x: a.x, y: a.y + moveAmount });
      positions.set(b.id, { x: b.x, y: b.y - moveAmount });
    }
    
    return moveAmount * 2;
  }
}

/**
 * Resolve all overlaps in the node layout
 * Returns updated node positions
 */
export function resolveOverlaps(nodes: Node[]): Map<string, { x: number; y: number }> {
  // Filter to only file nodes that have been measured
  const fileNodes = nodes.filter(
    n => n.type === 'fileNode' && n.width && n.height
  );
  
  if (fileNodes.length === 0) {
    return new Map();
  }
  
  // Initialize positions map
  const positions = new Map<string, { x: number; y: number }>();
  fileNodes.forEach(node => {
    positions.set(node.id, { x: node.position.x, y: node.position.y });
  });
  
  let iteration = 0;
  let hasOverlaps = true;
  
  while (hasOverlaps && iteration < layoutConfig.maxIterations) {
    hasOverlaps = false;
    let maxMovement = 0;
    
    // Check all pairs of nodes
    for (let i = 0; i < fileNodes.length; i++) {
      for (let j = i + 1; j < fileNodes.length; j++) {
        const nodeA = fileNodes[i];
        const nodeB = fileNodes[j];
        
        const posA = positions.get(nodeA.id)!;
        const posB = positions.get(nodeB.id)!;
        
        const boundsA: NodeBounds = {
          id: nodeA.id,
          x: posA.x,
          y: posA.y,
          width: nodeA.width!,
          height: nodeA.height!,
        };
        
        const boundsB: NodeBounds = {
          id: nodeB.id,
          x: posB.x,
          y: posB.y,
          width: nodeB.width!,
          height: nodeB.height!,
        };
        
        if (checkOverlap(boundsA, boundsB, layoutConfig.nodePadding)) {
          hasOverlaps = true;
          const movement = nudgeApart(boundsA, boundsB, positions);
          maxMovement = Math.max(maxMovement, movement);
        }
      }
    }
    
    // Stop if movements are too small to matter
    if (maxMovement < layoutConfig.minMovement) {
      break;
    }
    
    iteration++;
  }
  
  return positions;
}

/**
 * Check if nodes are ready (all have width and height)
 */
export function areNodesReady(nodes: Node[]): boolean {
  const fileNodes = nodes.filter(n => n.type === 'fileNode');
  if (fileNodes.length === 0) return false;
  
  return fileNodes.every(node => node.width && node.height);
}
