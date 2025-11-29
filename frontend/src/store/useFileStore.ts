import { create } from 'zustand';
import { FileAnalysis, analyzeCode } from '../utils/codeAnalyzer';

export interface FileStructure {
  name: string;
  path: string;
  content: string;
  language: string;
  analysis?: FileAnalysis;
  lastSyncedContent?: string;
}

export interface Drawing {
  id: string;
  type: 'freehand' | 'rectangle' | 'circle' | 'line' | 'text';
  points: { x: number; y: number }[];
  color: string;
  strokeWidth: number;
  text?: string;
}

interface GitHubContext {
  owner: string;
  repo: string;
  branch: string;
  token?: string;
  sha?: string;
}

export interface FileSegment {
  category: string;
  description: string;
  files: string[];
  icon: string;
}

export interface GitHubTreeNode {
  path: string;
  sha: string;
}

export type ViewMode = 'full' | 'understanding';

export interface CachedRepoData {
  segments: FileSegment[];
  allFiles: FileStructure[]; // Fetched files cached
  selectedCategories: Set<string>;
  // For GitHub lazy loading
  pendingTree?: GitHubTreeNode[]; // Files not yet fetched
  viewMode: ViewMode;
}

interface FileStore {
  files: FileStructure[];
  drawings: Drawing[];
  githubContext: GitHubContext | null;
  cachedRepoData: CachedRepoData | null;
  setFiles: (files: FileStructure[]) => void;
  addFile: (file: FileStructure) => void;
  updateFileContent: (path: string, newContent: string) => void;
  setGitHubContext: (context: GitHubContext | null) => void;
  clearFiles: () => void;
  updateFileAnalysis: (path: string, analysis: FileAnalysis) => void;
  markAllAsSynced: () => void;
  addDrawing: (drawing: Drawing) => void;
  updateDrawing: (id: string, updates: Partial<Drawing>) => void;
  removeDrawing: (id: string) => void;
  setDrawings: (drawings: Drawing[] | ((prev: Drawing[]) => Drawing[])) => void;
  setCachedRepoData: (data: CachedRepoData | null) => void;
  switchSegments: (categories: Set<string>) => void;
  addToCache: (files: FileStructure[]) => void;
  setViewMode: (mode: ViewMode) => void;
}

export const useFileStore = create<FileStore>((set) => ({
  files: [],
  drawings: [],
  githubContext: null,
  cachedRepoData: null,
  setFiles: (files) => set({ files }),
  addFile: (file) => set((state) => ({ files: [...state.files, file] })),
  updateFileContent: (path, newContent) => set((state) => {
    const updatedFiles = state.files.map(f => {
      if (f.path === path) {
        // Re-analyze the code dynamically
        const analysis = analyzeCode(path, newContent);
        return { ...f, content: newContent, analysis };
      }
      return f;
    });
    return { files: updatedFiles };
  }),
  setGitHubContext: (context) => set({ githubContext: context }),
  clearFiles: () => set({ files: [], drawings: [], githubContext: null, cachedRepoData: null }),
  updateFileAnalysis: (path, analysis) => set((state) => ({
    files: state.files.map((f) => (f.path === path ? { ...f, analysis } : f)),
  })),
  markAllAsSynced: () => set((state) => ({
    files: state.files.map(f => ({ ...f, lastSyncedContent: f.content }))
  })),
  addDrawing: (drawing) => set((state) => ({ drawings: [...state.drawings, drawing] })),
  updateDrawing: (id, updates) => set((state) => ({
    drawings: state.drawings.map(d => d.id === id ? { ...d, ...updates } : d)
  })),
  removeDrawing: (id) => set((state) => ({
    drawings: state.drawings.filter(d => d.id !== id)
  })),
  setDrawings: (drawingsOrUpdater) => set((state) => ({
    drawings: typeof drawingsOrUpdater === 'function' 
      ? (drawingsOrUpdater as (prev: Drawing[]) => Drawing[])(state.drawings)
      : drawingsOrUpdater
  })),
  setCachedRepoData: (data) => set({ cachedRepoData: data }),
  switchSegments: (categories) => set((state) => {
    if (!state.cachedRepoData) return {};
    
    const selectedPaths = new Set(
      state.cachedRepoData.segments
        .filter(s => categories.has(s.category))
        .flatMap(s => s.files)
    );
    
    const newFiles = state.cachedRepoData.allFiles.filter(f => selectedPaths.has(f.path));
    
    return {
      files: newFiles,
      cachedRepoData: { ...state.cachedRepoData, selectedCategories: categories }
    };
  }),
  addToCache: (files) => set((state) => {
    if (!state.cachedRepoData) return {};
    const existingPaths = new Set(state.cachedRepoData.allFiles.map(f => f.path));
    const newFiles = files.filter(f => !existingPaths.has(f.path));
    return {
      cachedRepoData: {
        ...state.cachedRepoData,
        allFiles: [...state.cachedRepoData.allFiles, ...newFiles]
      }
    };
  }),
  setViewMode: (mode) => set((state) => {
    if (!state.cachedRepoData) return {};
    return {
      cachedRepoData: { ...state.cachedRepoData, viewMode: mode }
    };
  }),
}));
