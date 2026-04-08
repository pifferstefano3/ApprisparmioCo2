const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Activity = require('../models/Activity');
const { authMiddleware } = require('../middleware/auth');
const { uploadSingle } = require('../middleware/upload');

router.use(authMiddleware);

// GET /api/profile - Get user profile
router.get('/', async (req, res) => {
  try {
    const userId = req.userId;

    const user = await User.findById(userId).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    res.json({
      user: user
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Errore nel caricamento del profilo' });
  }
});

// POST /api/profile/update - Update user profile (explicit route)
router.post('/update', uploadSingle('avatar', 'profile'), async (req, res) => {
  try {
    const userId = req.userId;
    const { name, bio, avatarUrl } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    // Update user fields with validation
    if (name !== undefined && name.trim()) {
      user.name = name.trim();
    }
    if (bio !== undefined) {
      user.bio = bio.trim();
    }
    // Handle file upload or URL
    if (req.file) {
      user.avatar = `/uploads/profile/${req.file.filename}`;
    } else if (avatarUrl && avatarUrl.trim()) {
      user.avatar = avatarUrl.trim();
    }

    // Mark as modified and save
    user.markModified('name');
    user.markModified('bio');
    user.markModified('avatar');
    
    const savedUser = await user.save();
    console.log('Profile updated for user:', userId, 'New avatar:', savedUser.avatar);

    res.json({
      message: 'Profilo aggiornato con successo',
      user: {
        id: savedUser._id,
        name: savedUser.name,
        bio: savedUser.bio,
        avatar: savedUser.avatar,
        points: savedUser.points,
        co2Saved: savedUser.co2Saved,
        honorTitle: savedUser.honorTitle
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Errore nell\'aggiornamento del profilo: ' + error.message });
  }
});

// PUT /api/profile - Update user profile (legacy support)
router.put('/', uploadSingle('avatar', 'profile'), async (req, res) => {
  try {
    const userId = req.userId;
    const { name, bio } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    // Update user fields
    if (name !== undefined) user.name = name.trim();
    if (bio !== undefined) user.bio = bio.trim();
    if (req.file) {
      user.avatar = `/uploads/profile/${req.file.filename}`;
    }

    await user.save();

    res.json({
      message: 'Profilo aggiornato con successo',
      user: user
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Errore nell\'aggiornamento del profilo' });
  }
});

// GET /api/profile/activities - Get user activities
router.get('/activities', async (req, res) => {
  try {
    const userId = req.userId;
    const limit = parseInt(req.query.limit) || 50;

    const activities = await Activity.getUserActivities(userId, limit);

    res.json({
      activities: activities
    });
  } catch (error) {
    console.error('Get activities error:', error);
    res.status(500).json({ error: 'Errore nel caricamento delle attività' });
  }
});

// GET /api/profile/stats - Get user statistics
router.get('/stats', async (req, res) => {
  try {
    const userId = req.userId;

    const user = await User.findById(userId).select('-password');
    const activities = await Activity.getUserActivities(userId, 100);

    const stats = {
      points: user.points,
      co2Saved: user.co2Saved,
      honorTitle: user.honorTitle,
      trophies: user.trophies,
      streak: user.streak,
      totalActivities: activities.length,
      activitiesByType: {}
    };

    // Count activities by type
    activities.forEach(activity => {
      stats.activitiesByType[activity.type] = (stats.activitiesByType[activity.type] || 0) + 1;
    });

    res.json({
      stats: stats
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Errore nel caricamento delle statistiche' });
  }
});

module.exports = router;
