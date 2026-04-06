const express = require('express');
const router = express.Router();
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/leaderboard?limit=50
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(100, parseInt(req.query.limit) || 50);

    const users = await User.find()
      .select('username co2Points co2Saved kmSustainable avatarSkin honorTitle profilePic streak')
      .sort({ co2Points: -1 })
      .limit(limit)
      .lean();

    const ranked = users.map((u, i) => ({
      rank: i + 1,
      username: u.username,
      co2Points: parseFloat((u.co2Points || 0).toFixed(2)),
      co2SavedKg: parseFloat((u.co2Saved || 0).toFixed(2)),
      kmSustainable: parseFloat((u.kmSustainable || 0).toFixed(1)),
      avatarSkin: u.avatarSkin || 'default',
      honorTitle: u.honorTitle || '',
      profilePic: u.profilePic || '',
      streak: u.streak?.current || 0,
    }));

    // Trova la posizione dell'utente corrente
    const myRank = ranked.findIndex(u => u.username);
    const me = await User.findById(req.userId).select('co2Points username').lean();
    const myPosition = ranked.findIndex(u => u.username === me?.username);

    res.json({ leaderboard: ranked, myPosition: myPosition + 1, total: ranked.length });
  } catch (err) {
    console.error('[Leaderboard/GET]', err);
    res.status(500).json({ error: 'Errore classifica' });
  }
});

module.exports = router;
