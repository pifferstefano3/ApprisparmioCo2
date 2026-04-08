const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// Get chat messages for a room
router.get('/messages/:room', async (req, res) => {
  try {
    const { room } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    
    // For now, return empty array - in production this would fetch from database
    res.json({
      messages: [],
      pagination: {
        page,
        limit,
        total: 0,
        pages: 0
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
    
    // Create message object
    const messageData = {
      id: Date.now().toString(),
      room: room.trim(),
      sender: {
        id: userId,
        name: user.name,
        avatar: user.avatar
      },
      message: message.trim(),
      type,
      timestamp: new Date(),
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

module.exports = router;
