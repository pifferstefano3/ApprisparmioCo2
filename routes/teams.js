const express = require('express');
const router = express.Router();
const Team = require('../models/Team');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Create a new team
router.post('/create', auth, async (req, res) => {
  try {
    const { name, description, maxMembers } = req.body;
    
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Il nome del team è obbligatorio' });
    }
    
    // Generate unique team code
    const code = await Team.generateUniqueCode();
    
    const team = new Team({
      name: name.trim(),
      description: description || '',
      creator: req.user._id,
      code: code,
      maxMembers: maxMembers || 20
    });
    
    // Add creator as team leader
    team.members.push({
      user: req.user._id,
      role: 'leader',
      joinedAt: new Date()
    });
    
    await team.save();
    
    // Populate team data for response
    await team.populate('creator', 'name avatar');
    await team.populate('members.user', 'name avatar');
    
    res.status(201).json({
      message: 'Team creato con successo',
      team: team
    });
    
  } catch (error) {
    console.error('Create team error:', error);
    res.status(500).json({ 
      error: error.message || 'Errore nella creazione del team' 
    });
  }
});

// Join team by code
router.post('/join', auth, async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code || code.length !== 8) {
      return res.status(400).json({ error: 'Codice team non valido' });
    }
    
    const team = await Team.findOne({ 
      code: code.toUpperCase(),
      isActive: true 
    }).populate('creator', 'name avatar');
    
    if (!team) {
      return res.status(404).json({ error: 'Team non trovato' });
    }
    
    // Check if user is already a member
    if (team.isMember(req.user._id)) {
      return res.status(400).json({ error: 'Sei già un membro di questo team' });
    }
    
    // Check if team is full
    if (team.members.length >= team.maxMembers) {
      return res.status(400).json({ error: 'Il team ha raggiunto il numero massimo di membri' });
    }
    
    // Add user to team
    await team.addMember(req.user._id, 'member');
    
    // Populate updated team data
    await team.populate('members.user', 'name avatar');
    
    res.json({
      message: 'Ti sei unito al team con successo',
      team: team
    });
    
  } catch (error) {
    console.error('Join team error:', error);
    res.status(500).json({ 
      error: error.message || 'Errore nell\'unione al team' 
    });
  }
});

// Get user's teams
router.get('/my', auth, async (req, res) => {
  try {
    const teams = await Team.find({
      'members.user': req.user._id,
      isActive: true
    })
    .populate('creator', 'name avatar')
    .populate('members.user', 'name avatar')
    .sort({ lastActivity: -1 });
    
    res.json({ teams: teams });
    
  } catch (error) {
    console.error('Get user teams error:', error);
    res.status(500).json({ error: 'Errore nel caricamento dei team' });
  }
});

// Get team details
router.get('/:id', auth, async (req, res) => {
  try {
    const team = await Team.findById(req.params.id)
      .populate('creator', 'name avatar')
      .populate('members.user', 'name avatar');
    
    if (!team) {
      return res.status(404).json({ error: 'Team non trovato' });
    }
    
    // Check if user is member
    if (!team.isMember(req.user._id)) {
      return res.status(403).json({ error: 'Non sei un membro di questo team' });
    }
    
    res.json({ team: team });
    
  } catch (error) {
    console.error('Get team details error:', error);
    res.status(500).json({ error: 'Errore nel caricamento del team' });
  }
});

// Leave team
router.post('/:id/leave', auth, async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    
    if (!team) {
      return res.status(404).json({ error: 'Team non trovato' });
    }
    
    // Check if user is member
    if (!team.isMember(req.user._id)) {
      return res.status(403).json({ error: 'Non sei un membro di questo team' });
    }
    
    // Prevent creator from leaving (they must transfer ownership first)
    if (team.creator.toString() === req.user._id.toString()) {
      return res.status(400).json({ error: 'Il creatore non può lasciare il team' });
    }
    
    await team.removeMember(req.user._id);
    
    res.json({ message: 'Hai lasciato il team con successo' });
    
  } catch (error) {
    console.error('Leave team error:', error);
    res.status(500).json({ error: 'Errore nell\'abbandono del team' });
  }
});

// Remove member (leader/admin only)
router.post('/:id/remove-member', auth, async (req, res) => {
  try {
    const { userId } = req.body;
    const team = await Team.findById(req.params.id);
    
    if (!team) {
      return res.status(404).json({ error: 'Team non trovato' });
    }
    
    // Check permissions
    const userRole = team.getUserRole(req.user._id);
    if (!['leader', 'admin'].includes(userRole)) {
      return res.status(403).json({ error: 'Non hai i permessi per rimuovere membri' });
    }
    
    // Cannot remove creator
    if (team.creator.toString() === userId) {
      return res.status(400).json({ error: 'Non puoi rimuovere il creatore del team' });
    }
    
    await team.removeMember(userId);
    
    res.json({ message: 'Membro rimosso con successo' });
    
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ error: 'Errore nella rimozione del membro' });
  }
});

// Update team info
router.put('/:id', auth, async (req, res) => {
  try {
    const { name, description, maxMembers } = req.body;
    const team = await Team.findById(req.params.id);
    
    if (!team) {
      return res.status(404).json({ error: 'Team non trovato' });
    }
    
    // Check permissions (only leader or admin can update)
    const userRole = team.getUserRole(req.user._id);
    if (!['leader', 'admin'].includes(userRole)) {
      return res.status(403).json({ error: 'Non hai i permessi per aggiornare il team' });
    }
    
    if (name && name.trim()) {
      team.name = name.trim();
    }
    
    if (description !== undefined) {
      team.description = description;
    }
    
    if (maxMembers && maxMembers >= 2 && maxMembers <= 50) {
      if (maxMembers < team.members.length) {
        return res.status(400).json({ error: 'Il numero massimo di membri è inferiore ai membri attuali' });
      }
      team.maxMembers = maxMembers;
    }
    
    await team.save();
    
    res.json({
      message: 'Team aggiornato con successo',
      team: team
    });
    
  } catch (error) {
    console.error('Update team error:', error);
    res.status(500).json({ error: 'Errore nell\'aggiornamento del team' });
  }
});

module.exports = router;
