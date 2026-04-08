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
    trim: true
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
TeamSchema.index({ code: 1 });
TeamSchema.index({ creator: 1 });
TeamSchema.index({ 'members.user': 1 });

// Pre-save middleware to update updatedAt
TeamSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Instance methods
TeamSchema.methods.addMember = function(userId, role = 'member') {
  const existingMember = this.members.find(member => 
    member.user.toString() === userId.toString()
  );
  
  if (existingMember) {
    return false;
  }
  
  this.members.push({
    user: userId,
    role: role,
    joinedAt: new Date()
  });
  
  return true;
};

TeamSchema.methods.removeMember = function(userId) {
  const memberIndex = this.members.findIndex(member => 
    member.user.toString() === userId.toString()
  );
  
  if (memberIndex === -1) {
    return false;
  }
  
  this.members.splice(memberIndex, 1);
  return true;
};

TeamSchema.methods.isMember = function(userId) {
  return this.members.some(member => 
    member.user.toString() === userId.toString()
  );
};

TeamSchema.methods.getMemberRole = function(userId) {
  const member = this.members.find(member => 
    member.user.toString() === userId.toString()
  );
  return member ? member.role : null;
};

TeamSchema.methods.updateMemberRole = function(userId, newRole) {
  const member = this.members.find(member => 
    member.user.toString() === userId.toString()
  );
  
  if (!member) {
    return false;
  }
  
  member.role = newRole;
  return true;
};

// Static methods
TeamSchema.statics.findByCode = function(code) {
  return this.findOne({ code: code.toUpperCase() });
};

TeamSchema.statics.findUserTeams = function(userId) {
  return this.find({ 
    'members.user': userId,
    isActive: true 
  }).populate('creator', 'name avatar')
    .populate('members.user', 'name avatar');
};

TeamSchema.statics.findCreatedTeams = function(userId) {
  return this.find({ 
    creator: userId,
    isActive: true 
  }).populate('members.user', 'name avatar');
};

// Virtual fields
TeamSchema.virtual('memberCount').get(function() {
  return this.members.length;
});

TeamSchema.virtual('isFull').get(function() {
  return this.members.length >= 10;
});

TeamSchema.set('toJSON', { virtuals: true });
TeamSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Team', TeamSchema);
