const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  username: {
    type: String,
    required: true
  },
  text: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const PostSchema = new mongoose.Schema({
  userId: {
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
  mediaUrl: {
    type: String,
    default: null
  },
  mediaType: {
    type: String,
    enum: ['image', 'video', 'none'],
    default: 'none'
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  comments: [commentSchema],
  points: {
    type: Number,
    default: 5
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
PostSchema.index({ userId: 1, createdAt: -1 });
PostSchema.index({ createdAt: -1 });
PostSchema.index({ likes: 1 });

// Pre-save middleware to update updatedAt
PostSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Instance methods
PostSchema.methods.addLike = function(userId) {
  if (!this.likes.includes(userId)) {
    this.likes.push(userId);
  }
};

PostSchema.methods.removeLike = function(userId) {
  const index = this.likes.indexOf(userId);
  if (index > -1) {
    this.likes.splice(index, 1);
  }
};

PostSchema.methods.addComment = function(userId, username, text) {
  this.comments.push({
    userId,
    username,
    text,
    createdAt: new Date()
  });
};

PostSchema.methods.getLikeCount = function() {
  return this.likes.length;
};

PostSchema.methods.getCommentCount = function() {
  return this.comments.length;
};

// Static methods
PostSchema.statics.getUserPosts = function(userId, limit = 50) {
  return this.find({ userId: userId, isActive: true })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('userId', 'name avatar');
};

PostSchema.statics.getFeedPosts = function(page = 1, limit = 12) {
  const skip = (page - 1) * limit;
  return this.find({ isActive: true })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('userId', 'name avatar');
};

PostSchema.statics.searchPosts = function(query, limit = 50) {
  return this.find({
    $or: [
      { title: { $regex: query, $options: 'i' } },
      { description: { $regex: query, $options: 'i' } }
    ],
    isActive: true
  })
  .sort({ createdAt: -1 })
  .limit(limit)
  .populate('userId', 'name avatar');
};

module.exports = mongoose.model('Post', PostSchema);
