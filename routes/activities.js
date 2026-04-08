const express = require('express');
const router = express.Router();
const Activity = require('../models/Activity');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// Stelle base (spendibili) per km per mezzo
const BASE_STARS_PER_KM = {
  walk:       20,
  bike:       15,
  bus:         8,
  tram:        8,
  carpool:     5,
  train:       6,
  car:         1,
  scooter:    10,
  motorbike:   3,
  metro:       7,
};

// POST /api/activities - Log activity
router.post('/', async (req, res) => {
  try {
    const userId = req.userId;
    const { type, title, description, distance, duration, location, metadata } = req.body;

    if (!type || !title) {
      return res.status(400).json({ error: 'Tipo e titolo sono obbligatori' });
    }

    const activity = new Activity({
      user: userId,
      type,
      title: title.trim(),
      description: description ? description.trim() : '',
      distance: distance || 0,
      duration: duration || 0,
      location: location || { type: 'Point', coordinates: [0, 0] },
      metadata: metadata || {}
    });

    // Calculate points and CO2 saved
    activity.calculatePoints();
    activity.calculateCO2Saved();

    await activity.save();

    // Update user stats
    const user = await User.findById(userId);
    if (user) {
      user.points += activity.points;
      user.co2Saved += activity.co2Saved;
      user.updateHonorTitle();
      await user.save();
    }

    res.status(201).json({
      message: 'Attività registrata con successo',
      activity: activity
    });
  } catch (error) {
    console.error('Create activity error:', error);
    res.status(500).json({ error: error.message || 'Errore nella registrazione dell\'attività' });
  }
});

// GET /api/activities - Get user activities
router.get('/', async (req, res) => {
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

// GET /api/activities/stats - Get user stats
router.get('/stats', async (req, res) => {
  try {
    const userId = req.userId;

    const stats = await Activity.getUserStats(userId);

    if (stats.length === 0) {
      return res.json({
        totalPoints: 0,
        totalCO2Saved: 0,
        totalActivities: 0
      });
    }

    res.json(stats[0]);
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Errore nel caricamento delle statistiche' });
  }
});

// GET /api/activities/type/:type - Get activities by type
router.get('/type/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    const activities = await Activity.getActivitiesByType(type, limit);

    res.json({
      activities: activities
    });
  } catch (error) {
    console.error('Get activities by type error:', error);
    res.status(500).json({ error: 'Errore nel caricamento delle attività' });
  }
});

// DELETE /api/activities/:id - Delete activity
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const activity = await Activity.findById(id);

    if (!activity) {
      return res.status(404).json({ error: 'Attività non trovata' });
    }

    // Check if user owns the activity
    if (activity.user.toString() !== userId) {
      return res.status(403).json({ error: 'Non hai permesso di eliminare questa attività' });
    }

    // Remove points from user
    const user = await User.findById(userId);
    if (user) {
      user.points -= activity.points;
      user.co2Saved -= activity.co2Saved;
      user.updateHonorTitle();
      await user.save();
    }

    await Activity.findByIdAndDelete(id);

    res.json({
      message: 'Attività eliminata con successo'
    });
  } catch (error) {
    console.error('Delete activity error:', error);
    res.status(500).json({ error: 'Errore nell\'eliminazione dell\'attività' });
  }
});

module.exports = router;
