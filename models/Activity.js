const mongoose = require('mongoose');

const coordSchema = new mongoose.Schema({
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
}, { _id: false });

const activitySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  transport: {
    type: String,
    enum: ['walk', 'bike', 'bus', 'tram', 'carpool', 'car'],
    required: true,
  },
  distanceKm: {
    type: Number,
    required: true,
    min: [0.01, 'Distanza minima 10 metri'],
  },
  co2Saved: {
    type: Number,
    default: 0,
    min: 0,
  },           // in kg
  pointsEarned: { type: Number, default: 0 },
  aiBonus: { type: Number, default: 0 },
  routeCoords: { type: [coordSchema], default: [] },
  weather: {
    type: String,
    enum: ['sunny', 'cloudy', 'rainy', 'snowy', 'unknown'],
    default: 'unknown',
  },
  durationMinutes: { type: Number, default: 0 },
  notes: { type: String, maxlength: 300, default: '' },
}, {
  timestamps: true,
});

// Indici per query frequenti
activitySchema.index({ userId: 1, createdAt: -1 });

// ─── CO2 savings in g/km rispetto a auto privata (170g/km media) ─────────────
const CO2_SAVINGS_PER_KM = {
  walk: 170,      // g risparmiate
  bike: 170,
  bus: 101,
  tram: 96,
  carpool: 85,
  car: 0,
};

// Calcola CO2 risparmiata prima di salvare
activitySchema.pre('save', function (next) {
  if (this.isNew || this.isModified('distanceKm') || this.isModified('transport')) {
    const savingsPerKm = CO2_SAVINGS_PER_KM[this.transport] || 0;
    this.co2Saved = parseFloat(((savingsPerKm * this.distanceKm) / 1000).toFixed(4)); // converti in kg
  }
  next();
});

activitySchema.statics.CO2_SAVINGS = CO2_SAVINGS_PER_KM;

module.exports = mongoose.model('Activity', activitySchema);
