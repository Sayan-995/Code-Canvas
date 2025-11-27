// Configuration for overlap detection and resolution
export const layoutConfig = {
  // Padding around nodes to ensure breathing room
  nodePadding: 80, // Increased from 40 for more spacing
  
  // Maximum iterations for overlap resolution
  maxIterations: 50,
  
  // Minimum movement threshold (stop if adjustments are tiny)
  minMovement: 1,
  
  // Add random variation to spacing (0-1, where 0.2 = 20% variation)
  spacingVariation: 0.25,
};
