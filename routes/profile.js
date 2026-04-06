const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');
const Activity = require('../models/Activity');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// ─── Multer Config ────────────────────────────────────────────────────────────
const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `avatar_${req.userId}_${Date.now()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Solo immagini JPG, PNG, GIF o WEBP'));
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 3 * 1024 * 1024 } }); // 3MB

// GET /api/profile — profilo utente
router.get('/', async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-passwordHash -emailToken -emailTokenExpires -__v').lean();
    if (!user) return res.status(404).json({ error: 'Utente non trovato' });

    // Ultime 5 attività
    const recentActivities = await Activity.find({ userId: req.userId })
      .sort({ createdAt: -1 }).limit(5).lean();

    // Totale post
    const Post = require('../models/Post');
    const postCount = await Post.countDocuments({ userId: req.userId });

    res.json({ user, recentActivities, postCount });
  } catch (err) {
    console.error('[Profile/GET]', err);
    res.status(500).json({ error: 'Errore nel recupero profilo' });
  }
});

// PUT /api/profile — aggiorna bio e/o honorTitle
router.put('/', async (req, res) => {
  try {
    const { bio, honorTitle, honorFrame, avatarSkin } = req.body;
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'Utente non trovato' });

    if (bio !== undefined) user.bio = bio.slice(0, 200);

    // HonorTitle e HonorFrame sono sbloccabili solo se presenti nell'inventario
    if (honorTitle !== undefined) {
      const owned = user.inventory.some(i => i.itemId === honorTitle);
      if (owned || honorTitle === '') user.honorTitle = honorTitle;
    }
    if (honorFrame !== undefined) {
      const owned = user.inventory.some(i => i.itemId === honorFrame);
      if (owned || honorFrame === '') user.honorFrame = honorFrame;
    }
    if (avatarSkin !== undefined) {
      const owned = user.inventory.some(i => i.itemId === avatarSkin) || avatarSkin === 'default';
      if (owned) user.avatarSkin = avatarSkin;
    }

    await user.save();
    res.json({ user: user.toPublicJSON() });
  } catch (err) {
    console.error('[Profile/PUT]', err);
    res.status(500).json({ error: 'Errore aggiornamento profilo' });
  }
});

// POST /api/profile/avatar — upload foto profilo
router.post('/avatar', upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nessuna immagine caricata' });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'Utente non trovato' });

    // Rimuovi vecchia foto se non è la default
    if (user.profilePic && !user.profilePic.startsWith('http')) {
      const oldPath = path.join(__dirname, '..', 'public', user.profilePic);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    user.profilePic = `/uploads/${req.file.filename}`;
    await user.save();

    res.json({ profilePic: user.profilePic, message: 'Foto profilo aggiornata!' });
  } catch (err) {
    console.error('[Profile/Avatar]', err);
    res.status(500).json({ error: err.message || 'Errore upload avatar' });
  }
});

module.exports = router;
