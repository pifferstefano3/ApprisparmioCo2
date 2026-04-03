const express = require('express');
const router = express.Router();
const Activity = require('../models/Activity');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// Punti base per km per mezzo
const BASE_POINTS_PER_KM = {
  walk: 20,
  bike: 15,
  bus: 8,
  tram: 8,
  carpool: 5,
  car: 0,
};

// POST /api/activities
router.post('/', async (req, res) => {
  try {
    const {
      transport, distanceKm, routeCoords = [],
      weather = 'unknown', durationMinutes = 0,
      aiBonus = 0, notes = '',
    } = req.body;

    if (!transport || !distanceKm) {
      return res.status(400).json({ error: 'Mezzo di trasporto e distanza obbligatori' });
    }

    const validTransports = ['walk', 'bike', 'bus', 'tram', 'carpool', 'car'];
    if (!validTransports.includes(transport)) {
      return res.status(400).json({ error: 'Mezzo di trasporto non valido' });
    }

    const basePoints = Math.round((BASE_POINTS_PER_KM[transport] || 0) * distanceKm);
    const totalPoints = basePoints + Math.max(0, Math.round(aiBonus));

    const activity = new Activity({
      userId: req.userId,
      transport,
      distanceKm: parseFloat(distanceKm),
      routeCoords,
      weather,
      durationMinutes,
      aiBonus: Math.round(aiBonus),
      pointsEarned: totalPoints,
      notes,
    });
    await activity.save();

    // Aggiorna statistiche utente
    const user = await User.findById(req.userId);
    user.points += totalPoints;
    user.co2Saved = parseFloat((user.co2Saved + activity.co2Saved).toFixed(4));

    if (transport !== 'car') {
      user.kmSustainable = parseFloat((user.kmSustainable + distanceKm).toFixed(2));
      user.updateStreak();

      // Controlla trofei
      if (user.streak.current >= 7 && !user.trophies.includes('streak_7')) {
        user.trophies.push('streak_7');
      }
      if (user.kmSustainable >= 100 && !user.trophies.includes('km_100')) {
        user.trophies.push('km_100');
      }
      if (user.co2Saved >= 10 && !user.trophies.includes('co2_10kg')) {
        user.trophies.push('co2_10kg');
      }
    }

    await user.save();

    res.status(201).json({
      activity,
      stats: {
        pointsEarned: totalPoints,
        basePoints,
        aiBonus: activity.aiBonus,
        co2Saved: activity.co2Saved,
        totalPoints: user.points,
        streak: user.streak.current,
        newTrophies: user.trophies,
      },
    });
  } catch (err) {
    console.error('[Activities/POST]', err);
    res.status(500).json({ error: 'Errore nel salvataggio attività' });
  }
});

// GET /api/activities?page=1&limit=10
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const skip = (page - 1) * limit;

    const [activities, total] = await Promise.all([
      Activity.find({ userId: req.userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Activity.countDocuments({ userId: req.userId }),
    ]);

    res.json({
      activities,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('[Activities/GET]', err);
    res.status(500).json({ error: 'Errore nel recupero attività' });
  }
});

module.exports = router;
