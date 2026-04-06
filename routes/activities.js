const express = require('express');
const router = express.Router();
const Activity = require('../models/Activity');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// Stelle base (spendibili) per km per mezzo
const BASE_STARS_PER_KM = {
  walk:       20,
  bike:       15,
  bus:         8,
  tram:        8,
  carpool:     5,
  carpool_ai:  7,   // AI-managed carpooling vale un po' di più
  car:         0,
  airplane:    0,   // aereo non genera stelle
};

const VALID_TRANSPORTS = ['walk','bike','bus','tram','carpool','carpool_ai','car','airplane'];

// POST /api/activities
router.post('/', async (req, res) => {
  try {
    const {
      transport, distanceKm, routeCoords = [],
      weather = 'unknown', durationMinutes = 0,
      aiBonus = 0, notes = '', passengers = 1,
    } = req.body;

    if (!transport || !distanceKm) {
      return res.status(400).json({ error: 'Mezzo di trasporto e distanza obbligatori' });
    }
    if (!VALID_TRANSPORTS.includes(transport)) {
      return res.status(400).json({ error: 'Mezzo di trasporto non valido' });
    }

    const baseStars  = Math.round((BASE_STARS_PER_KM[transport] || 0) * distanceKm);
    const totalStars = baseStars + Math.max(0, Math.round(aiBonus));

    const activity = new Activity({
      userId: req.userId,
      transport,
      distanceKm: parseFloat(distanceKm),
      passengers: Math.max(1, parseInt(passengers) || 1),
      routeCoords,
      weather,
      durationMinutes,
      aiBonus: Math.round(aiBonus),
      pointsEarned: totalStars,
      notes,
    });
    await activity.save(); // pre-save calcola co2Saved e co2Points

    // ─── Aggiorna statistiche utente ─────────────────────────────────────────
    const user = await User.findById(req.userId);

    // Stelle (spendibili) — non scendono mai sotto 0
    user.stars  = Math.max(0, (user.stars  || 0) + totalStars);
    user.points = user.stars;

    // co2Points (non spendibili, per classifica) → solo per mezzi green
    if (activity.co2Points > 0) {
      user.co2Points = parseFloat(((user.co2Points || 0) + activity.co2Points).toFixed(4));
    }

    // co2Saved (valore assoluto, può essere negativo per aereo)
    user.co2Saved = parseFloat(((user.co2Saved || 0) + activity.co2Saved).toFixed(4));

    // km sostenibili (solo mezzi non-auto, non-aereo)
    const greenTransports = ['walk','bike','bus','tram','carpool','carpool_ai'];
    if (greenTransports.includes(transport)) {
      user.kmSustainable = parseFloat(((user.kmSustainable || 0) + parseFloat(distanceKm)).toFixed(2));
      user.updateStreak();

      // Trofei automatici
      if (user.streak.current >= 7  && !user.trophies.includes('streak_7'))  user.trophies.push('streak_7');
      if (user.kmSustainable >= 100 && !user.trophies.includes('km_100'))    user.trophies.push('km_100');
      if (user.co2Saved >= 10       && !user.trophies.includes('co2_10kg'))  user.trophies.push('co2_10kg');
    }

    await user.save();

    res.status(201).json({
      activity,
      stats: {
        starsEarned:  totalStars,
        baseStars,
        aiBonus:      activity.aiBonus,
        co2Saved:     activity.co2Saved,
        co2Points:    activity.co2Points,
        totalStars:   user.stars,
        co2PointsTotal: user.co2Points,
        streak:       user.streak.current,
        trophies:     user.trophies,
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
    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const skip  = (page - 1) * limit;

    const [activities, total] = await Promise.all([
      Activity.find({ userId: req.userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Activity.countDocuments({ userId: req.userId }),
    ]);

    res.json({ activities, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error('[Activities/GET]', err);
    res.status(500).json({ error: 'Errore nel recupero attività' });
  }
});

module.exports = router;
