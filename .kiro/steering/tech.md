# Tech Stack

## Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 5
- **Styling**: Tailwind CSS 3 with PostCSS
- **State Management**: Zustand
- **Canvas/Flow**: React Flow for infinite canvas visualization
- **Routing**: React Router DOM v7
- **Code Editing**: react-simple-code-editor with Prism.js highlighting
- **Drawing**: Excalidraw integration
- **Collaboration**: Yjs for CRDT-based sync
- **GitHub API**: Octokit

## Backend (backend/)
- **Runtime**: Node.js with Express
- **Real-time**: Socket.IO for WebSocket communication
- **Purpose**: Collaboration signaling server for room-based file sync

## TypeScript Configuration
- Target: ES2020
- Strict mode enabled
- Path alias: `@/*` maps to `src/*`
- JSX: react-jsx

## Common Commands

```bash
# Install dependencies
npm install

# Start frontend dev server (port 5173)
npm run dev

# Build for production
npm run build

# Run ESLint
npm run lint

# Preview production build
npm run preview

# Start backend server (from backend/)
cd backend && npm run dev
```

## Key Dependencies
- `reactflow` - Canvas visualization
- `zustand` - Lightweight state management
- `prismjs` - Syntax highlighting
- `jszip` / `file-saver` - File export functionality
- `diff` - Code diff utilities
- `lucide-react` - Icons
