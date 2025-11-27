/**
 * Static analysis types and interfaces for Code Canvas
 * Supports ESLint and TypeScript analysis with precise source range information
 */

/**
 * Precise location in code defined by start and end line/column positions
 */
export interface SourceRange {
  filePath: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

/**
 * A single diagnostic message from static analysis
 */
export interface Diagnostic {
  severity: 'error' | 'warning' | 'info';
  message: string;
  source: 'eslint' | 'typescript';
  ruleId?: string;
  sourceRange: SourceRange;
}

/**
 * Result of static analysis for a code segment
 */
export interface AnalysisResult {
  fileId: string;
  segmentId: string;
  diagnostics: Diagnostic[];
  timestamp: number;
  commitHash?: string;
}

/**
 * Configuration for static analysis per repository
 */
export interface AnalysisConfig {
  eslintEnabled: boolean;
  typescriptEnabled: boolean;
  eslintConfig?: object;
  tsconfigPath?: string;
}

/**
 * Cache entry for analysis results
 */
export interface AnalysisCacheEntry {
  key: string; // Format: ${commitHash}:${segmentId}:${contentHash}
  result: AnalysisResult;
  contentHash: string;
}
