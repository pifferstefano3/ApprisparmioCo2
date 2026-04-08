const express = require('express');
const router = express.Router();
const Goal = require('../models/Goal');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// POST /api/goals - Create a new goal
router.post('/', async (req, res) => {
  try {
    const userId = req.userId;
    const { title, description, type, target, unit, category, deadline } = req.body;

    if (!title || !type || !target) {
      return res.status(400).json({ error: 'Titolo, tipo e obiettivo sono obbligatori' });
    }

    const goal = new Goal({
      user: userId,
      title: title.trim(),
      description: description ? description.trim() : '',
      type,
      target,
      unit: unit || 'times',
      category: category || 'general',
      deadline: deadline ? new Date(deadline) : null
    });

    await goal.save();

    res.status(201).json({
      message: 'Obiettivo creato con successo',
      goal: goal
    });
  } catch (error) {
    console.error('Create goal error:', error);
    res.status(500).json({ error: error.message || 'Errore nella creazione dell\'obiettivo' });
  }
});

// GET /api/goals - Get user's goals
router.get('/', async (req, res) => {
  try {
    const userId = req.userId;
    const includeCompleted = req.query.completed === 'true';

    const goals = await Goal.getUserGoals(userId, includeCompleted);

    res.json({
      goals: goals
    });
  } catch (error) {
    console.error('Get goals error:', error);
    res.status(500).json({ error: 'Errore nel caricamento degli obiettivi' });
  }
});

// GET /api/goals/active - Get active goals
router.get('/active', async (req, res) => {
  try {
    const userId = req.userId;

    const goals = await Goal.getActiveGoals(userId);

    res.json({
      goals: goals
    });
  } catch (error) {
    console.error('Get active goals error:', error);
    res.status(500).json({ error: 'Errore nel caricamento degli obiettivi attivi' });
  }
});

// GET /api/goals/completed - Get completed goals
router.get('/completed', async (req, res) => {
  try {
    const userId = req.userId;

    const goals = await Goal.getCompletedGoals(userId);

    res.json({
      goals: goals
    });
  } catch (error) {
    console.error('Get completed goals error:', error);
    res.status(500).json({ error: 'Errore nel caricamento degli obiettivi completati' });
  }
});

// PUT /api/goals/:id - Update goal progress
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;
    const userId = req.userId;

    const goal = await Goal.findById(id);

    if (!goal) {
      return res.status(404).json({ error: 'Obiettivo non trovato' });
    }

    // Check if user owns the goal
    if (goal.user.toString() !== userId) {
      return res.status(403).json({ error: 'Non hai permesso di modificare questo obiettivo' });
    }

    if (amount !== undefined) {
      goal.updateProgress(amount);
    }

    await goal.save();

    // Award points if goal is completed
    if (goal.isCompleted && !goal.completedAt) {
      const User = require('../models/User');
      const user = await User.findById(userId);
      if (user) {
        user.points += goal.points;
        user.updateHonorTitle();
        await user.save();
      }
    }

    res.json({
      message: 'Progresso aggiornato con successo',
      goal: goal,
      progress: goal.getProgressPercentage()
    });
  } catch (error) {
    console.error('Update goal error:', error);
    res.status(500).json({ error: 'Errore nell\'aggiornamento dell\'obiettivo' });
  }
});

// DELETE /api/goals/:id - Delete goal
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const goal = await Goal.findById(id);

    if (!goal) {
      return res.status(404).json({ error: 'Obiettivo non trovato' });
    }

    // Check if user owns the goal
    if (goal.user.toString() !== userId) {
      return res.status(403).json({ error: 'Non hai permesso di eliminare questo obiettivo' });
    }

    await Goal.findByIdAndDelete(id);

    res.json({
      message: 'Obiettivo eliminato con successo'
    });
  } catch (error) {
    console.error('Delete goal error:', error);
    res.status(500).json({ error: 'Errore nell\'eliminazione dell\'obiettivo' });
  }
});

// POST /api/goals/:id/reset - Reset goal progress
router.post('/:id/reset', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const goal = await Goal.findById(id);

    if (!goal) {
      return res.status(404).json({ error: 'Obiettivo non trovato' });
    }

    // Check if user owns the goal
    if (goal.user.toString() !== userId) {
      return res.status(403).json({ error: 'Non hai permesso di resettare questo obiettivo' });
    }

    goal.reset();
    await goal.save();

    res.json({
      message: 'Obiettivo resettato con successo',
      goal: goal
    });
  } catch (error) {
    console.error('Reset goal error:', error);
    res.status(500).json({ error: 'Errore nel reset dell\'obiettivo' });
  }
});

module.exports = router;
