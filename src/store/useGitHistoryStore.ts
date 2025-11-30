import { create } from 'zustand';

export interface CommitFile {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions?: number;
  deletions?: number;
  patch?: string; // Diff patch data
}

export interface GitCommit {
  sha: string;
  message: string;
  author: {
    name: string;
    avatar: string;
    date: string;
  };
  files: CommitFile[];
}

export interface FileState {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'unchanged';
  patch?: string; // Diff patch for changed files
  animationDelay?: number; // For staggered animations
}

interface GitHistoryStore {
  commits: GitCommit[];
  currentCommitIndex: number;
  isLoading: boolean;
  error: string | null;
  isPlaying: boolean;
  playSpeed: number;

  // Computed: files that exist at current commit
  filesAtCurrentCommit: FileState[];

  setCommits: (commits: GitCommit[]) => void;
  setCurrentCommitIndex: (index: number) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setIsPlaying: (playing: boolean) => void;
  setPlaySpeed: (speed: number) => void;
  nextCommit: () => void;
  prevCommit: () => void;
  reset: () => void;
  computeFilesAtCommit: (index: number) => FileState[];
}

export const useGitHistoryStore = create<GitHistoryStore>((set, get) => ({
  commits: [],
  currentCommitIndex: 0,
  isLoading: false,
  error: null,
  isPlaying: false,
  playSpeed: 1,
  filesAtCurrentCommit: [],

  setCommits: (commits) => {
    set({ commits });
    // Compute initial file state
    const filesAtCurrentCommit = get().computeFilesAtCommit(0);
    set({ filesAtCurrentCommit });
  },

  setCurrentCommitIndex: (index) => {
    const { commits } = get();
    if (index >= 0 && index < commits.length) {
      const filesAtCurrentCommit = get().computeFilesAtCommit(index);
      set({ currentCommitIndex: index, filesAtCurrentCommit });
    }
  },

  setIsLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setPlaySpeed: (playSpeed) => set({ playSpeed }),

  nextCommit: () => {
    const { currentCommitIndex, commits } = get();
    if (currentCommitIndex < commits.length - 1) {
      get().setCurrentCommitIndex(currentCommitIndex + 1);
    } else {
      set({ isPlaying: false });
    }
  },

  prevCommit: () => {
    const { currentCommitIndex } = get();
    if (currentCommitIndex > 0) {
      get().setCurrentCommitIndex(currentCommitIndex - 1);
    }
  },

  reset: () =>
    set({
      commits: [],
      currentCommitIndex: 0,
      isLoading: false,
      error: null,
      isPlaying: false,
      filesAtCurrentCommit: [],
    }),

  computeFilesAtCommit: (targetIndex: number): FileState[] => {
    const { commits } = get();
    if (commits.length === 0) return [];

    // Build up file state from commit 0 to targetIndex
    const fileMap = new Map<string, 'exists' | 'deleted'>();
    const changedInCurrentCommit = new Set<string>();
    const statusInCurrentCommit = new Map<string, 'added' | 'modified' | 'deleted'>();
    const patchInCurrentCommit = new Map<string, string>();

    for (let i = 0; i <= targetIndex; i++) {
      const commit = commits[i];
      const isCurrentCommit = i === targetIndex;

      for (const file of commit.files) {
        if (file.status === 'added') {
          fileMap.set(file.path, 'exists');
          if (isCurrentCommit) {
            changedInCurrentCommit.add(file.path);
            statusInCurrentCommit.set(file.path, 'added');
            if (file.patch) patchInCurrentCommit.set(file.path, file.patch);
          }
        } else if (file.status === 'modified') {
          fileMap.set(file.path, 'exists');
          if (isCurrentCommit) {
            changedInCurrentCommit.add(file.path);
            statusInCurrentCommit.set(file.path, 'modified');
            if (file.patch) patchInCurrentCommit.set(file.path, file.patch);
          }
        } else if (file.status === 'deleted') {
          fileMap.set(file.path, 'deleted');
          if (isCurrentCommit) {
            changedInCurrentCommit.add(file.path);
            statusInCurrentCommit.set(file.path, 'deleted');
            if (file.patch) patchInCurrentCommit.set(file.path, file.patch);
          }
        } else if (file.status === 'renamed') {
          fileMap.set(file.path, 'exists');
          if (isCurrentCommit) {
            changedInCurrentCommit.add(file.path);
            statusInCurrentCommit.set(file.path, 'added');
            if (file.patch) patchInCurrentCommit.set(file.path, file.patch);
          }
        }
      }
    }

    // Convert to FileState array with animation delays for changed files
    const result: FileState[] = [];
    let changedIndex = 0;

    fileMap.forEach((state, path) => {
      const isChanged = changedInCurrentCommit.has(path);
      const status = isChanged ? statusInCurrentCommit.get(path)! : 'unchanged';

      if (state === 'exists') {
        result.push({
          path,
          status,
          patch: isChanged ? patchInCurrentCommit.get(path) : undefined,
          animationDelay: isChanged ? changedIndex++ * 40 : 0, // 40ms stagger
        });
      } else if (state === 'deleted' && isChanged) {
        // Show deleted files only in the commit they were deleted
        result.push({
          path,
          status: 'deleted',
          patch: patchInCurrentCommit.get(path),
          animationDelay: changedIndex++ * 40,
        });
      }
    });

    return result;
  },
}));
