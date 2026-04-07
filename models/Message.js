const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  content: {
    type: String,
    required: function() {
      return this.type === 'text';
    },
    maxlength: 1000,
    trim: true
  },
  type: {
    type: String,
    enum: ['text', 'file', 'image', 'video'],
    default: 'text'
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  room: {
    type: String,
    required: true,
    index: true
  },
  roomType: {
    type: String,
    enum: ['global', 'team', 'private'],
    required: true
  },
  file: {
    filename: String,
    originalName: String,
    mimetype: String,
    size: Number,
    url: String
  },
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  reactions: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    emoji: String,
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date
  },
  readBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Indexes for better performance
MessageSchema.index({ room: 1, createdAt: -1 });
MessageSchema.index({ sender: 1 });
MessageSchema.index({ 'readBy.user': 1 });

// Virtual for message metadata
MessageSchema.virtual('metadata').get(function() {
  return {
    id: this._id,
    type: this.type,
    roomType: this.roomType,
    hasFile: !!this.file,
    hasReactions: this.reactions.length > 0,
    isEdited: this.isEdited,
    replyCount: this.replyTo ? 1 : 0
  };
});

// Method to add reaction
MessageSchema.methods.addReaction = function(userId, emoji) {
  // Remove existing reaction from same user
  this.reactions = this.reactions.filter(reaction => 
    reaction.user.toString() !== userId.toString()
  );
  
  // Add new reaction
  this.reactions.push({
    user: userId,
    emoji: emoji,
    addedAt: new Date()
  });
  
  return this.save();
};

// Method to remove reaction
MessageSchema.methods.removeReaction = function(userId) {
  this.reactions = this.reactions.filter(reaction => 
    reaction.user.toString() !== userId.toString()
  );
  
  return this.save();
};

// Method to mark as read
MessageSchema.methods.markAsRead = function(userId) {
  const existingRead = this.readBy.find(read => 
    read.user.toString() === userId.toString()
  );
  
  if (!existingRead) {
    this.readBy.push({
      user: userId,
      readAt: new Date()
    });
    return this.save();
  }
  
  return Promise.resolve(this);
};

// Method to edit message
MessageSchema.methods.editContent = function(newContent) {
  if (this.type !== 'text') {
    throw new Error('Solo i messaggi di testo possono essere modificati');
  }
  
  this.content = newContent;
  this.isEdited = true;
  this.editedAt = new Date();
  
  return this.save();
};

// Method to soft delete
MessageSchema.methods.softDelete = function() {
  this.isDeleted = true;
  this.deletedAt = new Date();
  
  return this.save();
};

// Pre-save middleware
MessageSchema.pre('save', function(next) {
  // Validate room format based on type
  if (this.roomType === 'global' && this.room !== 'global') {
    return next(new Error('La room globale deve essere "global"'));
  }
  
  if (this.roomType === 'team' && !this.room.startsWith('team-')) {
    return next(new Error('Le room di team devono iniziare con "team-"'));
  }
  
  if (this.roomType === 'private' && !this.room.startsWith('private-')) {
    return next(new Error('Le room private devono iniziare con "private-"'));
  }
  
  next();
});

module.exports = mongoose.model('Message', MessageSchema);
