import { FileStructure } from '../store/useFileStore';

export interface SearchResult {
  files: Array<{
    path: string;
    name: string;
    score: number;
  }>;
  functions: Array<{
    name: string;
    file: string;
    line: number;
    score: number;
  }>;
}

export interface SearchIndex {
  keywords: Map<string, SearchResult>;
  files: Map<string, string[]>; // filepath -> keywords
  functions: Map<string, { file: string; line: number }>; // funcName -> location
}

export class CodeSearchEngine {
  private index: SearchIndex = {
    keywords: new Map(),
    files: new Map(),
    functions: new Map(),
  };

  // Build the search index from files
  buildIndex(files: FileStructure[]) {
    this.index = {
      keywords: new Map(),
      files: new Map(),
      functions: new Map(),
    };

    files.forEach(file => {
      this.addFileToIndex(file);
    });
  }

  // Add a single file to the index (for incremental updates)
  addFileToIndex(file: FileStructure) {
    // Extract keywords from filename
    const fileKeywords = this.extractKeywordsFromFilename(file.path, file.name);
    this.index.files.set(file.path, fileKeywords);

    // Index file by its keywords
    fileKeywords.forEach(keyword => {
      this.addToKeywordIndex(keyword, 'file', {
        path: file.path,
        name: file.name,
        score: 10, // Filename match
      });
    });

    // Extract and index functions
    if (file.analysis?.functions) {
      file.analysis.functions.forEach(func => {
        const funcKeywords = this.extractKeywordsFromFunctionName(func.name);
        
        // Store function location
        this.index.functions.set(func.name, {
          file: file.path,
          line: func.startLine,
        });

        // Index function by its keywords
        funcKeywords.forEach(keyword => {
          this.addToKeywordIndex(keyword, 'function', {
            name: func.name,
            file: file.path,
            line: func.startLine,
            score: 10, // Function name match
          });
        });

        // Also add file to this keyword (file contains this function)
        funcKeywords.forEach(keyword => {
          this.addToKeywordIndex(keyword, 'file', {
            path: file.path,
            name: file.name,
            score: 5, // Contains function with this keyword
          });
        });
      });
    }
  }

  // Remove a file from the index (for incremental updates)
  removeFileFromIndex(filePath: string) {
    // Get keywords for this file
    const fileKeywords = this.index.files.get(filePath);
    
    if (fileKeywords) {
      // Remove file from keyword index
      fileKeywords.forEach(keyword => {
        const entry = this.index.keywords.get(keyword);
        if (entry) {
          entry.files = entry.files.filter(f => f.path !== filePath);
          // Clean up empty keyword entries
          if (entry.files.length === 0 && entry.functions.length === 0) {
            this.index.keywords.delete(keyword);
          }
        }
      });
    }

    // Remove functions from this file
    const functionsToRemove: string[] = [];
    this.index.functions.forEach((location, funcName) => {
      if (location.file === filePath) {
        functionsToRemove.push(funcName);
      }
    });

    functionsToRemove.forEach(funcName => {
      this.index.functions.delete(funcName);
      // Also remove from keyword index
      this.index.keywords.forEach(entry => {
        entry.functions = entry.functions.filter(f => f.name !== funcName || f.file !== filePath);
      });
    });

    // Remove file entry
    this.index.files.delete(filePath);
  }

  // Update a file in the index (for incremental updates)
  updateFileInIndex(file: FileStructure) {
    this.removeFileFromIndex(file.path);
    this.addFileToIndex(file);
  }

  // Common abbreviations mapping
  private abbreviations: Record<string, string[]> = {
    'auth': ['authentication', 'authorize', 'authorization'],
    'config': ['configuration', 'configure'],
    'db': ['database'],
    'util': ['utility', 'utilities'],
    'svc': ['service'],
    'ctrl': ['controller', 'control'],
    'mgr': ['manager'],
    'repo': ['repository'],
    'admin': ['administrator', 'administration'],
    'msg': ['message'],
    'btn': ['button'],
    'img': ['image'],
    'doc': ['document', 'documentation'],
  };

  // Extract keywords from filename
  private extractKeywordsFromFilename(_path: string, name: string): string[] {
    const keywords: string[] = [];
    
    // Remove extension
    const nameWithoutExt = name.replace(/\.[^/.]+$/, '');
    
    // Split by common separators
    const parts = nameWithoutExt.split(/[-_./]/);
    
    parts.forEach(part => {
      if (part.length > 2) { // Skip very short parts
        const lower = part.toLowerCase();
        keywords.push(lower);
        
        // Add expanded forms if it's an abbreviation
        if (this.abbreviations[lower]) {
          keywords.push(...this.abbreviations[lower]);
        }
        
        // Add abbreviated forms if it matches expanded form
        Object.entries(this.abbreviations).forEach(([abbr, expansions]) => {
          if (expansions.some(exp => lower.includes(exp))) {
            keywords.push(abbr);
          }
        });
      }
    });

    // Also add full name
    keywords.push(nameWithoutExt.toLowerCase());
    
    return keywords;
  }

  // Extract keywords from function name
  private extractKeywordsFromFunctionName(name: string): string[] {
    const keywords: string[] = [];
    
    // Split camelCase: handleLogin -> handle, login
    const parts = name.split(/(?=[A-Z])/);
    
    parts.forEach(part => {
      if (part.length > 2) {
        const lower = part.toLowerCase();
        keywords.push(lower);
        
        // Add expanded forms if it's an abbreviation
        if (this.abbreviations[lower]) {
          keywords.push(...this.abbreviations[lower]);
        }
        
        // Add abbreviated forms if it matches expanded form
        Object.entries(this.abbreviations).forEach(([abbr, expansions]) => {
          if (expansions.some(exp => lower.includes(exp))) {
            keywords.push(abbr);
          }
        });
      }
    });

    // Also add full name
    keywords.push(name.toLowerCase());
    
    return keywords;
  }

  // Add to keyword index
  private addToKeywordIndex(
    keyword: string,
    type: 'file' | 'function',
    data: any
  ) {
    if (!this.index.keywords.has(keyword)) {
      this.index.keywords.set(keyword, { files: [], functions: [] });
    }

    const entry = this.index.keywords.get(keyword)!;
    
    if (type === 'file') {
      // Avoid duplicates
      if (!entry.files.find(f => f.path === data.path)) {
        entry.files.push(data);
      }
    } else {
      // Avoid duplicates
      if (!entry.functions.find(f => f.name === data.name && f.file === data.file)) {
        entry.functions.push(data);
      }
    }
  }

  // Calculate Levenshtein distance for fuzzy matching
  private levenshteinDistance(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix: number[][] = [];

    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[len1][len2];
  }

  // Search for a term
  search(searchTerm: string, targetType?: 'files' | 'functions' | 'both'): SearchResult {
    const normalizedTerm = searchTerm.toLowerCase().trim();
    
    // Direct lookup
    const result = this.index.keywords.get(normalizedTerm);
    
    if (result) {
      // Filter by target type
      if (targetType === 'files') {
        return { files: result.files, functions: [] };
      } else if (targetType === 'functions') {
        return { files: [], functions: result.functions };
      } else {
        return result;
      }
    }

    // No exact match, try partial matching
    const partialResult = this.partialSearch(normalizedTerm, targetType);
    
    if (partialResult.files.length > 0 || partialResult.functions.length > 0) {
      return partialResult;
    }

    // Still no results, try fuzzy matching
    return this.fuzzySearch(normalizedTerm, targetType);
  }

  // Partial search (contains)
  private partialSearch(
    searchTerm: string,
    targetType?: 'files' | 'functions' | 'both'
  ): SearchResult {
    const result: SearchResult = { files: [], functions: [] };
    const seenFiles = new Set<string>();
    const seenFunctions = new Set<string>();

    this.index.keywords.forEach((value, keyword) => {
      if (keyword.includes(searchTerm)) {
        // Add files
        if (targetType !== 'functions') {
          value.files.forEach(file => {
            if (!seenFiles.has(file.path)) {
              result.files.push({ ...file, score: file.score - 2 }); // Lower score for partial
              seenFiles.add(file.path);
            }
          });
        }

        // Add functions
        if (targetType !== 'files') {
          value.functions.forEach(func => {
            const key = `${func.file}-${func.name}`;
            if (!seenFunctions.has(key)) {
              result.functions.push({ ...func, score: func.score - 2 });
              seenFunctions.add(key);
            }
          });
        }
      }
    });

    // Sort by score
    result.files.sort((a, b) => b.score - a.score);
    result.functions.sort((a, b) => b.score - a.score);

    return result;
  }

  // Fuzzy search with Levenshtein distance
  private fuzzySearch(
    searchTerm: string,
    targetType?: 'files' | 'functions' | 'both'
  ): SearchResult {
    const result: SearchResult = { files: [], functions: [] };
    const seenFiles = new Set<string>();
    const seenFunctions = new Set<string>();
    const maxDistance = 2;

    this.index.keywords.forEach((value, keyword) => {
      const distance = this.levenshteinDistance(searchTerm, keyword);
      
      if (distance <= maxDistance) {
        // Add files
        if (targetType !== 'functions') {
          value.files.forEach(file => {
            if (!seenFiles.has(file.path)) {
              result.files.push({ ...file, score: file.score - distance * 2 }); // Penalize by distance
              seenFiles.add(file.path);
            }
          });
        }

        // Add functions
        if (targetType !== 'files') {
          value.functions.forEach(func => {
            const key = `${func.file}-${func.name}`;
            if (!seenFunctions.has(key)) {
              result.functions.push({ ...func, score: func.score - distance * 2 });
              seenFunctions.add(key);
            }
          });
        }
      }
    });

    // Sort by score
    result.files.sort((a, b) => b.score - a.score);
    result.functions.sort((a, b) => b.score - a.score);

    return result;
  }
}
