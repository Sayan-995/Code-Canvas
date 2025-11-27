# Implementation Plan

- [x] 1. Set up static analysis infrastructure




  - [x] 1.1 Create analysis types and interfaces


    - Create `src/types/analysis.ts` with `AnalysisResult`, `Diagnostic`, `SourceRange`, and `AnalysisConfig` interfaces
    - _Requirements: 1.1, 1.3, 5.3_
  - [x] 1.2 Create analysis state store


    - Create `src/store/useAnalysisStore.ts` using Zustand
    - Implement state for `analysisResults`, `analysisConfig`, `isAnalyzing`, and `analysisCache`
    - _Requirements: 2.1, 2.2_

- [x] 2. Implement core analysis services





  - [x] 2.1 Create ESLint runner service


    - Create `src/services/eslintRunner.ts`
    - Implement `runESLint(content: string, config?: object)` function using browser-compatible ESLint
    - Return diagnostics with precise source ranges
    - _Requirements: 1.2, 1.3, 3.1, 3.2, 5.1_

  - [x] 2.2 Create TypeScript checker service

    - Create `src/services/typescriptChecker.ts`
    - Implement `runTypeCheck(content: string, config?: string)` function using TypeScript compiler API
    - Use `--noEmit` equivalent for type-only checking
    - Return diagnostics with precise source ranges
    - _Requirements: 1.2, 1.3, 3.1, 3.2, 5.2_

  - [x] 2.3 Create static analyzer orchestrator

    - Create `src/services/staticAnalyzer.ts`
    - Implement `analyzeCode(segmentId: string, content: string, config: AnalysisConfig)` function
    - Orchestrate ESLint and TypeScript checks based on configuration
    - Ensure analysis completes within 500ms target
    - _Requirements: 1.1, 5.1, 5.2, 5.3_
  - [ ]* 2.4 Write unit tests for analysis services
    - Create tests for `eslintRunner.ts`, `typescriptChecker.ts`, and `staticAnalyzer.ts`
    - Test diagnostic generation with various code samples
    - _Requirements: 1.2, 1.3_

- [x] 3. Implement analysis caching





  - [x] 3.1 Create analysis cache service


    - Create `src/services/analysisCache.ts`
    - Implement cache key generation using `${commitHash}:${segmentId}:${contentHash}`
    - Use IndexedDB for persistent storage
    - Implement `checkCache()`, `storeResult()`, and `invalidateCache()` functions
    - _Requirements: 7.1, 7.2_

  - [x] 3.2 Integrate caching with static analyzer

    - Update `staticAnalyzer.ts` to check cache before running analysis
    - Store results in cache after successful analysis
    - _Requirements: 7.1, 7.2_

- [x] 4. Integrate analysis with UI components






  - [x] 4.1 Update FileNode to display diagnostics

    - Modify `src/components/FileNode.tsx` to subscribe to `useAnalysisStore`
    - Display error/warning indicators with source range highlighting
    - Stream diagnostics as they become available
    - _Requirements: 1.1, 1.3, 2.3_


  - [ ] 4.2 Trigger analysis on code changes
    - Add debounced analysis trigger in `FileNode.tsx` when code content changes


    - Update `useAnalysisStore` with results
    - _Requirements: 1.1, 2.2, 2.3_
  - [ ] 4.3 Create analysis configuration UI
    - Create `src/components/AnalysisConfigPanel.tsx`
    - Allow toggling ESLint and TypeScript checks
    - Support per-repository configuration
    - _Requirements: 5.1, 5.2, 5.3_
  - [ ]* 4.4 Write component tests for diagnostic display
    - Test FileNode diagnostic rendering
    - Test AnalysisConfigPanel interactions
    - _Requirements: 2.3_

- [-] 5. Implement security constraints







  - [x] 5.1 Ensure no code execution in analysis



    - Verify ESLint and TypeScript services only perform AST parsing and static checks
    - Add safeguards to prevent `eval()` or dynamic code execution
    - _Requirements: 3.1, 3.2, 4.1, 4.2, 4.3_
  - [ ]* 5.2 Write security tests
    - Create tests verifying malicious code samples do not execute
    - Test that network/system calls are not made during analysis
    - _Requirements: 4.1, 4.2, 4.3_

- [ ] 6. Implement optional sandbox runtime (gated feature)
  - [ ] 6.1 Create sandbox service
    - Create `src/services/sandboxRunner.ts`
    - Implement isolated Web Worker execution environment
    - Restrict access to network and system APIs
    - _Requirements: 6.1, 6.3_
  - [ ] 6.2 Add rate limiting for sandbox
    - Implement rate limiter (10 requests/minute) in sandbox service
    - _Requirements: 6.2_
  - [ ] 6.3 Integrate sandbox with analysis config
    - Add sandbox toggle to `AnalysisConfigPanel.tsx`
    - Gate feature behind explicit user opt-in
    - _Requirements: 6.1, 8.2_
