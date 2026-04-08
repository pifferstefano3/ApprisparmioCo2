const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/challenges - Get all challenges
router.get('/', async (req, res) => {
  try {
    // For now, return default challenges
    const challenges = [
      {
        id: '1',
        title: 'No Auto Day',
        description: 'Non usare l\'auto per un giorno intero',
        points: 50,
        type: 'transport',
        difficulty: 'easy'
      },
      {
        id: '2',
        title: 'Vegetarian Week',
        description: 'Mangia solo vegetariano per una settimana',
        points: 100,
        type: 'food',
        difficulty: 'medium'
      },
      {
        id: '3',
        title: 'Zero Waste Day',
        description: 'Non produrre rifiuti per un giorno',
        points: 75,
        type: 'waste',
        difficulty: 'hard'
      },
      {
        id: '4',
        title: 'Bike to Work',
        description: 'Vai al lavoro in bici per 5 giorni',
        points: 150,
        type: 'transport',
        difficulty: 'medium'
      },
      {
        id: '5',
        title: 'Energy Saver',
        description: 'Riduci il consumo energetico del 20% per una settimana',
        points: 100,
        type: 'energy',
        difficulty: 'medium'
      }
    ];

    res.json({
      challenges: challenges
    });
  } catch (error) {
    console.error('Get challenges error:', error);
    res.status(500).json({ error: 'Errore nel caricamento delle sfide' });
  }
});

// POST /api/challenges/:id/complete - Complete a challenge
router.post('/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    // For now, just return success
    res.json({
      message: 'Sfida completata con successo',
      challengeId: id,
      userId: userId
    });
  } catch (error) {
    console.error('Complete challenge error:', error);
    res.status(500).json({ error: 'Errore nel completamento della sfida' });
  }
});

// GET /api/challenges/user - Get user's completed challenges
router.get('/user', async (req, res) => {
  try {
    const userId = req.userId;

    // For now, return empty array
    res.json({
      completedChallenges: []
    });
  } catch (error) {
    console.error('Get user challenges error:', error);
    res.status(500).json({ error: 'Errore nel caricamento delle sfide utente' });
  }
});

module.exports = router;
