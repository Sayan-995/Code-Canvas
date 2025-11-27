# Project Structure

```
├── src/
│   ├── App.tsx              # Root component, renders CodeEditor
│   ├── main.tsx             # Entry point with React Router setup
│   ├── index.css            # Global styles (Tailwind imports)
│   │
│   ├── components/          # React components
│   │   ├── CodeCanvas.tsx       # React Flow canvas container
│   │   ├── CodeEditor.tsx       # Main editor orchestrator
│   │   ├── FileNode.tsx         # Individual file node on canvas
│   │   ├── UploadScreen.tsx     # Initial upload/import UI
│   │   ├── DrawingNode.tsx      # Excalidraw integration
│   │   ├── ExplanationPanel.tsx # AI explanation display
│   │   └── ...
│   │
│   ├── services/            # Business logic and external integrations
│   │   ├── staticAnalyzer.ts    # Orchestrates ESLint + TypeScript analysis
│   │   ├── eslintRunner.ts      # ESLint execution
│   │   ├── typescriptChecker.ts # TypeScript diagnostics
│   │   ├── analysisCache.ts     # Analysis result caching
│   │   ├── gemini.ts            # AI explanation service
│   │   ├── repoSeparator.ts     # Repository segmentation logic
│   │   └── searchEngine.ts      # File/code search
│   │
│   ├── store/               # Zustand state stores
│   │   ├── useFileStore.ts      # File tree and content state
│   │   ├── useAnalysisStore.ts  # Static analysis results
│   │   └── useExplanationStore.ts
│   │
│   ├── hooks/               # Custom React hooks
│   │   ├── useCollaboration.ts  # Socket.IO collaboration
│   │   └── useVoiceRecognition.ts
│   │
│   ├── types/               # TypeScript type definitions
│   │   └── analysis.ts          # Diagnostic and analysis types
│   │
│   └── utils/               # Utility functions
│       └── codeAnalyzer.ts
│
├── backend/                 # Express + Socket.IO server
│   └── server.js            # Collaboration signaling server
│
├── public/                  # Static assets
└── sample-project/          # Example project for testing
```

## Architecture Patterns

- **State**: Zustand stores with actions pattern (see `useAnalysisStore.ts`)
- **Services**: Pure functions or classes in `services/` for business logic
- **Components**: Functional components with hooks, no class components
- **Types**: Centralized in `types/` directory with JSDoc comments
- **Caching**: Content-hash based caching for analysis results
