/**
 * ESLint Runner Service for Code Canvas
 * Provides browser-compatible static analysis for JavaScript/TypeScript code
 * Uses pattern-based analysis since full ESLint requires Node.js runtime
 * 
 * Requirements: 1.2, 1.3, 3.1, 3.2, 5.1
 * - Performs static analysis on JS/TS code segments
 * - Returns diagnostics with precise source ranges
 * - Does NOT execute user code (static analysis only)
 * 
 * SECURITY NOTE:
 * This service uses ONLY RegExp pattern matching against string content.
 * It does NOT use eval(), Function(), or any form of code execution.
 * User code is analyzed as text data, never executed.
 */

import { Diagnostic, SourceRange } from '../types/analysis';
import {
  validateContentForAnalysis,
  sanitizeFilePath,
  logSecurityAudit,
} from './securityGuard';

export interface ESLintConfig {
  rules?: {
    [ruleName: string]: 'off' | 'warn' | 'error' | 0 | 1 | 2;
  };
}

interface LintRule {
  id: string;
  pattern: RegExp;
  message: string;
  severity: 'error' | 'warning';
  multiline?: boolean;
}

// Default lint rules for common JavaScript/TypeScript issues
const DEFAULT_RULES: LintRule[] = [
  {
    id: 'no-console',
    pattern: /\bconsole\.(log|warn|error|info|debug)\s*\(/g,
    message: 'Unexpected console statement',
    severity: 'warning',
  },
  {
    id: 'no-debugger',
    pattern: /\bdebugger\b/g,
    message: 'Unexpected debugger statement',
    severity: 'error',
  },
  {
    id: 'no-alert',
    pattern: /\balert\s*\(/g,
    message: 'Unexpected alert statement',
    severity: 'warning',
  },
  {
    id: 'no-eval',
    pattern: /\beval\s*\(/g,
    message: 'eval is dangerous and should be avoided',
    severity: 'error',
  },
  {
    id: 'no-implied-eval',
    pattern: /\b(setTimeout|setInterval)\s*\(\s*["'`]/g,
    message: 'Implied eval through setTimeout/setInterval with string argument',
    severity: 'error',
  },
  {
    id: 'no-var',
    pattern: /\bvar\s+\w+/g,
    message: 'Unexpected var, use let or const instead',
    severity: 'warning',
  },
  {
    id: 'no-unused-vars-pattern',
    pattern: /^\s*(const|let|var)\s+(\w+)\s*=\s*[^;]+;\s*$/gm,
    message: 'Variable may be unused (verify usage)',
    severity: 'warning',
  },
  {
    id: 'eqeqeq',
    pattern: /[^=!<>]==[^=]|[^=!]!=[^=]/g,
    message: 'Expected === or !== instead of == or !=',
    severity: 'warning',
  },
  {
    id: 'no-empty-function',
    pattern: /\bfunction\s*\w*\s*\([^)]*\)\s*\{\s*\}/g,
    message: 'Empty function body',
    severity: 'warning',
  },
  {
    id: 'no-duplicate-imports',
    pattern: /^import\s+.*from\s+['"]([^'"]+)['"]/gm,
    message: 'Duplicate import detected',
    severity: 'warning',
  },
  {
    id: 'prefer-const',
    pattern: /\blet\s+(\w+)\s*=\s*[^;]+;(?![\s\S]*\1\s*=)/g,
    message: 'Variable is never reassigned, use const instead',
    severity: 'warning',
  },
  {
    id: 'no-trailing-spaces',
    pattern: /[ \t]+$/gm,
    message: 'Trailing whitespace detected',
    severity: 'warning',
  },
  {
    id: 'no-multiple-empty-lines',
    pattern: /\n{3,}/g,
    message: 'Multiple consecutive empty lines',
    severity: 'warning',
    multiline: true,
  },
];

/**
 * Calculate line and column from string index
 */
function getPositionFromIndex(content: string, index: number): { line: number; column: number } {
  const lines = content.substring(0, index).split('\n');
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1,
  };
}

/**
 * Get the end position of a match
 */
function getEndPosition(content: string, startIndex: number, matchLength: number): { line: number; column: number } {
  return getPositionFromIndex(content, startIndex + matchLength);
}

/**
 * Check if a position is inside a comment or string
 */
function isInsideCommentOrString(content: string, index: number): boolean {
  // Simple heuristic: check if we're inside a string or comment
  const beforeMatch = content.substring(0, index);
  
  // Check for single-line comment
  const lastNewline = beforeMatch.lastIndexOf('\n');
  const currentLine = beforeMatch.substring(lastNewline + 1);
  if (currentLine.includes('//')) {
    const commentStart = currentLine.indexOf('//');
    if (index - lastNewline - 1 > commentStart) {
      return true;
    }
  }
  
  // Check for multi-line comment (simple check)
  const lastCommentStart = beforeMatch.lastIndexOf('/*');
  const lastCommentEnd = beforeMatch.lastIndexOf('*/');
  if (lastCommentStart > lastCommentEnd) {
    return true;
  }
  
  // Check for strings (simple heuristic - count quotes)
  const singleQuotes = (currentLine.match(/'/g) || []).length;
  const doubleQuotes = (currentLine.match(/"/g) || []).length;
  const backticks = (currentLine.match(/`/g) || []).length;
  
  // If odd number of quotes before this position, we might be in a string
  // This is a simplified check and may have false positives
  if (singleQuotes % 2 !== 0 || doubleQuotes % 2 !== 0 || backticks % 2 !== 0) {
    return true;
  }
  
  return false;
}

/**
 * Run ESLint-style static analysis on code content
 * This is a browser-compatible implementation using pattern matching
 * 
 * SECURITY: This function uses ONLY RegExp.exec() for pattern matching.
 * It does NOT execute user code in any way.
 * 
 * @param content - The code content to analyze
 * @param config - Optional ESLint configuration
 * @param filePath - Optional file path for source range information
 * @returns Array of diagnostics with precise source ranges
 */
export async function runESLint(
  content: string,
  config?: ESLintConfig,
  filePath: string = 'unknown'
): Promise<Diagnostic[]> {
  // Security: Validate content before analysis
  const validation = validateContentForAnalysis(content);
  if (!validation.isValid) {
    logSecurityAudit({
      action: 'validation_failed',
      filePath,
      details: validation.error,
    });
    return [];
  }

  // Security: Sanitize file path to prevent path traversal
  const safeFilePath = sanitizeFilePath(filePath);

  logSecurityAudit({
    action: 'analysis_started',
    filePath: safeFilePath,
    details: 'ESLint analysis',
  });

  const diagnostics: Diagnostic[] = [];
  const enabledRules = getEnabledRules(config);
  
  // Track imports for duplicate detection
  const imports = new Map<string, number[]>();
  
  for (const rule of enabledRules) {
    // Reset regex lastIndex for global patterns
    rule.pattern.lastIndex = 0;
    
    let match: RegExpExecArray | null;
    
    while ((match = rule.pattern.exec(content)) !== null) {
      const index = match.index;
      
      // Skip if inside comment or string (for most rules)
      if (!rule.multiline && isInsideCommentOrString(content, index)) {
        continue;
      }
      
      // Special handling for duplicate imports
      if (rule.id === 'no-duplicate-imports') {
        const importPath = match[1];
        if (imports.has(importPath)) {
          imports.get(importPath)!.push(index);
        } else {
          imports.set(importPath, [index]);
        }
        continue; // Process duplicates after collecting all imports
      }
      
      const startPos = getPositionFromIndex(content, index);
      const endPos = getEndPosition(content, index, match[0].length);
      
      const sourceRange: SourceRange = {
        filePath: safeFilePath,
        startLine: startPos.line,
        startColumn: startPos.column,
        endLine: endPos.line,
        endColumn: endPos.column,
      };
      
      const severity = getSeverityFromConfig(rule.id, rule.severity, config);
      if (severity === null) continue; // Rule is disabled
      
      diagnostics.push({
        severity,
        message: rule.message,
        source: 'eslint',
        ruleId: rule.id,
        sourceRange,
      });
    }
  }
  
  // Process duplicate imports
  for (const [importPath, indices] of imports) {
    if (indices.length > 1) {
      // Report all but the first occurrence as duplicates
      for (let i = 1; i < indices.length; i++) {
        const index = indices[i];
        const startPos = getPositionFromIndex(content, index);
        const lineEnd = content.indexOf('\n', index);
        const endIndex = lineEnd === -1 ? content.length : lineEnd;
        const endPos = getPositionFromIndex(content, endIndex);
        
        diagnostics.push({
          severity: 'warning',
          message: `Duplicate import from '${importPath}'`,
          source: 'eslint',
          ruleId: 'no-duplicate-imports',
          sourceRange: {
            filePath: safeFilePath,
            startLine: startPos.line,
            startColumn: startPos.column,
            endLine: endPos.line,
            endColumn: endPos.column,
          },
        });
      }
    }
  }
  
  // Sort diagnostics by line number
  diagnostics.sort((a, b) => {
    if (a.sourceRange.startLine !== b.sourceRange.startLine) {
      return a.sourceRange.startLine - b.sourceRange.startLine;
    }
    return a.sourceRange.startColumn - b.sourceRange.startColumn;
  });

  logSecurityAudit({
    action: 'analysis_completed',
    filePath: safeFilePath,
    details: `ESLint found ${diagnostics.length} issues`,
  });
  
  return diagnostics;
}

/**
 * Get enabled rules based on configuration
 */
function getEnabledRules(config?: ESLintConfig): LintRule[] {
  if (!config?.rules) {
    return DEFAULT_RULES;
  }
  
  return DEFAULT_RULES.filter((rule) => {
    const configValue = config.rules?.[rule.id];
    return configValue !== 'off' && configValue !== 0;
  });
}

/**
 * Get severity from config, returns null if rule is disabled
 */
function getSeverityFromConfig(
  ruleId: string,
  defaultSeverity: 'error' | 'warning',
  config?: ESLintConfig
): 'error' | 'warning' | null {
  if (!config?.rules) {
    return defaultSeverity;
  }
  
  const configValue = config.rules[ruleId];
  
  if (configValue === 'off' || configValue === 0) {
    return null;
  }
  
  if (configValue === 'error' || configValue === 2) {
    return 'error';
  }
  
  if (configValue === 'warn' || configValue === 1) {
    return 'warning';
  }
  
  return defaultSeverity;
}

/**
 * Get default ESLint configuration
 */
export function getDefaultESLintConfig(): ESLintConfig {
  return {
    rules: {
      'no-console': 'warn',
      'no-debugger': 'error',
      'no-alert': 'warn',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-var': 'warn',
      'eqeqeq': 'warn',
      'no-empty-function': 'warn',
      'no-duplicate-imports': 'warn',
      'prefer-const': 'warn',
      'no-trailing-spaces': 'off', // Often too noisy
      'no-multiple-empty-lines': 'off', // Often too noisy
    },
  };
}
