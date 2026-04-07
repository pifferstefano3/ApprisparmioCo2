const mongoose = require('mongoose');

// Generate unique team code
function generateTeamCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

const TeamSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    length: 8,
    default: generateTeamCode
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  members: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    role: {
      type: String,
      enum: ['leader', 'member', 'admin'],
      default: 'member'
    }
  }],
  description: {
    type: String,
    maxlength: 200,
    default: ''
  },
  avatar: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  maxMembers: {
    type: Number,
    default: 20,
    min: 2,
    max: 50
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastActivity: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for faster queries
TeamSchema.index({ code: 1 });
TeamSchema.index({ 'members.user': 1 });
TeamSchema.index({ creator: 1 });

// Method to generate unique team code
TeamSchema.statics.generateUniqueCode = async function() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code;
  let attempts = 0;
  const maxAttempts = 10;
  
  do {
    code = '';
    for (let i = 0; i < 8; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    
    const existing = await this.findOne({ code });
    if (!existing) break;
    
    attempts++;
  } while (attempts < maxAttempts);
  
  if (attempts >= maxAttempts) {
    throw new Error('Impossibile generare un codice univoco dopo diversi tentativi');
  }
  
  return code;
};

// Method to add member to team
TeamSchema.methods.addMember = function(userId, role = 'member') {
  // Check if user is already a member
  const existingMember = this.members.find(member => 
    member.user.toString() === userId.toString()
  );
  
  if (existingMember) {
    throw new Error('L\'utente è già un membro del team');
  }
  
  // Check max members limit
  if (this.members.length >= this.maxMembers) {
    throw new Error('Il team ha raggiunto il numero massimo di membri');
  }
  
  this.members.push({
    user: userId,
    role: role,
    joinedAt: new Date()
  });
  
  this.lastActivity = new Date();
  return this.save();
};

// Method to remove member from team
TeamSchema.methods.removeMember = function(userId) {
  this.members = this.members.filter(member => 
    member.user.toString() !== userId.toString()
  );
  
  this.lastActivity = new Date();
  return this.save();
};

// Method to check if user is member
TeamSchema.methods.isMember = function(userId) {
  return this.members.some(member => 
    member.user.toString() === userId.toString()
  );
};

// Method to get user role in team
TeamSchema.methods.getUserRole = function(userId) {
  const member = this.members.find(member => 
    member.user.toString() === userId.toString()
  );
  
  return member ? member.role : null;
};

// Method to update last activity
TeamSchema.methods.updateActivity = function() {
  this.lastActivity = new Date();
  return this.save();
};

// Virtual for member count
TeamSchema.virtual('memberCount').get(function() {
  return this.members.length;
});

// Virtual for team stats
TeamSchema.virtual('stats').get(function() {
  return {
    memberCount: this.members.length,
    createdAt: this.createdAt,
    lastActivity: this.lastActivity,
    isActive: this.isActive
  };
});

module.exports = mongoose.model('Team', TeamSchema);
