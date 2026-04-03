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
  passwordHash: {
    type: String,
    required: true,
  },
  points: { type: Number, default: 0, min: 0 },
  co2Saved: { type: Number, default: 0, min: 0 },       // in kg
  kmSustainable: { type: Number, default: 0, min: 0 },
  streak: { type: streakSchema, default: () => ({}) },
  inventory: { type: [inventoryItemSchema], default: [] },
  avatarSkin: { type: String, default: 'default' },
  trophies: { type: [String], default: [] },
}, {
  timestamps: true,
});

// Hash automatico prima del salvataggio
userSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();
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
      // Già aggiornato oggi
    } else if (diffDays === 1) {
      this.streak.current += 1;
    } else {
      this.streak.current = 1;
    }
  }

  if (this.streak.current > this.streak.max) {
    this.streak.max = this.streak.current;
  }
  this.streak.lastActivity = now;
};

// Esclude passwordHash dal JSON di risposta
userSchema.methods.toPublicJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
