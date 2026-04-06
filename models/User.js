const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const inventoryItemSchema = new mongoose.Schema({
  itemId: { type: String, required: true },
  equippedAt: { type: Date, default: Date.now },
}, { _id: false });

const streakSchema = new mongoose.Schema({
  current: { type: Number, default: 0 },
  max: { type: Number, default: 0 },
  lastActivity: { type: Date, default: null },
}, { _id: false });

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username obbligatorio'],
    unique: true,
    trim: true,
    minlength: [3, 'Username minimo 3 caratteri'],
    maxlength: [30, 'Username massimo 30 caratteri'],
  },
  email: {
    type: String,
    required: [true, 'Email obbligatoria'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Email non valida'],
  },
  passwordHash: { type: String, required: true },

  // ─── Valuta duale ──────────────────────────────────────────────────────────
  // stars: moneta spendibile (EcoShop, badge, ecc.)
  stars: { type: Number, default: 0, min: 0 },
  // co2Points: punti CO2 non spendibili, usati solo per la classifica globale
  co2Points: { type: Number, default: 0, min: 0 },
  // points: alias retrocompatibile → maps to stars in lettura
  points: { type: Number, default: 0, min: 0 },

  // ─── Statistiche ───────────────────────────────────────────────────────────
  co2Saved: { type: Number, default: 0, min: 0 },
  kmSustainable: { type: Number, default: 0, min: 0 },
  streak: { type: streakSchema, default: () => ({}) },

  // ─── Gamification ──────────────────────────────────────────────────────────
  inventory: { type: [inventoryItemSchema], default: [] },
  avatarSkin: { type: String, default: 'default' },
  trophies: { type: [String], default: [] },
  honorTitle: { type: String, default: '' },       // titolo onorifico sbloccato
  honorFrame: { type: String, default: '' },        // cornice/badge speciale

  // ─── Profilo ───────────────────────────────────────────────────────────────
  profilePic: { type: String, default: '' },        // percorso immagine (Multer)
  bio: { type: String, maxlength: 200, default: '' },

  // ─── Email verification ────────────────────────────────────────────────────
  emailVerified: { type: Boolean, default: false },
  emailToken: { type: String, default: null },
  emailTokenExpires: { type: Date, default: null },

  // ─── Sfide mensili ─────────────────────────────────────────────────────────
  challengeProgress: { type: Number, default: 0 },  // progresso sfida corrente
  challengeMonth: { type: String, default: '' },    // es. "2025-06"
}, {
  timestamps: true,
});

// ─── Pre-save (retrocompat points→stars) ──────────────────────────────────────
userSchema.pre('save', function (next) {
  // Mantieni points e stars sincronizzati per retrocompatibilità
  if (this.isModified('stars')) this.points = this.stars;
  if (this.isModified('points') && !this.isModified('stars')) this.stars = this.points;
  next();
});

// Metodo per confrontare password
userSchema.methods.comparePassword = async function (plainPassword) {
  return bcrypt.compare(plainPassword, this.passwordHash);
};

// Metodo per aggiornare streak
userSchema.methods.updateStreak = function () {
  const now = new Date();
  const last = this.streak.lastActivity;
  if (!last) {
    this.streak.current = 1;
  } else {
    const diffDays = Math.floor((now - last) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) {
      // già aggiornato oggi
    } else if (diffDays === 1) {
      this.streak.current += 1;
    } else {
      this.streak.current = 1;
    }
  }
  if (this.streak.current > this.streak.max) this.streak.max = this.streak.current;
  this.streak.lastActivity = now;
};

// Esclude passwordHash dal JSON di risposta
userSchema.methods.toPublicJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.emailToken;
  delete obj.emailTokenExpires;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
