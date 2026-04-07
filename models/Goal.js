const mongoose = require('mongoose');

const GoalSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    required: true,
    maxlength: 500
  },
  keyPoints: [{
    type: String,
    maxlength: 200
  }],
  status: {
    type: Boolean,
    default: false, // false = active (yellow), true = completed (gray)
  },
  team: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: true
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignees: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    assignedAt: {
      type: Date,
      default: Date.now
    },
    completedAt: {
      type: Date
    }
  }],
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  category: {
    type: String,
    enum: ['environmental', 'social', 'economic', 'educational', 'health'],
    default: 'environmental'
  },
  dueDate: {
    type: Date
  },
  estimatedHours: {
    type: Number,
    min: 0,
    max: 1000
  },
  tags: [{
    type: String,
    maxlength: 30
  }],
  attachments: [{
    filename: String,
    originalName: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  completedAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better performance
GoalSchema.index({ team: 1, status: 1 });
GoalSchema.index({ creator: 1 });
GoalSchema.index({ 'assignees.user': 1 });
GoalSchema.index({ dueDate: 1 });
GoalSchema.index({ priority: 1 });

// Method to toggle goal status
GoalSchema.methods.toggleStatus = function(userId) {
  this.status = !this.status;
  
  if (this.status) {
    this.completedAt = new Date();
    this.progress = 100;
    
    // Mark user as completed
    const assignee = this.assignees.find(a => 
      a.user.toString() === userId.toString()
    );
    if (assignee) {
      assignee.completedAt = new Date();
    }
  } else {
    this.completedAt = null;
    this.progress = 0;
    
    // Remove completed timestamp for user
    const assignee = this.assignees.find(a => 
      a.user.toString() === userId.toString()
    );
    if (assignee) {
      assignee.completedAt = null;
    }
  }
  
  this.updatedAt = new Date();
  return this.save();
};

// Method to update progress
GoalSchema.methods.updateProgress = function(progress, userId) {
  this.progress = Math.min(100, Math.max(0, progress));
  
  if (this.progress === 100 && !this.status) {
    this.status = true;
    this.completedAt = new Date();
  } else if (this.progress < 100 && this.status) {
    this.status = false;
    this.completedAt = null;
  }
  
  this.updatedAt = new Date();
  return this.save();
};

// Method to add assignee
GoalSchema.methods.addAssignee = function(userId) {
  const existingAssignee = this.assignees.find(a => 
    a.user.toString() === userId.toString()
  );
  
  if (!existingAssignee) {
    this.assignees.push({
      user: userId,
      assignedAt: new Date()
    });
  }
  
  this.updatedAt = new Date();
  return this.save();
};

// Method to remove assignee
GoalSchema.methods.removeAssignee = function(userId) {
  this.assignees = this.assignees.filter(a => 
    a.user.toString() !== userId.toString()
  );
  
  this.updatedAt = new Date();
  return this.save();
};

// Method to check if user is assigned
GoalSchema.methods.isAssigned = function(userId) {
  return this.assignees.some(a => a.user.toString() === userId.toString());
};

// Virtual for completion percentage
GoalSchema.virtual('completionPercentage').get(function() {
  if (this.assignees.length === 0) return 0;
  
  const completedAssignees = this.assignees.filter(a => a.completedAt).length;
  return Math.round((completedAssignees / this.assignees.length) * 100);
});

// Virtual for time remaining
GoalSchema.virtual('timeRemaining').get(function() {
  if (!this.dueDate) return null;
  
  const now = new Date();
  const due = new Date(this.dueDate);
  const diff = due - now;
  
  if (diff <= 0) return 'Scaduto';
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  
  if (days > 0) return `${days} giorni rimanenti`;
  if (hours > 0) return `${hours} ore rimanenti`;
  return 'Meno di 1 ora rimanente';
});

// Pre-save middleware to update timestamps
GoalSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Goal', GoalSchema);
