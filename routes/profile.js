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
    
    // Update avatar if uploaded
    if (req.file) {
      user.avatar = `/uploads/profile/${req.file.filename}`;
    }
    
    // Save user
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
        points: user.points,
        co2Saved: user.co2Saved || 0
      }
    });
    
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ 
      error: 'Errore nell\'aggiornamento del profilo' 
    });
  }
});

// Get current user profile
router.get('/me', async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }
    
    res.json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        bio: user.bio,
        avatar: user.avatar,
        trophies: user.trophies,
        points: user.points,
        co2Saved: user.co2Saved || 0
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Errore nel caricamento del profilo' });
  }
});

// Get user activities
router.get('/activities', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const activities = await Activity.find({ user: req.userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    
    const total = await Activity.countDocuments({ user: req.userId });
    
    res.json({
      activities,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get activities error:', error);
    res.status(500).json({ error: 'Errore nel caricamento delle attività' });
  }
});

module.exports = router;
