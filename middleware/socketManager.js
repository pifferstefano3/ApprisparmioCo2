const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const Message = require('../models/Message');
const User = require('../models/User');

class SocketManager {
  constructor(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.CLIENT_URL || '*',
        methods: ['GET', 'POST']
      }
    });
    
    this.setupSocketHandlers();
  }
  
  setupSocketHandlers() {
    this.io.on('connection', async (socket) => {
      console.log(`[Socket.io] Client connesso: ${socket.id}`);
      
      // Authenticate socket connection
      const token = socket.handshake.auth.token;
      let userId = null;
      let userName = 'Anonymous';
      
      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'verdent-secret-key');
          userId = decoded.userId;
          const user = await User.findById(userId).select('name avatar');
          if (user) {
            userName = user.name;
            socket.userId = userId;
            socket.userName = userName;
            socket.userAvatar = user.avatar;
            console.log(`[Socket.io] User authenticated: ${userName} (${userId})`);
          }
        } catch (err) {
          console.error('[Socket.io] Auth error:', err.message);
        }
      }
      
      // Join room
      socket.on('joinRoom', (room) => {
        socket.join(room);
        console.log(`[Socket.io] ${userName} joined room: ${room}`);
        socket.to(room).emit('userJoined', { userName, userId, timestamp: new Date() });
      });
      
      // Leave room
      socket.on('leaveRoom', (room) => {
        socket.leave(room);
        console.log(`[Socket.io] ${userName} left room: ${room}`);
        socket.to(room).emit('userLeft', { userName, userId, timestamp: new Date() });
      });
      
      // Send message with MongoDB persistence
      socket.on('sendMessage', async (data) => {
        const { room, message, type = 'text' } = data;
        
        if (!message || !message.trim()) return;
        if (!userId) {
          socket.emit('error', { message: 'Authentication required' });
          return;
        }
        
        try {
          // Save message to MongoDB
          const newMessage = new Message({
            room: room.trim(),
            sender: userId,
            content: message.trim(),
            type,
            createdAt: new Date()
          });
          
          await newMessage.save();
          await newMessage.populate('sender', 'name avatar');
          
          const messageData = {
            id: newMessage._id,
            room: newMessage.room,
            sender: {
              id: userId,
              name: socket.userName,
              avatar: socket.userAvatar
            },
            message: newMessage.content,
            type: newMessage.type,
            timestamp: newMessage.createdAt,
            reactions: []
          };
          
          // Broadcast to room
          this.io.to(room).emit('newMessage', messageData);
          console.log(`[Socket.io] Message saved and broadcast to ${room} by ${userName}`);
          
        } catch (error) {
          console.error('[Socket.io] Error saving message:', error);
          socket.emit('error', { message: 'Failed to save message' });
        }
      });
      
      // Typing indicator
      socket.on('typing', (data) => {
        const { room, isTyping } = data;
        socket.to(room).emit('userTyping', {
          userId,
          userName,
          isTyping
        });
      });
      
      // Disconnect
      socket.on('disconnect', () => {
        console.log(`[Socket.io] Client disconnesso: ${socket.id} (${userName})`);
      });
    });
  }
  
  // Helper methods
  emitToRoom(room, event, data) {
    this.io.to(room).emit(event, data);
  }
  
  emitToAll(event, data) {
    this.io.emit(event, data);
  }
  
  getConnectedClients() {
    return this.io.sockets.sockets.size;
  }
}

module.exports = SocketManager;
