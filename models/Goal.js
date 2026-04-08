const mongoose = require('mongoose');

const GoalSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  type: {
    type: String,
    required: true,
    enum: ['daily', 'weekly', 'monthly', 'custom']
  },
  target: {
    type: Number,
    required: true,
    default: 1
  },
  current: {
    type: Number,
    default: 0
  },
  unit: {
    type: String,
    default: 'times'
  },
  category: {
    type: String,
    enum: ['transport', 'food', 'energy', 'waste', 'water', 'general'],
    default: 'general'
  },
  deadline: {
    type: Date,
    default: null
  },
  isCompleted: {
    type: Boolean,
    default: false
  },
  completedAt: {
    type: Date,
    default: null
  },
  points: {
    type: Number,
    default: 10
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Index for faster queries
GoalSchema.index({ user: 1, isActive: 1 });
GoalSchema.index({ type: 1 });
GoalSchema.index({ isCompleted: 1 });
GoalSchema.index({ deadline: 1 });

// Pre-save middleware to update updatedAt
GoalSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Check if goal is completed
  if (this.current >= this.target && !this.isCompleted) {
    this.isCompleted = true;
    this.completedAt = new Date();
  }
  
  next();
});

// Instance methods
GoalSchema.methods.updateProgress = function(amount) {
  this.current += amount;
  if (this.current >= this.target && !this.isCompleted) {
    this.isCompleted = true;
    this.completedAt = new Date();
  }
};

GoalSchema.methods.getProgressPercentage = function() {
  if (this.target === 0) return 0;
  return Math.min(100, (this.current / this.target) * 100);
};

GoalSchema.methods.isExpired = function() {
  if (!this.deadline) return false;
  return new Date() > this.deadline;
};

GoalSchema.methods.reset = function() {
  this.current = 0;
  this.isCompleted = false;
  this.completedAt = null;
};

// Static methods
GoalSchema.statics.getUserGoals = function(userId, includeCompleted = false) {
  const query = { user: userId };
  if (!includeCompleted) {
    query.isCompleted = false;
  }
  return this.find(query).sort({ createdAt: -1 });
};

GoalSchema.statics.getActiveGoals = function(userId) {
  return this.find({
    user: userId,
    isActive: true,
    isCompleted: false
  }).sort({ deadline: 1 });
};

GoalSchema.statics.getCompletedGoals = function(userId) {
  return this.find({
    user: userId,
    isCompleted: true
  }).sort({ completedAt: -1 });
};

GoalSchema.statics.getExpiredGoals = function(userId) {
  return this.find({
    user: userId,
    deadline: { $lt: new Date() },
    isCompleted: false
  }).sort({ deadline: 1 });
};

module.exports = mongoose.model('Goal', GoalSchema);

