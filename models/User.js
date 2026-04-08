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
  password: {
    type: String,
    required: [true, 'Password obbligatoria'],
    minlength: [6, 'Password minimo 6 caratteri'],
  },
  name: {
    type: String,
    trim: true,
    maxlength: 50,
  },
  bio: {
    type: String,
    maxlength: 200,
    trim: true,
  },
  avatar: {
    type: String,
    default: null,
  },
  points: {
    type: Number,
    default: 0,
  },
  trophies: {
    type: Number,
    default: 0,
  },
  co2Saved: {
    type: Number,
    default: 0,
  },
  honorTitle: {
    type: String,
    default: 'Eco-Novice',
  },
  inventory: [inventoryItemSchema],
  streak: streakSchema,
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Index for faster queries
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ points: -1 });

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-save middleware to update updatedAt
userSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Instance methods
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.addPoints = function(pointsToAdd) {
  this.points += pointsToAdd;
  this.updateHonorTitle();
};

userSchema.methods.updateHonorTitle = function() {
  if (this.points >= 1000) {
    this.honorTitle = 'Eco-Legend';
  } else if (this.points >= 500) {
    this.honorTitle = 'Eco-Master';
  } else if (this.points >= 250) {
    this.honorTitle = 'Eco-Expert';
  } else if (this.points >= 100) {
    this.honorTitle = 'Eco-Warrior';
  } else if (this.points >= 50) {
    this.honorTitle = 'Eco-Enthusiast';
  } else {
    this.honorTitle = 'Eco-Novice';
  }
};

userSchema.methods.updateStreak = function() {
  const now = new Date();
  const lastActivity = this.streak.lastActivity;
  
  if (!lastActivity) {
    this.streak.current = 1;
    this.streak.max = 1;
    this.streak.lastActivity = now;
  } else {
    const daysSinceLastActivity = Math.floor((now - lastActivity) / (1000 * 60 * 60 * 24));
    
    if (daysSinceLastActivity <= 1) {
      this.streak.current += 1;
      if (this.streak.current > this.streak.max) {
        this.streak.max = this.streak.current;
      }
    } else {
      this.streak.current = 1;
    }
    
    this.streak.lastActivity = now;
  }
};

// Static methods
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

userSchema.statics.findByUsername = function(username) {
  return this.findOne({ username: username.toLowerCase() });
};

// Virtual fields
userSchema.virtual('postCount').get(function() {
  return this.posts ? this.posts.length : 0;
});

userSchema.virtual('teamCount').get(function() {
  return this.teams ? this.teams.length : 0;
});

// Ensure virtual fields are included in JSON
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('User', userSchema);
