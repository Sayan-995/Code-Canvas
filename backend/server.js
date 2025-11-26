const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for now, or specify your frontend URL
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;

const roomData = new Map(); // roomId -> { files: [] }

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join_room', (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room: ${roomId}`);
    
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
    console.log('User disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
