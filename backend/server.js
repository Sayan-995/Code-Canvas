try {
  require('dotenv').config();
} catch (e) {
  // dotenv is optional, only needed for local development
}
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const WebSocket = require('ws');
const { setupWSConnection } = require('./y-utils');

const app = express();

// Allow ALL origins
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' })); // Enable JSON body parsing with large limit

const server = http.createServer(app);

// Setup Yjs WebSocket server
const wss = new WebSocket.Server({ noServer: true });

wss.on('connection', (ws, req) => {
  setupWSConnection(ws, req);
});

server.on('upgrade', (request, socket, head) => {
  // IMPORTANT: Ignore Socket.IO requests here, let Socket.IO handle them
  if (request.url.startsWith('/socket.io/')) {
    return;
  }

  // Handle Yjs WebSocket connections
  if (request.url.startsWith('/')) { 
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  }
});

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://kiro-two.vercel.app';

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  path: '/socket.io',
  transports: ['websocket', 'polling']
});

const PORT = process.env.PORT || 3001;

const roomData = new Map(); // roomId -> { files: [] }

io.on('connection', (socket) => {
  socket.on('join_room', (roomId) => {
    socket.join(roomId);
    
    // Send existing files to the new user
    if (roomData.has(roomId)) {
      socket.emit('sync_files', roomData.get(roomId).files);
    }
  });

  socket.on('upload_files', ({ roomId, files }) => {
    roomData.set(roomId, { files });
    // Broadcast to others in the room (excluding sender)
    socket.to(roomId).emit('sync_files', files);
  });

  socket.on('send_message', (data) => {
    // data: { room, user, text, time }
    socket.to(data.room).emit('receive_message', data);
  });

  socket.on('disconnect', () => {
    // User disconnected
  });

  socket.on('error', (error) => {
    // Socket error
  });
});

io.engine.on('connection_error', (err) => {
  // Connection error
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
