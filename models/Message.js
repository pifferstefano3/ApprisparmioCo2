const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  room: {
    type: String,
    required: true,
    trim: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  type: {
    type: String,
    enum: ['text', 'image', 'video', 'file'],
    default: 'text'
  },
  mediaUrl: {
    type: String,
    default: null
  },
  reactions: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    emoji: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date,
    default: null
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
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
MessageSchema.index({ room: 1, createdAt: -1 });
MessageSchema.index({ sender: 1 });
MessageSchema.index({ createdAt: -1 });

// Pre-save middleware to update updatedAt
MessageSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Instance methods
MessageSchema.methods.addReaction = function(userId, emoji) {
  const existingReaction = this.reactions.find(r => 
    r.userId.toString() === userId.toString() && r.emoji === emoji
  );
  
  if (!existingReaction) {
    this.reactions.push({
      userId,
      emoji,
      createdAt: new Date()
    });
  }
};

MessageSchema.methods.removeReaction = function(userId, emoji) {
  const index = this.reactions.findIndex(r => 
    r.userId.toString() === userId.toString() && r.emoji === emoji
  );
  
  if (index > -1) {
    this.reactions.splice(index, 1);
  }
};

MessageSchema.methods.edit = function(newContent) {
  this.content = newContent;
  this.isEdited = true;
  this.editedAt = new Date();
};

MessageSchema.methods.delete = function(deletedBy) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = deletedBy;
};

// Static methods
MessageSchema.statics.getRoomMessages = function(room, limit = 50, skip = 0) {
  return this.find({ room: room, isDeleted: false })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('sender', 'name avatar');
};

MessageSchema.statics.getUserMessages = function(userId, limit = 50) {
  return this.find({ sender: userId, isDeleted: false })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('sender', 'name avatar');
};

MessageSchema.statics.searchMessages = function(room, query, limit = 50) {
  return this.find({
    room: room,
    content: { $regex: query, $options: 'i' },
    isDeleted: false
  })
  .sort({ createdAt: -1 })
  .limit(limit)
  .populate('sender', 'name avatar');
};

MessageSchema.statics.getRecentMessages = function(rooms, limit = 50) {
  return this.find({
    room: { $in: rooms },
    isDeleted: false
  })
  .sort({ createdAt: -1 })
  .limit(limit)
  .populate('sender', 'name avatar');
};

module.exports = mongoose.model('Message', MessageSchema);
