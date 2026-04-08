const mongoose = require('mongoose');

const coordinateSchema = new mongoose.Schema({
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now }
});

const trackSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  transport: {
    type: String,
    required: true,
    enum: ['walk', 'bike', 'bus', 'tram', 'carpool', 'carpool_ai', 'car', 'airplane', 'train']
  },
  coordinates: [coordinateSchema],
  distanceKm: {
    type: Number,
    required: true,
    min: 0
  },
  durationMinutes: {
    type: Number,
    required: true,
    min: 0
  },
  weather: {
    type: String,
    default: 'unknown',
    enum: ['sunny', 'cloudy', 'rainy', 'unknown']
  },
  passengers: {
    type: Number,
    default: 1,
    min: 1
  },
  co2Saved: {
    type: Number,
    default: 0
  },
  pointsEarned: {
    type: Number,
    default: 0
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  aiBonus: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for faster queries
trackSchema.index({ userId: 1, createdAt: -1 });
trackSchema.index({ createdAt: -1 });

// Static method to get user's tracks
trackSchema.statics.getUserTracks = async function(userId, limit = 50) {
  return this.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

// Static method to get track stats for user
trackSchema.statics.getUserStats = async function(userId) {
  const result = await this.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: null,
        totalDistance: { $sum: '$distanceKm' },
        totalDuration: { $sum: '$durationMinutes' },
        totalCo2Saved: { $sum: '$co2Saved' },
        totalPoints: { $sum: '$pointsEarned' },
        totalTracks: { $sum: 1 }
      }
    }
  ]);
  return result[0] || {
    totalDistance: 0,
    totalDuration: 0,
    totalCo2Saved: 0,
    totalPoints: 0,
    totalTracks: 0
  };
};

module.exports = mongoose.model('Track', trackSchema);
