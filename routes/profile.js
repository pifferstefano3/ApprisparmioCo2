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

// POST /api/profile/update - Update user profile (explicit route) with findByIdAndUpdate
router.post('/update', uploadSingle('avatar', 'profile'), async (req, res) => {
  try {
    const userId = req.userId;
    const { name, bio, avatarUrl } = req.body;
    
    console.log('[PROFILE] Update request for user:', userId, 'Data:', { name, bio, avatarUrl, hasFile: !!req.file });

    // Build update object
    const updateData = {};
    
    if (name !== undefined && name.trim()) {
      updateData.name = name.trim();
    }
    if (bio !== undefined) {
      updateData.bio = bio.trim();
    }
    // Handle file upload or URL
    if (req.file) {
      updateData.avatar = `/uploads/profile/${req.file.filename}`;
    } else if (avatarUrl && avatarUrl.trim()) {
      updateData.avatar = avatarUrl.trim();
    }
    
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'Nessun dato da aggiornare' });
    }

    // Use atomic findByIdAndUpdate
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) {
      console.error('[PROFILE] User not found:', userId);
      return res.status(404).json({ error: 'Utente non trovato' });
    }
    
    console.log('[PROFILE] Successfully updated user:', userId, 'New avatar:', updatedUser.avatar);

    res.json({
      message: 'Profilo aggiornato con successo ✅',
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        bio: updatedUser.bio,
        avatar: updatedUser.avatar,
        points: updatedUser.points,
        co2Saved: updatedUser.co2Saved,
        honorTitle: updatedUser.honorTitle
      }
    });
  } catch (error) {
    console.error('[PROFILE] Update error:', error);
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
