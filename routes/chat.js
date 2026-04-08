const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Message = require('../models/Message');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// Get chat messages for a room
router.get('/messages/:room', async (req, res) => {
  try {
    const { room } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    
    // Fetch messages from MongoDB
    const messages = await Message.find({ room: room.trim(), isDeleted: false })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('sender', 'name avatar');
    
    const total = await Message.countDocuments({ room: room.trim(), isDeleted: false });
    
    // Format messages for response
    const formattedMessages = messages.map(msg => ({
      id: msg._id,
      room: msg.room,
      sender: {
        id: msg.sender._id,
        name: msg.sender.name,
        avatar: msg.sender.avatar
      },
      message: msg.content,
      type: msg.type,
      timestamp: msg.createdAt,
      reactions: msg.reactions || []
    })).reverse(); // Reverse to show oldest first
    
    res.json({
      messages: formattedMessages,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Errore nel caricamento dei messaggi' });
  }
});

// Send a message to chat room
router.post('/send', async (req, res) => {
  try {
    const { room, message, type = 'text' } = req.body;
    const userId = req.userId;
    
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Il messaggio è obbligatorio' });
    }
    
    if (!room || room.trim().length === 0) {
      return res.status(400).json({ error: 'La stanza è obbligatoria' });
    }
    
    // Get user info
    const user = await User.findById(userId, 'name avatar');
    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }
    
    // Save message to MongoDB
    const newMessage = new Message({
      room: room.trim(),
      sender: userId,
      content: message.trim(),
      type,
      createdAt: new Date()
    });
    
    await newMessage.save();
    
    // Populate sender info for response
    await newMessage.populate('sender', 'name avatar');
    
    // Create response data
    const messageData = {
      id: newMessage._id,
      room: newMessage.room,
      sender: {
        id: userId,
        name: user.name,
        avatar: user.avatar
      },
      message: newMessage.content,
      type: newMessage.type,
      timestamp: newMessage.createdAt,
      reactions: []
    };
    
    // Emit message via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(room).emit('newMessage', messageData);
    }
    
    res.json({
      message: 'Messaggio inviato con successo',
      data: messageData
    });
    
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Errore nell\'invio del messaggio' });
  }
});

// Add reaction to message
router.post('/react/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.userId;
    
    if (!emoji || emoji.trim().length === 0) {
      return res.status(400).json({ error: 'L\'emoji è obbligatoria' });
    }
    
    // Create reaction object
    const reactionData = {
      messageId,
      userId,
      emoji: emoji.trim(),
      timestamp: new Date()
    };
    
    // Emit reaction via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.emit('newReaction', reactionData);
    }
    
    res.json({
      message: 'Reazione aggiunta con successo',
      data: reactionData
    });
    
  } catch (error) {
    console.error('Add reaction error:', error);
    res.status(500).json({ error: 'Errore nell\'aggiunta della reazione' });
  }
});

// Delete message
router.delete('/messages/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.userId;
    
    // Create delete event
    const deleteData = {
      messageId,
      userId,
      timestamp: new Date()
    };
    
    // Emit delete event via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.emit('deleteMessage', deleteData);
    }
    
    res.json({
      message: 'Messaggio eliminato con successo'
    });
    
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Errore nell\'eliminazione del messaggio' });
  }
});

// Get available chat rooms
router.get('/rooms', async (req, res) => {
  try {
    const userId = req.userId;
    
    // For now, return default rooms
    const rooms = [
      {
        id: 'global',
        name: 'Chat Globale',
        description: 'Chat con tutti gli utenti VERDENT',
        type: 'public',
        memberCount: 0
      },
      {
        id: 'eco-tips',
        name: 'Consigli Eco',
        description: 'Condividi consigli per vivere sostenibile',
        type: 'public',
        memberCount: 0
      }
    ];
    
    res.json({
      rooms: rooms
    });
    
  } catch (error) {
    console.error('Get rooms error:', error);
    res.status(500).json({ error: 'Errore nel caricamento delle stanze' });
  }
});

// Join chat room
router.post('/join/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.userId;
    
    // Get user info
    const user = await User.findById(userId, 'name avatar');
    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }
    
    // Create join event
    const joinData = {
      roomId: roomId.trim(),
      user: {
        id: userId,
        name: user.name,
        avatar: user.avatar
      },
      timestamp: new Date()
    };
    
    // Emit join event via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(roomId).emit('userJoined', joinData);
    }
    
    res.json({
      message: 'Ti sei unito alla stanza con successo',
      data: joinData
    });
    
  } catch (error) {
    console.error('Join room error:', error);
    res.status(500).json({ error: 'Errore nell\'unione alla stanza' });
  }
});

// Leave chat room
router.post('/leave/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.userId;
    
    // Create leave event
    const leaveData = {
      roomId: roomId.trim(),
      userId,
      timestamp: new Date()
    };
    
    // Emit leave event via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(roomId).emit('userLeft', leaveData);
    }
    
    res.json({
      message: 'Hai lasciato la stanza con successo'
    });
    
  } catch (error) {
    console.error('Leave room error:', error);
    res.status(500).json({ error: 'Errore nell\'uscita dalla stanza' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PRIVATE CHAT (1-to-1)
// ═══════════════════════════════════════════════════════════════════════════════

// Get or create private chat room between two users
router.post('/private/init', async (req, res) => {
  try {
    const { recipientId } = req.body;
    const userId = req.userId;
    
    if (!recipientId) {
      return res.status(400).json({ error: 'ID destinatario obbligatorio' });
    }
    
    // Generate unique room ID (sorted to ensure consistency)
    const roomId = [userId, recipientId].sort().join('_');
    
    // Get recipient info
    const recipient = await User.findById(recipientId, 'name avatar');
    if (!recipient) {
      return res.status(404).json({ error: 'Destinatario non trovato' });
    }
    
    res.json({
      roomId: `private_${roomId}`,
      recipient: {
        id: recipientId,
        name: recipient.name,
        avatar: recipient.avatar
      }
    });
    
  } catch (error) {
    console.error('Init private chat error:', error);
    res.status(500).json({ error: 'Errore nell\'inizializzazione della chat privata' });
  }
});

// Get user's private chat list
router.get('/private/list', async (req, res) => {
  try {
    const userId = req.userId;
    
    // For now return empty list - in production this would query actual conversations
    res.json({
      conversations: []
    });
    
  } catch (error) {
    console.error('Get private chats error:', error);
    res.status(500).json({ error: 'Errore nel caricamento delle chat private' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEAM CHAT
// ═══════════════════════════════════════════════════════════════════════════════

// Get team chat room
router.get('/team/:teamId', async (req, res) => {
  try {
    const { teamId } = req.params;
    const userId = req.userId;
    
    // Verify team membership (in production, check Team model)
    // For now just generate the room ID
    const roomId = `team_${teamId}`;
    
    res.json({
      roomId: roomId,
      teamId: teamId,
      name: `Team Chat`,
      type: 'team'
    });
    
  } catch (error) {
    console.error('Get team chat error:', error);
    res.status(500).json({ error: 'Errore nel caricamento della chat del team' });
  }
});

// Get team chat messages
router.get('/team/:teamId/messages', async (req, res) => {
  try {
    const { teamId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    
    const roomId = `team_${teamId}`;
    
    // Fetch from MongoDB
    const messages = await Message.find({ room: roomId, isDeleted: false })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('sender', 'name avatar');
    
    const total = await Message.countDocuments({ room: roomId, isDeleted: false });
    
    // Format messages
    const formattedMessages = messages.map(msg => ({
      id: msg._id,
      room: msg.room,
      sender: {
        id: msg.sender._id,
        name: msg.sender.name,
        avatar: msg.sender.avatar
      },
      message: msg.content,
      type: msg.type,
      timestamp: msg.createdAt,
      reactions: msg.reactions || []
    })).reverse();
    
    res.json({
      messages: formattedMessages,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('Get team messages error:', error);
    res.status(500).json({ error: 'Errore nel caricamento dei messaggi del team' });
  }
});

// Send message to team chat
router.post('/team/:teamId/send', async (req, res) => {
  try {
    const { teamId } = req.params;
    const { message } = req.body;
    const userId = req.userId;
    
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Messaggio obbligatorio' });
    }
    
    // Get user info
    const user = await User.findById(userId, 'name avatar');
    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }
    
    const roomId = `team_${teamId}`;
    
    // Save to MongoDB
    const newMessage = new Message({
      room: roomId,
      sender: userId,
      content: message.trim(),
      type: 'text',
      createdAt: new Date()
    });
    
    await newMessage.save();
    await newMessage.populate('sender', 'name avatar');
    
    const messageData = {
      id: newMessage._id,
      room: roomId,
      sender: {
        id: userId,
        name: user.name,
        avatar: user.avatar
      },
      message: newMessage.content,
      type: newMessage.type,
      timestamp: newMessage.createdAt,
      reactions: []
    };
    
    // Emit via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(roomId).emit('newMessage', messageData);
    }
    
    res.json({
      message: 'Messaggio inviato al team',
      data: messageData
    });
    
  } catch (error) {
    console.error('Send team message error:', error);
    res.status(500).json({ error: 'Errore nell\'invio del messaggio al team' });
  }
});

module.exports = router;
