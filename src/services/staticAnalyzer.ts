/**
 * Static Analyzer Orchestrator for Code Canvas
 * Coordinates ESLint and TypeScript analysis services
 * 
 * Requirements: 1.1, 3.1, 3.2, 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 7.1, 7.2
 * - Orchestrates ESLint and TypeScript checks based on configuration
 * - Ensures analysis completes within 500ms target
 * - Supports per-repository configuration
 * - Caches analysis results per commit and code segment
 * - SECURITY: Does NOT execute user code - uses pattern matching only
 * - SECURITY: Does NOT make network or system calls during analysis
 * 
 * SECURITY NOTE:
 * This orchestrator coordinates static analysis services that use ONLY
 * RegExp pattern matching. No user code is ever executed. The analysis
 * treats all code as text data for pattern matching purposes.
 */

import { AnalysisConfig, AnalysisResult, Diagnostic } from '../types/analysis';
import { runESLint, ESLintConfig, getDefaultESLintConfig } from './eslintRunner';
import { runTypeCheck, TypeScriptConfig, getDefaultTypeScriptConfig } from './typescriptChecker';
import {
  checkCache,
  storeResult,
  generateContentHash as generateCacheContentHash,
} from './analysisCache';
import {
  validateContentForAnalysis,
  sanitizeFilePath,
  logSecurityAudit,
  runInSecureContext,
  assertSecureEnvironment,
} from './securityGuard';

// Analysis timeout in milliseconds (target: 500ms)
const ANALYSIS_TIMEOUT_MS = 500;

/**
 * Generate a content hash for caching purposes
 */
export function generateContentHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(16);
}

/**
 * Detect the language of a file based on extension or content
 */
function detectLanguage(filePath: string, content: string): 'typescript' | 'javascript' | 'unknown' {
  const ext = filePath.split('.').pop()?.toLowerCase();
  
  if (ext === 'ts' || ext === 'tsx') {
    return 'typescript';
  }
  
  if (ext === 'js' || ext === 'jsx' || ext === 'mjs' || ext === 'cjs') {
    return 'javascript';
  }
  
  // Try to detect from content
  const tsPatterns = [
    /:\s*(string|number|boolean|any|void|never|unknown)\b/,
    /\binterface\s+\w+/,
    /\btype\s+\w+\s*=/,
    /\benum\s+\w+/,
    /\bimport\s+type\b/,
  ];
  
  if (tsPatterns.some(p => p.test(content))) {
    return 'typescript';
  }
  
  // Check for JavaScript patterns
  const jsPatterns = [
    /\bfunction\s+\w+/,
    /\bconst\s+\w+\s*=/,
    /\blet\s+\w+\s*=/,
    /\bimport\s+.*from\s+['"]/,
    /\bexport\s+(default\s+)?/,
  ];
  
  if (jsPatterns.some(p => p.test(content))) {
    return 'javascript';
  }
  
  return 'unknown';
}

/**
 * Run analysis with timeout protection
 */
async function runWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: T
): Promise<{ result: T; timedOut: boolean }> {
  let timeoutId: ReturnType<typeof setTimeout>;
  
  const timeoutPromise = new Promise<{ result: T; timedOut: boolean }>((resolve) => {
    timeoutId = setTimeout(() => {
      resolve({ result: fallback, timedOut: true });
    }, timeoutMs);
  });
  
  const resultPromise = promise.then((result) => {
    clearTimeout(timeoutId);
    return { result, timedOut: false };
  });
  
  return Promise.race([resultPromise, timeoutPromise]);
}

/**
 * Analyze code and return diagnostics
 * Orchestrates ESLint and TypeScript checks based on configuration
 * Checks cache first and stores results after successful analysis
 * 
 * SECURITY: This function does NOT execute user code. It coordinates
 * pattern-matching analysis services that treat code as text data.
 * 
 * @param segmentId - Unique identifier for the code segment
 * @param content - The code content to analyze
 * @param config - Analysis configuration
 * @param filePath - Optional file path for better diagnostics
 * @param commitHash - Optional commit hash for cache key generation
 * @returns Analysis result with diagnostics
 */
export async function analyzeCode(
  segmentId: string,
  content: string,
  config: AnalysisConfig,
  filePath: string = 'unknown',
  commitHash?: string
): Promise<AnalysisResult> {
  const startTime = performance.now();
  const diagnostics: Diagnostic[] = [];

  // Security: Validate content before any processing
  const validation = validateContentForAnalysis(content);
  if (!validation.isValid) {
    logSecurityAudit({
      action: 'validation_failed',
      segmentId,
      filePath,
      details: validation.error,
    });
    return {
      fileId: filePath,
      segmentId,
      diagnostics: [],
      timestamp: Date.now(),
      commitHash,
    };
  }

  // Security: Sanitize file path
  const safeFilePath = sanitizeFilePath(filePath);

  logSecurityAudit({
    action: 'analysis_started',
    segmentId,
    filePath: safeFilePath,
  });
  
  // Generate content hash for caching
  const contentHash = generateCacheContentHash(content);
  
  // Check cache first (Requirement 7.2)
  try {
    const cachedResult = await checkCache(segmentId, contentHash, commitHash);
    if (cachedResult) {
      return cachedResult;
    }
  } catch (error) {
    // Cache check failed, continue with analysis
    console.warn('Cache check failed, running fresh analysis:', error);
  }
  
  // Detect language
  const language = detectLanguage(filePath, content);
  
  // Skip analysis for unknown file types
  if (language === 'unknown') {
    return {
      fileId: safeFilePath,
      segmentId,
      diagnostics: [],
      timestamp: Date.now(),
      commitHash,
    };
  }
  
  // Calculate remaining time budget
  const getRemainingTime = () => Math.max(0, ANALYSIS_TIMEOUT_MS - (performance.now() - startTime));
  
  // SECURITY: Assert environment is secure before running any analysis
  try {
    assertSecureEnvironment();
  } catch (error) {
    logSecurityAudit({
      action: 'error_caught',
      segmentId,
      filePath: safeFilePath,
      details: `Security environment check failed: ${(error as Error).message}`,
    });
    return {
      fileId: safeFilePath,
      segmentId,
      diagnostics: [{
        severity: 'error',
        message: 'Analysis blocked: Security environment check failed',
        source: 'eslint',
        ruleId: 'security-check',
        sourceRange: {
          filePath: safeFilePath,
          startLine: 1,
          startColumn: 1,
          endLine: 1,
          endColumn: 1,
        },
      }],
      timestamp: Date.now(),
      commitHash,
    };
  }

  // Run ESLint if enabled
  // SECURITY: runESLint uses pattern matching only, no code execution
  // Wrapped in secure context to block eval() during analysis
  if (config.eslintEnabled) {
    const eslintConfig: ESLintConfig = config.eslintConfig 
      ? config.eslintConfig as ESLintConfig
      : getDefaultESLintConfig();
    
    const { result: eslintDiagnostics, timedOut } = await runWithTimeout(
      runInSecureContext(() => runESLint(content, eslintConfig, safeFilePath)),
      getRemainingTime(),
      []
    );
    
    if (!timedOut) {
      diagnostics.push(...eslintDiagnostics);
    } else {
      // Add a warning about timeout
      diagnostics.push({
        severity: 'warning',
        message: 'ESLint analysis timed out, results may be incomplete',
        source: 'eslint',
        ruleId: 'timeout',
        sourceRange: {
          filePath: safeFilePath,
          startLine: 1,
          startColumn: 1,
          endLine: 1,
          endColumn: 1,
        },
      });
    }
  }
  
  // Run TypeScript checker if enabled and file is TypeScript
  // SECURITY: runTypeCheck uses pattern matching only, no code execution
  // Wrapped in secure context to block eval() during analysis
  if (config.typescriptEnabled && (language === 'typescript' || safeFilePath.endsWith('.ts') || safeFilePath.endsWith('.tsx'))) {
    const tsConfig: TypeScriptConfig = getDefaultTypeScriptConfig();
    
    const { result: tsDiagnostics, timedOut } = await runWithTimeout(
      runInSecureContext(() => runTypeCheck(content, tsConfig, safeFilePath)),
      getRemainingTime(),
      []
    );
    
    if (!timedOut) {
      diagnostics.push(...tsDiagnostics);
    } else {
      // Add a warning about timeout
      diagnostics.push({
        severity: 'warning',
        message: 'TypeScript analysis timed out, results may be incomplete',
        source: 'typescript',
        ruleId: 'timeout',
        sourceRange: {
          filePath: safeFilePath,
          startLine: 1,
          startColumn: 1,
          endLine: 1,
          endColumn: 1,
        },
      });
    }
  }
  
  // Sort all diagnostics by line and column
  diagnostics.sort((a, b) => {
    if (a.sourceRange.startLine !== b.sourceRange.startLine) {
      return a.sourceRange.startLine - b.sourceRange.startLine;
    }
    return a.sourceRange.startColumn - b.sourceRange.startColumn;
  });
  
  // Remove duplicate diagnostics (same message at same location)
  const uniqueDiagnostics = deduplicateDiagnostics(diagnostics);
  
  const endTime = performance.now();
  const analysisTime = endTime - startTime;
  
  // Log performance warning if analysis took too long
  if (analysisTime > ANALYSIS_TIMEOUT_MS) {
    console.warn(`Static analysis took ${analysisTime.toFixed(0)}ms (target: ${ANALYSIS_TIMEOUT_MS}ms)`);
  }
  
  const result: AnalysisResult = {
    fileId: safeFilePath,
    segmentId,
    diagnostics: uniqueDiagnostics,
    timestamp: Date.now(),
    commitHash,
  };
  
  // Store result in cache (Requirement 7.1)
  try {
    await storeResult(segmentId, contentHash, result, commitHash);
  } catch (error) {
    // Cache storage failed, but we still return the result
    console.warn('Failed to cache analysis result:', error);
  }

  logSecurityAudit({
    action: 'analysis_completed',
    segmentId,
    filePath: safeFilePath,
    details: `Found ${uniqueDiagnostics.length} issues`,
  });
  
  return result;
}

/**
 * Remove duplicate diagnostics
 */
function deduplicateDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
  const seen = new Set<string>();
  return diagnostics.filter((d) => {
    const key = `${d.sourceRange.startLine}:${d.sourceRange.startColumn}:${d.message}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * Analyze multiple code segments in parallel
 * Useful for batch analysis of a repository
 * Leverages caching for unchanged segments
 */
export async function analyzeMultiple(
  segments: Array<{ segmentId: string; content: string; filePath: string }>,
  config: AnalysisConfig,
  commitHash?: string
): Promise<Map<string, AnalysisResult>> {
  const results = new Map<string, AnalysisResult>();
  
  // Run analysis in parallel with concurrency limit
  const CONCURRENCY_LIMIT = 4;
  
  for (let i = 0; i < segments.length; i += CONCURRENCY_LIMIT) {
    const batch = segments.slice(i, i + CONCURRENCY_LIMIT);
    const batchResults = await Promise.all(
      batch.map((segment) =>
        analyzeCode(segment.segmentId, segment.content, config, segment.filePath, commitHash)
      )
    );
    
    batchResults.forEach((result, index) => {
      results.set(batch[index].segmentId, result);
    });
  }
  
  return results;
}

/**
 * Get default analysis configuration
 */
export function getDefaultAnalysisConfig(): AnalysisConfig {
  return {
    eslintEnabled: true,
    typescriptEnabled: true,
    eslintConfig: getDefaultESLintConfig(),
    tsconfigPath: undefined,
  };
}

/**
 * Merge user config with defaults
 */
export function mergeAnalysisConfig(
  userConfig: Partial<AnalysisConfig>
): AnalysisConfig {
  const defaults = getDefaultAnalysisConfig();
  return {
    ...defaults,
    ...userConfig,
    eslintConfig: userConfig.eslintConfig ?? defaults.eslintConfig,
  };
}

/**
 * Get summary statistics for analysis results
 */
export function getAnalysisSummary(result: AnalysisResult): {
  errorCount: number;
  warningCount: number;
  infoCount: number;
} {
  return {
    errorCount: result.diagnostics.filter((d) => d.severity === 'error').length,
    warningCount: result.diagnostics.filter((d) => d.severity === 'warning').length,
    infoCount: result.diagnostics.filter((d) => d.severity === 'info').length,
  };
}
