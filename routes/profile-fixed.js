const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Activity = require('../models/Activity');
const authMiddleware = require('../middleware/auth');
const { uploadSingle } = require('../middleware/upload');

router.use(authMiddleware);

// Profile update route with image upload
router.post('/update', uploadSingle('avatar', 'profile'), async (req, res) => {
  try {
    const { name, bio, trophies } = req.body;
    const userId = req.userId;
    
    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }
    
    // Update user data
    if (name && name.trim()) {
      user.name = name.trim();
    }
    
    if (bio !== undefined) {
      user.bio = bio.trim();
    }
    
    if (trophies !== undefined) {
      user.trophies = parseInt(trophies) || 0;
    }
    
    // Update avatar if file was uploaded
    if (req.file) {
      user.avatar = `/uploads/avatars/${req.file.filename}`;
    }
    
    await user.save();
    
    // Return updated user data
    res.json({
      message: 'Profilo aggiornato con successo',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        bio: user.bio,
        avatar: user.avatar,
        trophies: user.trophies,
        level: user.level,
        points: user.points
      }
    });
    
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ 
      error: error.message || 'Errore nell\'aggiornamento del profilo' 
    });
  }
});

// Get current user profile
router.get('/me', async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }
    
    res.json({ user });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Errore nel caricamento del profilo' });
  }
});

// Get user activities
router.get('/activities', async (req, res) => {
  try {
    const activities = await Activity.find({ user: req.userId })
      .sort({ createdAt: -1 })
      .limit(20);
    
    res.json({ activities });
  } catch (error) {
    console.error('Get activities error:', error);
    res.status(500).json({ error: 'Errore nel caricamento delle attività' });
  }
});

module.exports = router;
