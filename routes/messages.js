const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const Team = require('../models/Team');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// Get messages for a room
router.get('/room/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    
    const messages = await Message.getRoomMessages(roomId, limit, skip);
    
    res.json({
      messages: messages,
      pagination: {
        page,
        limit,
        total: messages.length,
        pages: Math.ceil(messages.length / limit)
      }
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Errore nel caricamento dei messaggi' });
  }
});

// Send a message
router.post('/send', async (req, res) => {
  try {
    const { room, content, type = 'text', mediaUrl } = req.body;
    const userId = req.userId;
    
    if (!room || !content) {
      return res.status(400).json({ error: 'Stanza e contenuto sono obbligatori' });
    }
    
    const message = new Message({
      room: room.trim(),
      sender: userId,
      content: content.trim(),
      type,
      mediaUrl: mediaUrl || null
    });
    
    await message.save();
    
    // Emit message via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(room).emit('newMessage', message);
    }
    
    res.status(201).json({
      message: 'Messaggio inviato con successo',
      data: message
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Errore nell\'invio del messaggio' });
  }
});

// Add reaction to message
router.post('/:messageId/react', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.userId;
    
    if (!emoji) {
      return res.status(400).json({ error: 'L\'emoji è obbligatoria' });
    }
    
    const message = await Message.findById(messageId);
    
    if (!message) {
      return res.status(404).json({ error: 'Messaggio non trovato' });
    }
    
    message.addReaction(userId, emoji);
    await message.save();
    
    // Emit reaction via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(message.room).emit('newReaction', {
        messageId,
        userId,
        emoji
      });
    }
    
    res.json({
      message: 'Reazione aggiunta con successo'
    });
  } catch (error) {
    console.error('Add reaction error:', error);
    res.status(500).json({ error: 'Errore nell\'aggiunta della reazione' });
  }
});

// Edit message
router.put('/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;
    const userId = req.userId;
    
    if (!content) {
      return res.status(400).json({ error: 'Il contenuto è obbligatorio' });
    }
    
    const message = await Message.findById(messageId);
    
    if (!message) {
      return res.status(404).json({ error: 'Messaggio non trovato' });
    }
    
    // Check if user is the sender
    if (message.sender.toString() !== userId) {
      return res.status(403).json({ error: 'Solo il mittente può modificare il messaggio' });
    }
    
    message.edit(content.trim());
    await message.save();
    
    // Emit edit event via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(message.room).emit('messageEdited', message);
    }
    
    res.json({
      message: 'Messaggio modificato con successo',
      data: message
    });
  } catch (error) {
    console.error('Edit message error:', error);
    res.status(500).json({ error: 'Errore nella modifica del messaggio' });
  }
});

// Delete message
router.delete('/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.userId;
    
    const message = await Message.findById(messageId);
    
    if (!message) {
      return res.status(404).json({ error: 'Messaggio non trovato' });
    }
    
    // Check if user is the sender
    if (message.sender.toString() !== userId) {
      return res.status(403).json({ error: 'Solo il mittente può eliminare il messaggio' });
    }
    
    message.delete(userId);
    await message.save();
    
    // Emit delete event via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(message.room).emit('messageDeleted', { messageId });
    }
    
    res.json({
      message: 'Messaggio eliminato con successo'
    });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Errore nell\'eliminazione del messaggio' });
  }
});

// Get user messages
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    
    const messages = await Message.getUserMessages(userId, limit);
    
    res.json({
      messages: messages
    });
  } catch (error) {
    console.error('Get user messages error:', error);
    res.status(500).json({ error: 'Errore nel caricamento dei messaggi' });
  }
});

// Search messages
router.get('/search/:room', async (req, res) => {
  try {
    const { room } = req.params;
    const { query } = req.query;
    const limit = parseInt(req.query.limit) || 50;
    
    if (!query) {
      return res.status(400).json({ error: 'Query di ricerca obbligatoria' });
    }
    
    const messages = await Message.searchMessages(room, query, limit);
    
    res.json({
      messages: messages
    });
  } catch (error) {
    console.error('Search messages error:', error);
    res.status(500).json({ error: 'Errore nella ricerca dei messaggi' });
  }
});

module.exports = router;
