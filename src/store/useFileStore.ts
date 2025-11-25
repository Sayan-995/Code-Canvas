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

interface FileStore {
  files: FileStructure[];
  drawings: Drawing[];
  githubContext: GitHubContext | null;
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
}

export const useFileStore = create<FileStore>((set) => ({
  files: [],
  drawings: [],
  githubContext: null,
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
  clearFiles: () => set({ files: [], drawings: [], githubContext: null }),
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
}));
