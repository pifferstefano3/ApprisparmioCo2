const express = require('express');
const router = express.Router();
const Team = require('../models/Team');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// Create a new team
router.post('/create', async (req, res) => {
  try {
    const { name, description } = req.body;
    const userId = req.userId;
    
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Il nome del team è obbligatorio' });
    }
    
    if (name.trim().length < 3) {
      return res.status(400).json({ error: 'Il nome deve essere almeno 3 caratteri' });
    }
    
    // Create team with auto-generated code
    const team = new Team({
      name: name.trim(),
      description: description ? description.trim() : '',
      creator: userId
    });
    
    // Add creator as team leader
    team.members.push({
      user: userId,
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

// Join a team by code
router.post('/join', async (req, res) => {
  try {
    const { code } = req.body;
    const userId = req.userId;
    
    if (!code || code.trim().length === 0) {
      return res.status(400).json({ error: 'Il codice team è obbligatorio' });
    }
    
    if (code.trim().length !== 8) {
      return res.status(400).json({ error: 'Il codice team deve essere di 8 caratteri' });
    }
    
    // Find team by code
    const team = await Team.findByCode(code.trim().toUpperCase());
    
    if (!team) {
      return res.status(404).json({ error: 'Team non trovato' });
    }
    
    if (!team.isActive) {
      return res.status(400).json({ error: 'Team non attivo' });
    }
    
    if (team.isFull) {
      return res.status(400).json({ error: 'Team al completo' });
    }
    
    // Check if user is already a member
    if (team.isMember(userId)) {
      return res.status(400).json({ error: 'Sei già membro di questo team' });
    }
    
    // Add user to team
    const added = team.addMember(userId, 'member');
    
    if (!added) {
      return res.status(400).json({ error: 'Impossibile aggiungere al team' });
    }
    
    await team.save();
    
    // Populate team data for response
    await team.populate('creator', 'name avatar');
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

// Leave a team
router.post('/:id/leave', async (req, res) => {
  try {
    const teamId = req.params.id;
    const userId = req.userId;
    
    const team = await Team.findById(teamId);
    
    if (!team) {
      return res.status(404).json({ error: 'Team non trovato' });
    }
    
    // Check if user is a member
    if (!team.isMember(userId)) {
      return res.status(400).json({ error: 'Non sei membro di questo team' });
    }
    
    // Prevent creator from leaving (they should delete the team instead)
    if (team.creator.toString() === userId) {
      return res.status(400).json({ error: 'Il creatore non può lasciare il team' });
    }
    
    // Remove user from team
    const removed = team.removeMember(userId);
    
    if (!removed) {
      return res.status(400).json({ error: 'Impossibile rimuovere dal team' });
    }
    
    await team.save();
    
    res.json({
      message: 'Hai lasciato il team con successo'
    });
    
  } catch (error) {
    console.error('Leave team error:', error);
    res.status(500).json({ 
      error: error.message || 'Errore nel lasciare il team' 
    });
  }
});

// Get team details
router.get('/:id', async (req, res) => {
  try {
    const teamId = req.params.id;
    const userId = req.userId;
    
    const team = await Team.findById(teamId)
      .populate('creator', 'name avatar')
      .populate('members.user', 'name avatar');
    
    if (!team) {
      return res.status(404).json({ error: 'Team non trovato' });
    }
    
    // Check if user is a member
    const isMember = team.isMember(userId);
    
    if (!isMember) {
      return res.status(403).json({ error: 'Non hai accesso a questo team' });
    }
    
    res.json({
      team: team
    });
    
  } catch (error) {
    console.error('Get team error:', error);
    res.status(500).json({ 
      error: error.message || 'Errore nel caricamento del team' 
    });
  }
});

// Get user's teams
router.get('/my-teams', async (req, res) => {
  try {
    const userId = req.userId;
    
    const teams = await Team.findUserTeams(userId);
    
    res.json({
      teams: teams
    });
    
  } catch (error) {
    console.error('Get user teams error:', error);
    res.status(500).json({ 
      error: error.message || 'Errore nel caricamento dei team' 
    });
  }
});

// Get teams created by user
router.get('/created', async (req, res) => {
  try {
    const userId = req.userId;
    
    const teams = await Team.findCreatedTeams(userId);
    
    res.json({
      teams: teams
    });
    
  } catch (error) {
    console.error('Get created teams error:', error);
    res.status(500).json({ 
      error: error.message || 'Errore nel caricamento dei team creati' 
    });
  }
});

// Delete team (only creator)
router.delete('/:id', async (req, res) => {
  try {
    const teamId = req.params.id;
    const userId = req.userId;
    
    const team = await Team.findById(teamId);
    
    if (!team) {
      return res.status(404).json({ error: 'Team non trovato' });
    }
    
    // Check if user is the creator
    if (team.creator.toString() !== userId) {
      return res.status(403).json({ error: 'Solo il creatore può eliminare il team' });
    }
    
    // Soft delete (deactivate team)
    team.isActive = false;
    await team.save();
    
    res.json({
      message: 'Team eliminato con successo'
    });
    
  } catch (error) {
    console.error('Delete team error:', error);
    res.status(500).json({ 
      error: error.message || 'Errore nell\'eliminazione del team' 
    });
  }
});

// Update team member role (only creator)
router.put('/:id/members/:memberId/role', async (req, res) => {
  try {
    const { id: teamId, memberId } = req.params;
    const { role } = req.body;
    const userId = req.userId;
    
    const team = await Team.findById(teamId);
    
    if (!team) {
      return res.status(404).json({ error: 'Team non trovato' });
    }
    
    // Check if user is the creator
    if (team.creator.toString() !== userId) {
      return res.status(403).json({ error: 'Solo il creatore può modificare i ruoli' });
    }
    
    // Check if member exists
    if (!team.isMember(memberId)) {
      return res.status(404).json({ error: 'Membro non trovato' });
    }
    
    // Update member role
    const updated = team.updateMemberRole(memberId, role);
    
    if (!updated) {
      return res.status(400).json({ error: 'Impossibile aggiornare il ruolo' });
    }
    
    await team.save();
    
    res.json({
      message: 'Ruolo aggiornato con successo'
    });
    
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ 
      error: error.message || 'Errore nell\'aggiornamento del ruolo' 
    });
  }
});

module.exports = router;
