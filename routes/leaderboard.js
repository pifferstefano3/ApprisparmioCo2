const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/leaderboard - Get leaderboard
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const type = req.query.type || 'points'; // points, co2Saved, activities

    let sortField = 'points';
    if (type === 'co2Saved') sortField = 'co2Saved';
    if (type === 'activities') sortField = 'createdAt';

    const users = await User.find({})
      .sort({ [sortField]: -1 })
      .limit(limit)
      .select('name avatar points co2Saved honorTitle trophies');

    // Add rankings
    const leaderboard = users.map((user, index) => ({
      rank: index + 1,
      name: user.name,
      avatar: user.avatar,
      points: user.points,
      co2Saved: user.co2Saved,
      honorTitle: user.honorTitle,
      trophies: user.trophies
    }));

    res.json({
      leaderboard: leaderboard,
      type: type
    });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ error: 'Errore nel caricamento della classifica' });
  }
});

// GET /api/leaderboard/user - Get user's ranking
router.get('/user', async (req, res) => {
  try {
    const userId = req.userId;

    const user = await User.findById(userId).select('name avatar points co2Saved honorTitle trophies');
    
    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    // Get user's ranking (all users)
    const rank = await User.countDocuments({ 
      points: { $gt: user.points } 
    }) + 1;

    res.json({
      user: {
        rank: rank,
        name: user.name,
        avatar: user.avatar,
        points: user.points,
        co2Saved: user.co2Saved,
        honorTitle: user.honorTitle,
        trophies: user.trophies
      }
    });
  } catch (error) {
    console.error('Get user ranking error:', error);
    res.status(500).json({ error: 'Errore nel caricamento della classifica utente' });
  }
});

module.exports = router;
