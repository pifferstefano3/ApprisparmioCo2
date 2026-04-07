const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message');

class SocketManager {
  constructor(server) {
    this.io = socketIo(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    
    this.connectedUsers = new Map(); // userId -> socketId
    this.userSockets = new Map(); // socketId -> userId
    this.rooms = new Map(); // roomId -> Set of userIds
    
    this.setupMiddleware();
    this.setupEventHandlers();
  }
  
  setupMiddleware() {
    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error('Authentication required'));
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).select('name avatar');
        
        if (!user) {
          return next(new Error('User not found'));
        }
        
        socket.user = user;
        socket.userId = user._id.toString();
        next();
      } catch (error) {
        next(new Error('Invalid token'));
      }
    });
  }
  
  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`User ${socket.user.name} connected`);
      
      // Store user connection
      this.connectedUsers.set(socket.userId, socket.id);
      this.userSockets.set(socket.id, socket.userId);
      
      // Join global room
      socket.join('global');
      this.addToRoom('global', socket.userId);
      
      // Join team rooms
      this.joinUserTeams(socket);
      
      // Send online users list
      this.broadcastOnlineUsers();
      
      // Handle joining specific room
      socket.on('joinRoom', (roomId) => {
        this.handleJoinRoom(socket, roomId);
      });
      
      // Handle leaving room
      socket.on('leaveRoom', (roomId) => {
        this.handleLeaveRoom(socket, roomId);
      });
      
      // Handle typing indicators
      socket.on('typing', (data) => {
        this.handleTyping(socket, data);
      });
      
      socket.on('stopTyping', (data) => {
        this.handleStopTyping(socket, data);
      });
      
      // Handle private messages
      socket.on('privateMessage', async (data) => {
        await this.handlePrivateMessage(socket, data);
      });
      
      // Handle mark as read
      socket.on('markAsRead', async (data) => {
        await this.handleMarkAsRead(socket, data);
      });
      
      // Handle disconnection
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }
  
  async joinUserTeams(socket) {
    try {
      const Team = require('../models/Team');
      const userTeams = await Team.find({ 
        'members.user': socket.userId,
        isActive: true 
      });
      
      for (const team of userTeams) {
        const roomId = `team-${team._id}`;
        socket.join(roomId);
        this.addToRoom(roomId, socket.userId);
      }
    } catch (error) {
      console.error('Error joining user teams:', error);
    }
  }
  
  handleJoinRoom(socket, roomId) {
    const roomType = this.getRoomType(roomId);
    
    if (!this.canAccessRoom(socket.userId, roomId, roomType)) {
      socket.emit('error', { message: 'Non hai accesso a questa room' });
      return;
    }
    
    socket.join(roomId);
    this.addToRoom(roomId, socket.userId);
    
    // Notify others in room
    socket.to(roomId).emit('userJoined', {
      userId: socket.userId,
      userName: socket.user.name,
      roomId: roomId
    });
    
    // Send room info to user
    this.sendRoomInfo(socket, roomId);
  }
  
  handleLeaveRoom(socket, roomId) {
    socket.leave(roomId);
    this.removeFromRoom(roomId, socket.userId);
    
    // Notify others in room
    socket.to(roomId).emit('userLeft', {
      userId: socket.userId,
      userName: socket.user.name,
      roomId: roomId
    });
  }
  
  handleTyping(socket, data) {
    const { roomId } = data;
    
    if (this.canUserAccessRoom(socket.userId, roomId)) {
      socket.to(roomId).emit('userTyping', {
        userId: socket.userId,
        userName: socket.user.name,
        roomId: roomId
      });
    }
  }
  
  handleStopTyping(socket, data) {
    const { roomId } = data;
    
    if (this.canUserAccessRoom(socket.userId, roomId)) {
      socket.to(roomId).emit('userStopTyping', {
        userId: socket.userId,
        roomId: roomId
      });
    }
  }
  
  async handlePrivateMessage(socket, data) {
    try {
      const { recipientId, content } = data;
      
      if (!recipientId || !content) {
        socket.emit('error', { message: 'Dati del messaggio privato incompleti' });
        return;
      }
      
      const recipientSocketId = this.connectedUsers.get(recipientId);
      
      if (!recipientSocketId) {
        socket.emit('error', { message: 'Utente non online' });
        return;
      }
      
      // Create private room ID
      const roomId = this.getPrivateRoomId(socket.userId, recipientId);
      
      // Save message to database
      const Message = require('../models/Message');
      const message = new Message({
        content: content.trim(),
        type: 'text',
        sender: socket.userId,
        room: roomId,
        roomType: 'private'
      });
      
      await message.save();
      await message.populate('sender', 'name avatar');
      
      // Join both users to private room
      socket.join(roomId);
      this.addToRoom(roomId, socket.userId);
      
      const recipientSocket = this.io.sockets.sockets.get(recipientSocketId);
      if (recipientSocket) {
        recipientSocket.join(roomId);
        this.addToRoom(roomId, recipientId);
      }
      
      // Send message to both users
      this.io.to(roomId).emit('newPrivateMessage', message);
      
      // Send notification to recipient if not in room
      if (!recipientSocket || !recipientSocket.rooms.has(roomId)) {
        this.io.to(recipientSocketId).emit('newMessageNotification', {
          message: 'Nuovo messaggio privato',
          sender: socket.user.name,
          roomId: roomId
        });
      }
      
    } catch (error) {
      console.error('Private message error:', error);
      socket.emit('error', { message: 'Errore nell\'invio del messaggio privato' });
    }
  }
  
  async handleMarkAsRead(socket, data) {
    try {
      const { messageId } = data;
      
      const message = await Message.findById(messageId);
      if (!message) {
        return;
      }
      
      await message.markAsRead(socket.userId);
      
      // Notify sender that message was read
      socket.to(message.room).emit('messageRead', {
        messageId: messageId,
        userId: socket.userId,
        readAt: new Date()
      });
      
    } catch (error) {
      console.error('Mark as read error:', error);
    }
  }
  
  handleDisconnect(socket) {
    console.log(`User ${socket.user.name} disconnected`);
    
    // Remove user from all rooms
    for (const [roomId, users] of this.rooms) {
      if (users.has(socket.userId)) {
        this.removeFromRoom(roomId, socket.userId);
        
        // Notify others in room
        socket.to(roomId).emit('userLeft', {
          userId: socket.userId,
          userName: socket.user.name,
          roomId: roomId
        });
      }
    }
    
    // Remove from connected users
    this.connectedUsers.delete(socket.userId);
    this.userSockets.delete(socket.id);
    
    // Broadcast updated online users
    this.broadcastOnlineUsers();
  }
  
  async sendRoomInfo(socket, roomId) {
    try {
      const roomType = this.getRoomType(roomId);
      const roomUsers = this.rooms.get(roomId) || new Set();
      
      const onlineUsers = [];
      for (const userId of roomUsers) {
        const userSocketId = this.connectedUsers.get(userId);
        if (userSocketId) {
          const userSocket = this.io.sockets.sockets.get(userSocketId);
          if (userSocket) {
            onlineUsers.push({
              userId: userId,
              userName: userSocket.user.name,
              userAvatar: userSocket.user.avatar
            });
          }
        }
      }
      
      socket.emit('roomInfo', {
        roomId: roomId,
        roomType: roomType,
        onlineUsers: onlineUsers,
        userCount: onlineUsers.length
      });
      
    } catch (error) {
      console.error('Send room info error:', error);
    }
  }
  
  broadcastOnlineUsers() {
    const onlineUsers = [];
    
    for (const [userId, socketId] of this.connectedUsers) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        onlineUsers.push({
          userId: userId,
          userName: socket.user.name,
          userAvatar: socket.user.avatar
        });
      }
    }
    
    this.io.emit('onlineUsers', onlineUsers);
  }
  
  // Helper methods
  getRoomType(roomId) {
    if (roomId === 'global') return 'global';
    if (roomId.startsWith('team-')) return 'team';
    if (roomId.startsWith('private-')) return 'private';
    return null;
  }
  
  getPrivateRoomId(userId1, userId2) {
    const sorted = [userId1, userId2].sort();
    return `private-${sorted[0]}-${sorted[1]}`;
  }
  
  async canAccessRoom(userId, roomId, roomType) {
    switch (roomType) {
      case 'global':
        return true;
      
      case 'team':
        const Team = require('../models/Team');
        const teamId = roomId.replace('team-', '');
        const team = await Team.findById(teamId);
        return team && team.isMember(userId);
      
      case 'private':
        const [_, id1, id2] = roomId.split('-');
        return userId === id1 || userId === id2;
      
      default:
        return false;
    }
  }
  
  canUserAccessRoom(userId, roomId) {
    const roomUsers = this.rooms.get(roomId);
    return roomUsers && roomUsers.has(userId);
  }
  
  addToRoom(roomId, userId) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }
    this.rooms.get(roomId).add(userId);
  }
  
  removeFromRoom(roomId, userId) {
    const roomUsers = this.rooms.get(roomId);
    if (roomUsers) {
      roomUsers.delete(userId);
      if (roomUsers.size === 0) {
        this.rooms.delete(roomId);
      }
    }
  }
  
  // Public methods for external use
  emitToRoom(roomId, event, data) {
    this.io.to(roomId).emit(event, data);
  }
  
  emitToUser(userId, event, data) {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.io.to(socketId).emit(event, data);
    }
  }
  
  getOnlineUserCount() {
    return this.connectedUsers.size;
  }
  
  getRoomUserCount(roomId) {
    const roomUsers = this.rooms.get(roomId);
    return roomUsers ? roomUsers.size : 0;
  }
}

module.exports = SocketManager;
