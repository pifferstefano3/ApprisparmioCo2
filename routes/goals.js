const express = require('express');
const router = express.Router();
const Goal = require('../models/Goal');
const Team = require('../models/Team');
const auth = require('../middleware/auth');

// Create new goal
router.post('/create', auth, async (req, res) => {
  try {
    const { title, description, keyPoints, teamId, priority, category, dueDate, assignees, tags } = req.body;
    
    if (!title || !description || !teamId) {
      return res.status(400).json({ error: 'Titolo, descrizione e team sono obbligatori' });
    }
    
    // Verify user is member of the team
    const team = await Team.findById(teamId);
    if (!team || !team.isMember(req.user._id)) {
      return res.status(403).json({ error: 'Non sei un membro di questo team' });
    }
    
    const goal = new Goal({
      title: title.trim(),
      description: description.trim(),
      keyPoints: keyPoints || [],
      team: teamId,
      creator: req.user._id,
      priority: priority || 'medium',
      category: category || 'environmental',
      dueDate: dueDate ? new Date(dueDate) : null,
      tags: tags || []
    });
    
    // Add assignees if provided
    if (assignees && Array.isArray(assignees)) {
      for (const assigneeId of assignees) {
        // Verify assignee is team member
        if (team.isMember(assigneeId)) {
          goal.assignees.push({
            user: assigneeId,
            assignedAt: new Date()
          });
        }
      }
    }
    
    await goal.save();
    
    // Populate goal data for response
    await goal.populate('creator', 'name avatar');
    await goal.populate('team', 'name');
    await goal.populate('assignees.user', 'name avatar');
    
    res.status(201).json({
      message: 'Obiettivo creato con successo',
      goal: goal
    });
    
  } catch (error) {
    console.error('Create goal error:', error);
    res.status(500).json({ 
      error: error.message || 'Errore nella creazione dell\'obiettivo' 
    });
  }
});

// Get goals for a team (optimized query)
router.get('/team/:teamId', auth, async (req, res) => {
  try {
    const { teamId } = req.params;
    const { status, priority, category, page = 1, limit = 20 } = req.query;
    
    // Build lean query for better performance
    const query = { team: teamId };
    
    if (status !== undefined) {
      query.status = status === 'true';
    }
    
    if (priority) {
      query.priority = priority;
    }
    
    if (category) {
      query.category = category;
    }
    
    const skip = (page - 1) * limit;
    
    // Use lean() for better performance and populate only necessary fields
    const goals = await Goal.find(query)
      .populate('creator', 'name avatar')
      .populate('assignees.user', 'name avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(); // Use lean for better performance
    
    const total = await Goal.countDocuments(query);
    
    res.json({
      goals: goals,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('Get team goals error:', error);
    res.status(500).json({ error: 'Errore nel caricamento degli obiettivi' });
  }
});

// Get user's assigned goals (no team restriction)
router.get('/my', auth, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    const query = { 'assignees.user': req.user._id };
    
    if (status !== undefined) {
      query.status = status === 'true';
    }
    
    const skip = (page - 1) * limit;
    
    // Optimized query with lean()
    const goals = await Goal.find(query)
      .populate('creator', 'name avatar')
      .populate('team', 'name')
      .populate('assignees.user', 'name avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    const total = await Goal.countDocuments(query);
    
    res.json({
      goals: goals,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('Get user goals error:', error);
    res.status(500).json({ error: 'Errore nel caricamento degli obiettivi' });
  }
});

// Get all goals (no team restriction - for global view)
router.get('/all', auth, async (req, res) => {
  try {
    const { status, priority, category, page = 1, limit = 20 } = req.query;
    
    // Build query
    const query = {};
    
    if (status !== undefined) {
      query.status = status === 'true';
    }
    
    if (priority) {
      query.priority = priority;
    }
    
    if (category) {
      query.category = category;
    }
    
    const skip = (page - 1) * limit;
    
    // Optimized query
    const goals = await Goal.find(query)
      .populate('creator', 'name avatar')
      .populate('team', 'name')
      .populate('assignees.user', 'name avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    const total = await Goal.countDocuments(query);
    
    res.json({
      goals: goals,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('Get all goals error:', error);
    res.status(500).json({ error: 'Errore nel caricamento degli obiettivi' });
  }
});

// Toggle goal status (yellow -> gray transition)
router.post('/:id/toggle', auth, async (req, res) => {
  try {
    const goal = await Goal.findById(req.params.id)
      .populate('team');
    
    if (!goal) {
      return res.status(404).json({ error: 'Obiettivo non trovato' });
    }
    
    // Verify user is member of the team
    if (!goal.team.isMember(req.user._id)) {
      return res.status(403).json({ error: 'Non sei un membro di questo team' });
    }
    
    // Toggle status
    await goal.toggleStatus(req.user._id);
    
    // Populate updated data
    await goal.populate('creator', 'name avatar');
    await goal.populate('assignees.user', 'name avatar');
    
    res.json({
      message: `Obiettivo ${goal.status ? 'completato' : 'riattivato'} con successo`,
      goal: goal
    });
    
  } catch (error) {
    console.error('Toggle goal status error:', error);
    res.status(500).json({ error: 'Errore nell\'aggiornamento dello stato' });
  }
});

// Update goal progress
router.put('/:id/progress', auth, async (req, res) => {
  try {
    const { progress } = req.body;
    
    if (progress === undefined || progress < 0 || progress > 100) {
      return res.status(400).json({ error: 'Progresso non valido (deve essere tra 0 e 100)' });
    }
    
    const goal = await Goal.findById(req.params.id)
      .populate('team');
    
    if (!goal) {
      return res.status(404).json({ error: 'Obiettivo non trovato' });
    }
    
    // Verify user is member of the team
    if (!goal.team.isMember(req.user._id)) {
      return res.status(403).json({ error: 'Non sei un membro di questo team' });
    }
    
    await goal.updateProgress(progress, req.user._id);
    
    await goal.populate('creator', 'name avatar');
    await goal.populate('assignees.user', 'name avatar');
    
    res.json({
      message: 'Progresso aggiornato con successo',
      goal: goal
    });
    
  } catch (error) {
    console.error('Update goal progress error:', error);
    res.status(500).json({ error: 'Errore nell\'aggiornamento del progresso' });
  }
});

// Add assignee to goal
router.post('/:id/assign', auth, async (req, res) => {
  try {
    const { userId } = req.body;
    
    const goal = await Goal.findById(req.params.id)
      .populate('team');
    
    if (!goal) {
      return res.status(404).json({ error: 'Obiettivo non trovato' });
    }
    
    // Verify user is member of the team
    if (!goal.team.isMember(req.user._id)) {
      return res.status(403).json({ error: 'Non sei un membro di questo team' });
    }
    
    // Verify assignee is team member
    if (!goal.team.isMember(userId)) {
      return res.status(400).json({ error: 'L\'utente non è un membro del team' });
    }
    
    await goal.addAssignee(userId);
    
    await goal.populate('assignees.user', 'name avatar');
    
    res.json({
      message: 'Assegnazione aggiunta con successo',
      goal: goal
    });
    
  } catch (error) {
    console.error('Add assignee error:', error);
    res.status(500).json({ error: 'Errore nell\'assegnazione' });
  }
});

// Remove assignee from goal
router.post('/:id/unassign', auth, async (req, res) => {
  try {
    const { userId } = req.body;
    
    const goal = await Goal.findById(req.params.id)
      .populate('team');
    
    if (!goal) {
      return res.status(404).json({ error: 'Obiettivo non trovato' });
    }
    
    // Verify user is member of the team
    if (!goal.team.isMember(req.user._id)) {
      return res.status(403).json({ error: 'Non sei un membro di questo team' });
    }
    
    await goal.removeAssignee(userId);
    
    await goal.populate('assignees.user', 'name avatar');
    
    res.json({
      message: 'Assegnazione rimossa con successo',
      goal: goal
    });
    
  } catch (error) {
    console.error('Remove assignee error:', error);
    res.status(500).json({ error: 'Errore nella rimozione dell\'assegnazione' });
  }
});

// Update goal details
router.put('/:id', auth, async (req, res) => {
  try {
    const { title, description, keyPoints, priority, category, dueDate, tags } = req.body;
    
    const goal = await Goal.findById(req.params.id)
      .populate('team');
    
    if (!goal) {
      return res.status(404).json({ error: 'Obiettivo non trovato' });
    }
    
    // Verify user is creator or team leader
    const userRole = goal.team.getUserRole(req.user._id);
    if (goal.creator.toString() !== req.user._id.toString() && !['leader', 'admin'].includes(userRole)) {
      return res.status(403).json({ error: 'Non hai i permessi per modificare questo obiettivo' });
    }
    
    if (title && title.trim()) {
      goal.title = title.trim();
    }
    
    if (description !== undefined) {
      goal.description = description.trim();
    }
    
    if (keyPoints !== undefined) {
      goal.keyPoints = keyPoints;
    }
    
    if (priority) {
      goal.priority = priority;
    }
    
    if (category) {
      goal.category = category;
    }
    
    if (dueDate !== undefined) {
      goal.dueDate = dueDate ? new Date(dueDate) : null;
    }
    
    if (tags !== undefined) {
      goal.tags = tags;
    }
    
    await goal.save();
    
    await goal.populate('creator', 'name avatar');
    await goal.populate('assignees.user', 'name avatar');
    
    res.json({
      message: 'Obiettivo aggiornato con successo',
      goal: goal
    });
    
  } catch (error) {
    console.error('Update goal error:', error);
    res.status(500).json({ error: 'Errore nell\'aggiornamento dell\'obiettivo' });
  }
});

// Delete goal
router.delete('/:id', auth, async (req, res) => {
  try {
    const goal = await Goal.findById(req.params.id)
      .populate('team');
    
    if (!goal) {
      return res.status(404).json({ error: 'Obiettivo non trovato' });
    }
    
    // Verify user is creator or team leader
    const userRole = goal.team.getUserRole(req.user._id);
    if (goal.creator.toString() !== req.user._id.toString() && !['leader', 'admin'].includes(userRole)) {
      return res.status(403).json({ error: 'Non hai i permessi per eliminare questo obiettivo' });
    }
    
    await Goal.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Obiettivo eliminato con successo' });
    
  } catch (error) {
    console.error('Delete goal error:', error);
    res.status(500).json({ error: 'Errore nell\'eliminazione dell\'obiettivo' });
  }
});

module.exports = router;
