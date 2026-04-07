const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const Team = require('../models/Team');
const auth = require('../middleware/auth');

// Get messages for a room
router.get('/room/:roomId', auth, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { page = 1, limit = 50, before } = req.query;
    
    // Validate room access
    const roomType = getRoomType(roomId);
    if (!await canAccessRoom(req.user._id, roomId, roomType)) {
      return res.status(403).json({ error: 'Non hai accesso a questa room' });
    }
    
    // Build query
    const query = { 
      room: roomId, 
      isDeleted: false 
    };
    
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }
    
    const skip = (page - 1) * limit;
    
    const messages = await Message.find(query)
      .populate('sender', 'name avatar')
      .populate('replyTo', 'content sender')
      .populate('reactions.user', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Mark messages as read
    const messageIds = messages.map(msg => msg._id);
    await Message.updateMany(
      { _id: { $in: messageIds }, 'readBy.user': { $ne: req.user._id } },
      { $push: { readBy: { user: req.user._id, readAt: new Date() } } }
    );
    
    res.json({
      messages: messages.reverse(), // Return in chronological order
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: messages.length === parseInt(limit)
      }
    });
    
  } catch (error) {
    console.error('Get room messages error:', error);
    res.status(500).json({ error: 'Errore nel caricamento dei messaggi' });
  }
});

// Send message
router.post('/send', auth, async (req, res) => {
  try {
    const { content, type = 'text', room, replyTo } = req.body;
    
    if (!room) {
      return res.status(400).json({ error: 'Room è obbligatoria' });
    }
    
    if (type === 'text' && (!content || content.trim().length === 0)) {
      return res.status(400).json({ error: 'Il contenuto è obbligatorio per i messaggi di testo' });
    }
    
    // Validate room access
    const roomType = getRoomType(room);
    if (!await canAccessRoom(req.user._id, room, roomType)) {
      return res.status(403).json({ error: 'Non hai accesso a questa room' });
    }
    
    const message = new Message({
      content: type === 'text' ? content.trim() : '',
      type: type,
      sender: req.user._id,
      room: room,
      roomType: roomType,
      replyTo: replyTo || null
    });
    
    await message.save();
    
    // Populate message for response
    await message.populate('sender', 'name avatar');
    if (replyTo) {
      await message.populate('replyTo', 'content sender');
    }
    
    // Emit to Socket.io (this would be handled by the socket server)
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

// Edit message
router.put('/:id/edit', auth, async (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Il contenuto è obbligatorio' });
    }
    
    const message = await Message.findById(req.params.id);
    
    if (!message) {
      return res.status(404).json({ error: 'Messaggio non trovato' });
    }
    
    // Check if user is the sender
    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Puoi modificare solo i tuoi messaggi' });
    }
    
    // Check if message is too old (24 hours)
    const messageAge = Date.now() - message.createdAt.getTime();
    if (messageAge > 24 * 60 * 60 * 1000) {
      return res.status(400).json({ error: 'I messaggi più vecchi di 24 ore non possono essere modificati' });
    }
    
    await message.editContent(content.trim());
    
    await message.populate('sender', 'name avatar');
    
    // Emit to Socket.io
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
router.delete('/:id', auth, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    
    if (!message) {
      return res.status(404).json({ error: 'Messaggio non trovato' });
    }
    
    // Check if user is the sender or has admin privileges
    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Puoi eliminare solo i tuoi messaggi' });
    }
    
    await message.softDelete();
    
    // Emit to Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(message.room).emit('messageDeleted', { messageId: message._id });
    }
    
    res.json({ message: 'Messaggio eliminato con successo' });
    
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Errore nell\'eliminazione del messaggio' });
  }
});

// Add reaction
router.post('/:id/react', auth, async (req, res) => {
  try {
    const { emoji } = req.body;
    
    if (!emoji || emoji.length > 2) {
      return res.status(400).json({ error: 'Emoji non valida' });
    }
    
    const message = await Message.findById(req.params.id);
    
    if (!message) {
      return res.status(404).json({ error: 'Messaggio non trovato' });
    }
    
    // Validate room access
    if (!await canAccessRoom(req.user._id, message.room, message.roomType)) {
      return res.status(403).json({ error: 'Non hai accesso a questa room' });
    }
    
    await message.addReaction(req.user._id, emoji);
    
    await message.populate('reactions.user', 'name');
    
    // Emit to Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(message.room).emit('reactionAdded', {
        messageId: message._id,
        reactions: message.reactions
      });
    }
    
    res.json({
      message: 'Reazione aggiunta con successo',
      reactions: message.reactions
    });
    
  } catch (error) {
    console.error('Add reaction error:', error);
    res.status(500).json({ error: 'Errore nell\'aggiunta della reazione' });
  }
});

// Remove reaction
router.post('/:id/unreact', auth, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    
    if (!message) {
      return res.status(404).json({ error: 'Messaggio non trovato' });
    }
    
    // Validate room access
    if (!await canAccessRoom(req.user._id, message.room, message.roomType)) {
      return res.status(403).json({ error: 'Non hai accesso a questa room' });
    }
    
    await message.removeReaction(req.user._id);
    
    // Emit to Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(message.room).emit('reactionRemoved', {
        messageId: message._id,
        reactions: message.reactions
      });
    }
    
    res.json({
      message: 'Reazione rimossa con successo',
      reactions: message.reactions
    });
    
  } catch (error) {
    console.error('Remove reaction error:', error);
    res.status(500).json({ error: 'Errore nella rimozione della reazione' });
  }
});

// Get user's chat rooms
router.get('/rooms', auth, async (req, res) => {
  try {
    const rooms = [];
    
    // Global room (always accessible)
    rooms.push({
      id: 'global',
      name: 'Chat Globale',
      type: 'global',
      unreadCount: await getUnreadCount(req.user._id, 'global')
    });
    
    // Team rooms
    const userTeams = await Team.find({ 
      'members.user': req.user._id,
      isActive: true 
    }).select('name _id');
    
    for (const team of userTeams) {
      const roomId = `team-${team._id}`;
      rooms.push({
        id: roomId,
        name: `Team: ${team.name}`,
        type: 'team',
        teamId: team._id,
        unreadCount: await getUnreadCount(req.user._id, roomId)
      });
    }
    
    // Private rooms (would need additional logic for user-to-user chats)
    // This is a placeholder for private chat functionality
    
    res.json({ rooms: rooms });
    
  } catch (error) {
    console.error('Get user rooms error:', error);
    res.status(500).json({ error: 'Errore nel caricamento delle room' });
  }
});

// Helper functions
function getRoomType(roomId) {
  if (roomId === 'global') return 'global';
  if (roomId.startsWith('team-')) return 'team';
  if (roomId.startsWith('private-')) return 'private';
  return null;
}

async function canAccessRoom(userId, roomId, roomType) {
  switch (roomType) {
    case 'global':
      return true; // Everyone can access global chat
    
    case 'team':
      const teamId = roomId.replace('team-', '');
      const team = await Team.findById(teamId);
      return team && team.isMember(userId);
    
    case 'private':
      // For private chats, check if user is part of the chat
      // This would need additional implementation
      return true; // Placeholder
    
    default:
      return false;
  }
}

async function getUnreadCount(userId, roomId) {
  try {
    const count = await Message.countDocuments({
      room: roomId,
      isDeleted: false,
      sender: { $ne: userId },
      'readBy.user': { $ne: userId }
    });
    
    return count;
  } catch (error) {
    return 0;
  }
}

module.exports = router;
