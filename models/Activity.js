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
    // airplane aggiunto; carpooling_ai = carpooling gestito da AI con passeggeri
    enum: ['walk', 'bike', 'bus', 'tram', 'carpool', 'carpool_ai', 'car', 'airplane'],
    required: true,
  },
  distanceKm: {
    type: Number,
    required: true,
    min: [0.01, 'Distanza minima 10 metri'],
  },
  passengers: { type: Number, default: 1, min: 1, max: 8 }, // per carpool_ai
  co2Saved: { type: Number, default: 0, min: 0 },           // in kg
  co2Points: { type: Number, default: 0 },                  // punti CO2 non spendibili
  pointsEarned: { type: Number, default: 0 },               // stelle (spendibili)
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

activitySchema.index({ userId: 1, createdAt: -1 });

// ─── CO2 savings in g/km (vs auto privata 170g/km) ────────────────────────────
// Aereo: emette ~255g/km per passeggero → CO2 saved = -255g/km (NEGATIVO)
const CO2_SAVINGS_PER_KM = {
  walk:       170,   // g risparmiate vs auto
  bike:       170,
  bus:        101,
  tram:        96,
  carpool:     85,
  carpool_ai:  85,   // base, l'AI calcola il risparmio reale su passeggeri
  car:          0,
  airplane:  -255,   // genera CO2 extra rispetto all'auto (penalità)
};

activitySchema.pre('save', function (next) {
  if (this.isNew || this.isModified('distanceKm') || this.isModified('transport') || this.isModified('passengers')) {
    let savingsPerKm = CO2_SAVINGS_PER_KM[this.transport] || 0;

    // Per carpool_ai: risparmio calcolato su n passeggeri
    // Base auto = 170g/km; diviso tra N passeggeri = 170/N g/km emesse a testa
    // Risparmio = 170 - (170/passengers) g/km
    if (this.transport === 'carpool_ai' && this.passengers > 1) {
      savingsPerKm = Math.round(170 - (170 / this.passengers));
    }

    this.co2Saved = parseFloat(((savingsPerKm * this.distanceKm) / 1000).toFixed(4));
    // co2Points = sempre positivi per classifica (valore assoluto dei risparmi o 0 per aereo)
    this.co2Points = Math.max(0, parseFloat(((savingsPerKm * this.distanceKm) / 1000).toFixed(4)));
  }
  next();
});

activitySchema.statics.CO2_SAVINGS = CO2_SAVINGS_PER_KM;

module.exports = mongoose.model('Activity', activitySchema);
