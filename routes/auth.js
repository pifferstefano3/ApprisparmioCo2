const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

const SALT_ROUNDS = 12;
const JWT_EXPIRES = '7d';

function generateToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email e password sono obbligatori' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'La password deve essere almeno 6 caratteri' });
    }

    const existing = await User.findOne({ $or: [{ email: email.toLowerCase() }, { username }] });
    if (existing) {
      return res.status(409).json({ error: 'Username o email già in uso' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = new User({ username, email, passwordHash });
    await user.save();

    const token = generateToken(user._id);
    res.status(201).json({ token, user: user.toPublicJSON() });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Username o email già registrati' });
    }
    console.error('[Auth/Register]', err);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email e password obbligatorie' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Credenziali non valide' });
    }

    const valid = await user.comparePassword(password);
    if (!valid) {
      return res.status(401).json({ error: 'Credenziali non valide' });
    }

    const token = generateToken(user._id);
    res.json({ token, user: user.toPublicJSON() });
  } catch (err) {
    console.error('[Auth/Login]', err);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-passwordHash -__v');
    if (!user) return res.status(404).json({ error: 'Utente non trovato' });
    res.json(user);
  } catch (err) {
    console.error('[Auth/Me]', err);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

module.exports = router;
