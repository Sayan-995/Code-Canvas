# Code Canvas Clone

A React + TypeScript application that visualizes your code files as floating nodes on an infinite canvas.

## Features

- **Upload Folder**: Select a local folder to visualize its structure.
- **GitHub Import**: Import a public GitHub repository.
- **Infinite Canvas**: Navigate through your files using an infinite canvas (powered by React Flow).
- **File Preview**: View the content of your files directly on the canvas.

## Getting Started

1.  Install frontend dependencies:
    ```bash
    npm install
    ```

2.  Install backend dependencies:
    ```bash
    cd backend
    npm install
    cd ..
    ```

3.  Start the backend server (in a separate terminal):
    ```bash
    cd backend
    npm run dev
    ```

4.  Start the frontend development server (in a new terminal):
    ```bash
    npm run dev
    ```

5.  Open your browser at `http://localhost:5173`.

## Technologies

- React
- TypeScript
- Vite
- React Flow
- Tailwind CSS
- Zustand
- Octokit
- Node.js & Express (Backend)
- Socket.io (Real-time Chat)
