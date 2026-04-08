const { Server } = require('socket.io');

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
    this.io.on('connection', (socket) => {
      console.log(`[Socket.io] Client connesso: ${socket.id}`);
      
      // Join room
      socket.on('joinRoom', (room) => {
        socket.join(room);
        console.log(`[Socket.io] Socket ${socket.id} si è unito alla stanza: ${room}`);
      });
      
      // Leave room
      socket.on('leaveRoom', (room) => {
        socket.leave(room);
        console.log(`[Socket.io] Socket ${socket.id} ha lasciato la stanza: ${room}`);
      });
      
      // Send message
      socket.on('sendMessage', (data) => {
        const { room, message } = data;
        this.io.to(room).emit('newMessage', {
          id: Date.now(),
          room,
          message,
          senderId: socket.id,
          timestamp: new Date()
        });
      });
      
      // Typing indicator
      socket.on('typing', (data) => {
        const { room, isTyping } = data;
        socket.to(room).emit('userTyping', {
          socketId: socket.id,
          isTyping
        });
      });
      
      // Disconnect
      socket.on('disconnect', () => {
        console.log(`[Socket.io] Client disconnesso: ${socket.id}`);
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
