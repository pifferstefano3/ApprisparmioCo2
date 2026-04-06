require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();

// ─── Crea cartella uploads se non esiste ─────────────────────────────────────
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// ─── Security & Middleware ────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'", "'unsafe-inline'",
        "unpkg.com", "cdn.jsdelivr.net",
        "fonts.googleapis.com", "cdnjs.cloudflare.com",
      ],
      styleSrc: [
        "'self'", "'unsafe-inline'",
        "unpkg.com", "fonts.googleapis.com", "fonts.gstatic.com",
        "cdnjs.cloudflare.com",
      ],
      imgSrc: [
        "'self'", "data:", "blob:",
        "*.openstreetmap.org", "*.tile.openstreetmap.org",
        "tile.openstreetmap.org",
        "a.tile.openstreetmap.org", "b.tile.openstreetmap.org", "c.tile.openstreetmap.org",
        "*.basemaps.cartocdn.com", "basemaps.cartocdn.com",
        "*.tile.carto.com",
      ],
      connectSrc: ["'self'", "*.openstreetmap.org", "*.basemaps.cartocdn.com"],
      fontSrc: ["'self'", "fonts.googleapis.com", "fonts.gstatic.com", "cdnjs.cloudflare.com"],
      mediaSrc: ["'self'", "blob:"],
      workerSrc: ["'self'", "blob:"],
    },
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Static Files ─────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',        require('./routes/auth'));
app.use('/api/activities',  require('./routes/activities'));
app.use('/api/ai',          require('./routes/ai'));
app.use('/api/shop',        require('./routes/shop'));
app.use('/api/profile',     require('./routes/profile'));
app.use('/api/chat',        require('./routes/chat'));
app.use('/api/feed',        require('./routes/feed'));
app.use('/api/leaderboard', require('./routes/leaderboard'));
app.use('/api/challenges',  require('./routes/challenges'));

// ─── SPA Catch-all ────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    res.status(404).json({ error: 'Route non trovata' });
  }
});

// ─── MongoDB Anti-Timeout Connection ──────────────────────────────────────────
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
    const uri = process.env.MONGO_URI ||
      "mongodb+srv://StefanoPiffer:Rango_mitico0progetto@cluster0.cij3u0z.mongodb.net/verdent?retryWrites=true&w=majority";
    await mongoose.connect(uri, MONGO_OPTIONS);
  } catch (err) {
    console.error('[MongoDB] Connessione fallita:', err.message);
    setTimeout(connectDB, 5000);
  }
}

mongoose.connection.on('connected',    () => { isConnected = true;  console.log('[MongoDB] Connesso a Atlas'); });
mongoose.connection.on('error',    err => { isConnected = false; console.error('[MongoDB] Errore:', err.message); });
mongoose.connection.on('disconnected', () => { isConnected = false; console.warn('[MongoDB] Disconnesso — riconnessione...'); setTimeout(connectDB, 5000); });

process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('[MongoDB] Connessione chiusa per shutdown');
  process.exit(0);
});

// ─── Start Server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
connectDB().then(() => {
  app.listen(PORT, () => console.log(`[VERDENT] Server in ascolto su http://localhost:${PORT}`));
});
