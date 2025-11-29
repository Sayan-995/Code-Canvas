import { create } from 'zustand';

interface ExplanationStore {
  isOpen: boolean;
  title: string;
  content: string;
  isLoading: boolean;
  openExplanation: (title: string, content: string, isLoading?: boolean) => void;
  setContent: (content: string) => void;
  setIsLoading: (isLoading: boolean) => void;
  closeExplanation: () => void;
}

export const useExplanationStore = create<ExplanationStore>((set) => ({
  isOpen: false,
  title: '',
  content: '',
  isLoading: false,
  openExplanation: (title, content, isLoading = false) => set({ isOpen: true, title, content, isLoading }),
  setContent: (content) => set({ content }),
  setIsLoading: (isLoading) => set({ isLoading }),
  closeExplanation: () => set({ isOpen: false }),
}));
