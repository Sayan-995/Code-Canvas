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

interface GitHubContext {
  owner: string;
  repo: string;
  branch: string;
  token?: string;
  sha?: string;
}

interface FileStore {
  files: FileStructure[];
  githubContext: GitHubContext | null;
  setFiles: (files: FileStructure[]) => void;
  addFile: (file: FileStructure) => void;
  updateFileContent: (path: string, newContent: string) => void;
  setGitHubContext: (context: GitHubContext | null) => void;
  clearFiles: () => void;
  updateFileAnalysis: (path: string, analysis: FileAnalysis) => void;
  markAllAsSynced: () => void;
}

export const useFileStore = create<FileStore>((set) => ({
  files: [],
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
  clearFiles: () => set({ files: [], githubContext: null }),
  updateFileAnalysis: (path, analysis) => set((state) => ({
    files: state.files.map((f) => (f.path === path ? { ...f, analysis } : f)),
  })),
  markAllAsSynced: () => set((state) => ({
    files: state.files.map(f => ({ ...f, lastSyncedContent: f.content }))
  })),
}));
