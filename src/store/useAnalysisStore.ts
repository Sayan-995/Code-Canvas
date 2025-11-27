import { create } from 'zustand';
import {
  AnalysisResult,
  AnalysisConfig,
  AnalysisCacheEntry,
} from '../types/analysis';

interface AnalysisStore {
  // State
  analysisResults: Map<string, AnalysisResult>; // keyed by segmentId
  analysisConfig: AnalysisConfig;
  isAnalyzing: boolean;
  analysisCache: Map<string, AnalysisCacheEntry>; // keyed by cache key

  // Actions
  setAnalysisResult: (segmentId: string, result: AnalysisResult) => void;
  setAnalysisResults: (results: Map<string, AnalysisResult>) => void;
  clearAnalysisResults: () => void;
  removeAnalysisResult: (segmentId: string) => void;

  setAnalysisConfig: (config: Partial<AnalysisConfig>) => void;
  resetAnalysisConfig: () => void;

  setIsAnalyzing: (isAnalyzing: boolean) => void;

  setCacheEntry: (key: string, entry: AnalysisCacheEntry) => void;
  getCacheEntry: (key: string) => AnalysisCacheEntry | undefined;
  invalidateCache: (segmentId?: string) => void;
  clearCache: () => void;
}

const defaultConfig: AnalysisConfig = {
  eslintEnabled: true,
  typescriptEnabled: true,
  eslintConfig: undefined,
  tsconfigPath: undefined,
};

export const useAnalysisStore = create<AnalysisStore>((set, get) => ({
  // Initial state
  analysisResults: new Map(),
  analysisConfig: { ...defaultConfig },
  isAnalyzing: false,
  analysisCache: new Map(),

  // Analysis results actions
  setAnalysisResult: (segmentId, result) =>
    set((state) => {
      const newResults = new Map(state.analysisResults);
      newResults.set(segmentId, result);
      return { analysisResults: newResults };
    }),

  setAnalysisResults: (results) => set({ analysisResults: results }),

  clearAnalysisResults: () => set({ analysisResults: new Map() }),

  removeAnalysisResult: (segmentId) =>
    set((state) => {
      const newResults = new Map(state.analysisResults);
      newResults.delete(segmentId);
      return { analysisResults: newResults };
    }),

  // Config actions
  setAnalysisConfig: (config) =>
    set((state) => ({
      analysisConfig: { ...state.analysisConfig, ...config },
    })),

  resetAnalysisConfig: () => set({ analysisConfig: { ...defaultConfig } }),

  // Analyzing state
  setIsAnalyzing: (isAnalyzing) => set({ isAnalyzing }),

  // Cache actions
  setCacheEntry: (key, entry) =>
    set((state) => {
      const newCache = new Map(state.analysisCache);
      newCache.set(key, entry);
      return { analysisCache: newCache };
    }),

  getCacheEntry: (key) => get().analysisCache.get(key),

  invalidateCache: (segmentId) =>
    set((state) => {
      if (!segmentId) {
        return { analysisCache: new Map() };
      }
      const newCache = new Map(state.analysisCache);
      // Remove all cache entries that contain the segmentId
      for (const [key] of newCache) {
        if (key.includes(`:${segmentId}:`)) {
          newCache.delete(key);
        }
      }
      return { analysisCache: newCache };
    }),

  clearCache: () => set({ analysisCache: new Map() }),
}));
