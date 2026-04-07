require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const http = require('http');

// Import Socket.io and upload middleware
const SocketManager = require('./middleware/socketManager');
const { cleanupOnError } = require('./middleware/upload');

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
// Static Files Configuration
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));
app.use('/css', express.static(path.join(__dirname, 'public', 'css')));
app.use('/js', express.static(path.join(__dirname, 'public', 'js')));

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
app.use('/api/teams',       require('./routes/teams'));
app.use('/api/goals',       require('./routes/goals'));
app.use('/api/messages',    require('./routes/messages'));

// ─── SPA Catch-all ────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    res.status(404).json({ error: 'Route non trovata' });
  }
});

// ─── MongoDB Atlas Optimized Connection ──────────────────────────────────────
let isConnected = false;

async function connectDB() {
  if (isConnected) return;
  try {
    const uri = process.env.MONGO_URI ||
      "mongodb+srv://StefanoPiffer:Rango_mitico0progetto@cluster0.cij3u0z.mongodb.net/verdent?retryWrites=true&w=majority";
    await mongoose.connect(uri);
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
  // Create HTTP server
  const server = http.createServer(app);
  
  // Initialize Socket.io
  const socketManager = new SocketManager(server);
  
  // Make socket manager available to routes
  app.set('io', socketManager.io);
  
  server.listen(PORT, () => {
    console.log(`[VERDENT] Server in ascolto su http://localhost:${PORT}`);
    console.log(`[VERDENT] Socket.io integrato e funzionante`);
  });
});
