
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');

const app = express();

// ─── Security & Middleware ───────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "unpkg.com", "cdn.jsdelivr.net", "fonts.googleapis.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "unpkg.com", "fonts.googleapis.com", "fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "*.openstreetmap.org", "*.tile.openstreetmap.org"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "fonts.googleapis.com", "fonts.gstatic.com"],
    },
  },
}));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Static Files ────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/activities', require('./routes/activities'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/shop', require('./routes/shop'));

// ─── SPA Catch-all ───────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    res.status(404).json({ error: 'Route non trovata' });
  }
});

// ─── MongoDB Anti-Timeout Connection ─────────────────────────────────────────
const MONGO_OPTIONS = {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 10000,
  maxPoolSize: 10,
  minPoolSize: 2,
  heartbeatFrequencyMS: 10000,
};

let isConnected = false;

async function connectDB() {
  if (isConnected) return;
  try {
    //await mongoose.connect(process.env.MONGO_URI, MONGO_OPTIONS);
    await mongoose.connect("mongodb+srv://StefanoPiffer:Rango_mitico0progetto@cluster0.cij3u0z.mongodb.net/verdent?retryWrites=true&w=majority", MONGO_OPTIONS);
  } catch (err) {
    console.error('[MongoDB] Connessione fallita:', err.message);
    setTimeout(connectDB, 5000);
  }
}

mongoose.connection.on('connected', () => {
  isConnected = true;
  console.log('[MongoDB] Connesso a Atlas');
});

mongoose.connection.on('error', (err) => {
  console.error('[MongoDB] Errore:', err.message);
  isConnected = false;
});

mongoose.connection.on('disconnected', () => {
  console.warn('[MongoDB] Disconnesso — tentativo riconnessione...');
  isConnected = false;
  setTimeout(connectDB, 5000);
});

process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('[MongoDB] Connessione chiusa per shutdown');
  process.exit(0);
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`[VERDENT] Server in ascolto su http://localhost:${PORT}`);
  });
});
