# Code Canvas

**Code Canvas** is an interactive, visual development environment that transforms your codebase into an infinite, spatial map. Instead of navigating files in a linear list, explore your project as a living graph where logic flows visibly.

Built for developers who think visually, Code Canvas combines real-time collaboration, AI-powered organization, and AST-based analysis to help you understand complex systems faster.

![Code Canvas Demo](https://via.placeholder.com/800x400?text=Code+Canvas+Preview) *(Replace with actual screenshot)*

## 🚀 Features

### 🧠 Visual Code Understanding
- **Infinite Canvas**: Navigate your entire codebase on a zoomable, pannable 2D plane (powered by React Flow).
- **AST Analysis**: Automatically detects dependencies and draws connection lines between files that import/export from each other.
- **Flow Visualization**: Watch code execution paths come alive with animated "flow particles" that trace logic from function to function.

### 🤝 Real-Time Collaboration
- **Multiplayer Mode**: Invite teammates to your session via a simple link.
- **Live Cursors & Selection**: See where others are looking and what they are editing in real-time.
- **Shared Drawing Board**: Annotate code, draw architectural diagrams, or sketch ideas directly on the canvas.
- **Integrated Chat**: Discuss code context without leaving the visual environment.

### 🤖 AI-Powered Organization
- **Smart Categorization**: Uses Gemini AI to automatically group files into logical clusters (e.g., "Services", "Components", "Utils") based on their content, not just folder structure.
- **Semantic Understanding**: Helps untangle "spaghetti code" by visually separating concerns.

### 🗣️ Voice & Accessibility
- **Voice Commands**: Navigate, search, and control the canvas using natural voice commands (e.g., "Go to Auth Service", "Zoom in").
- **Mobile Optimized**: Fully responsive design that works on tablets and phones for code review on the go.

### 🛠️ Developer Tools
- **GitHub Import**: Instantly visualize any public GitHub repository.
- **Local Upload**: Drag and drop local folders to map out private projects.
- **Linting Integration**: See linting errors and warnings directly on the visual nodes.
- **Monaco Editor**: Full-featured code editing experience inside every node.

## 🏗️ Tech Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS
- **Visualization**: React Flow, D3.js (for layout algorithms)
- **State Management**: Zustand
- **Collaboration**: Yjs, WebSockets, Socket.io
- **Backend**: Node.js, Express
- **AI**: Google Gemini API
- **Parsing**: Babel Parser (AST generation)

## 🏁 Getting Started

### Prerequisites
- Node.js (v18+)
- npm or yarn

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/yourusername/code-canvas.git
    cd code-canvas
    ```

2.  **Install Frontend Dependencies**
    ```bash
    npm install
    ```

3.  **Install Backend Dependencies**
    ```bash
    cd backend
    npm install
    cd ..
    ```

4.  **Environment Setup**
    - Create a `.env` file in the root directory:
      ```env
      VITE_BACKEND_URL=http://localhost:3001
      VITE_GEMINI_API_KEY=your_gemini_api_key_here
      ```
    - Create a `.env` file in the `backend` directory:
      ```env
      PORT=3001
      ```

### Running the App

1.  **Start the Backend** (Terminal 1)
    ```bash
    cd backend
    npm start
    ```

2.  **Start the Frontend** (Terminal 2)
    ```bash
    npm run dev
    ```

3.  Open `http://localhost:5173` in your browser.

## 🌍 Deployment

- **Frontend**: Deployed on [Vercel](https://vercel.com).
- **Backend**: Deployed on [Railway](https://railway.app) (or Render) for WebSocket support.

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

## 👥 Authors

- **Sayan Dutta**
- **Afham Shakeel**
- **Samiran Chakraborty**