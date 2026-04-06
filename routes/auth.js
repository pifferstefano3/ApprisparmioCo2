const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

const SALT_ROUNDS = 12;
const JWT_EXPIRES = '7d';

function generateToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

// ─── Nodemailer (opzionale — solo se GMAIL_USER/PASS configurati) ─────────────
let transporter = null;
try {
  if (process.env.GMAIL_USER && process.env.GMAIL_PASS) {
    const nodemailer = require('nodemailer');
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
    });
    console.log('[Email] Nodemailer configurato con Gmail');
  }
} catch (e) { console.warn('[Email] Nodemailer non disponibile:', e.message); }

async function sendVerificationEmail(email, username, token) {
  if (!transporter) return;
  const BASE = process.env.BASE_URL || 'http://localhost:3000';
  const link = `${BASE}/api/auth/verify-email?token=${token}`;
  await transporter.sendMail({
    from: `"VERDENT 🌿" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: 'Conferma la tua email VERDENT',
    html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f0fdf4;border-radius:16px;">
        <h1 style="color:#2e8b57;">Benvenuto su VERDENT, ${username}! 🌿</h1>
        <p style="color:#374151;">Clicca il link qui sotto per verificare la tua email e iniziare a salvare il pianeta.</p>
        <a href="${link}" style="display:inline-block;margin:24px 0;padding:14px 28px;background:#2e8b57;color:white;border-radius:999px;font-weight:700;text-decoration:none;">
          Verifica Email ✅
        </a>
        <p style="color:#9ca3af;font-size:0.8rem;">Il link scade tra 24 ore.</p>
      </div>`,
  });
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password)
      return res.status(400).json({ error: 'Username, email e password sono obbligatori' });
    if (password.length < 6)
      return res.status(400).json({ error: 'La password deve essere almeno 6 caratteri' });

    const existing = await User.findOne({ $or: [{ email: email.toLowerCase() }, { username }] });
    if (existing) return res.status(409).json({ error: 'Username o email già in uso' });

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const emailToken   = uuidv4();
    const emailTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const user = new User({ username, email, passwordHash, emailToken, emailTokenExpires, emailVerified: false });
    await user.save();

    sendVerificationEmail(email, username, emailToken).catch(e => console.warn('[Email]', e.message));

    const token = generateToken(user._id);
    res.status(201).json({ token, user: user.toPublicJSON(), emailVerificationSent: !!transporter });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Username o email già registrati' });
    console.error('[Auth/Register]', err);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email e password obbligatorie' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ error: 'Credenziali non valide' });

    const valid = await user.comparePassword(password);
    if (!valid) return res.status(401).json({ error: 'Credenziali non valide' });

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
    const user = await User.findById(req.userId).select('-passwordHash -emailToken -emailTokenExpires -__v');
    if (!user) return res.status(404).json({ error: 'Utente non trovato' });
    res.json(user);
  } catch (err) {
    console.error('[Auth/Me]', err);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// GET /api/auth/verify-email?token=...
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).send('<h2>Token mancante</h2>');

    const user = await User.findOne({ emailToken: token, emailTokenExpires: { $gt: new Date() } });
    if (!user) return res.status(400).send('<h2>Link di verifica non valido o scaduto.</h2>');

    user.emailVerified = true;
    user.emailToken = null;
    user.emailTokenExpires = null;
    await user.save();

    res.send(`<html><head><meta http-equiv="refresh" content="3;url=/dashboard.html"></head>
      <body style="font-family:Inter,sans-serif;text-align:center;padding:60px;background:#f0fdf4;">
        <h1 style="color:#2e8b57;">✅ Email verificata con successo!</h1>
        <p>Reindirizzamento alla dashboard tra 3 secondi...</p>
      </body></html>`);
  } catch (err) {
    console.error('[Auth/VerifyEmail]', err);
    res.status(500).send('<h2>Errore del server</h2>');
  }
});

// POST /api/auth/resend-verification
router.post('/resend-verification', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'Utente non trovato' });
    if (user.emailVerified) return res.json({ message: 'Email già verificata' });

    user.emailToken = uuidv4();
    user.emailTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    sendVerificationEmail(user.email, user.username, user.emailToken)
      .catch(e => console.warn('[Email/Resend]', e.message));

    res.json({ message: 'Email di verifica inviata!', sent: !!transporter });
  } catch (err) {
    console.error('[Auth/ResendVerification]', err);
    res.status(500).json({ error: 'Errore invio email' });
  }
});

module.exports = router;
