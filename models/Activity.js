const mongoose = require('mongoose');

const ActivitySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['walk', 'bike', 'bus', 'train', 'car', 'post', 'team', 'goal', 'challenge']
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
  points: {
    type: Number,
    default: 0
  },
  co2Saved: {
    type: Number,
    default: 0
  },
  distance: {
    type: Number,
    default: 0
  },
  duration: {
    type: Number,
    default: 0
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      default: [0, 0]
    }
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for faster queries
ActivitySchema.index({ user: 1, createdAt: -1 });
ActivitySchema.index({ type: 1 });
ActivitySchema.index({ createdAt: -1 });

// Pre-save middleware
ActivitySchema.pre('save', function(next) {
  // Calculate points based on activity type
  if (this.points === 0) {
    this.calculatePoints();
  }
  next();
});

// Instance methods
ActivitySchema.methods.calculatePoints = function() {
  const pointsMap = {
    walk: 5,
    bike: 8,
    bus: 3,
    train: 4,
    car: 1,
    post: 5,
    team: 10,
    goal: 15,
    challenge: 20
  };
  
  this.points = pointsMap[this.type] || 1;
};

ActivitySchema.methods.calculateCO2Saved = function() {
  const co2Map = {
    walk: 0.2,
    bike: 0,
    bus: 0.08,
    train: 0.04,
    car: 0.17
  };
  
  if (co2Map[this.type]) {
    this.co2Saved = this.distance * co2Map[this.type];
  }
};

// Static methods
ActivitySchema.statics.getUserActivities = function(userId, limit = 50) {
  return this.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('user', 'name avatar');
};

ActivitySchema.statics.getActivitiesByType = function(type, limit = 50) {
  return this.find({ type: type })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('user', 'name avatar');
};

ActivitySchema.statics.getUserStats = function(userId) {
  return this.aggregate([
    { $match: { user: mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: '$user',
        totalPoints: { $sum: '$points' },
        totalCO2Saved: { $sum: '$co2Saved' },
        totalActivities: { $sum: 1 },
        activitiesByType: {
          $push: {
            type: '$type',
            count: 1
          }
        }
      }
    }
  ]);
};

module.exports = mongoose.model('Activity', ActivitySchema);
