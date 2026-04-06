const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Post = require('../models/Post');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// ─── Multer per media upload ──────────────────────────────────────────────────
const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `post_${req.userId}_${Date.now()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const ok = ['image/jpeg','image/png','image/gif','image/webp','video/mp4','video/webm'];
  if (ok.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Formato non supportato. Usa JPG, PNG, GIF, WEBP, MP4 o WEBM.'));
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 20 * 1024 * 1024 } }); // 20MB

// GET /api/feed?page=1&limit=12
router.get('/', async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(24, parseInt(req.query.limit) || 12);
    const skip  = (page - 1) * limit;

    const [posts, total] = await Promise.all([
      Post.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Post.countDocuments(),
    ]);

    // Aggiungi flag liked dall'utente corrente
    const userId = req.userId.toString();
    const decorated = posts.map(p => ({
      ...p,
      likesCount: p.likes.length,
      likedByMe: p.likes.map(id => id.toString()).includes(userId),
      commentsCount: p.comments.length,
    }));

    res.json({ posts: decorated, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error('[Feed/GET]', err);
    res.status(500).json({ error: 'Errore nel caricamento del feed' });
  }
});

// POST /api/feed — crea post
router.post('/', upload.single('media'), async (req, res) => {
  try {
    const { title, description } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Il titolo è obbligatorio' });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'Utente non trovato' });

    let mediaUrl  = '';
    let mediaType = '';
    if (req.file) {
      mediaUrl  = `/uploads/${req.file.filename}`;
      mediaType = req.file.mimetype.startsWith('video') ? 'video' : 'image';
    }

    const POINTS_FOR_POST = 10;
    const post = await Post.create({
      userId: req.userId,
      username: user.username,
      profilePic: user.profilePic || '',
      title: title.trim().slice(0, 120),
      description: (description || '').trim().slice(0, 600),
      mediaUrl,
      mediaType,
      pointsAwarded: POINTS_FOR_POST,
    });

    // Assegna stelle bonus
    user.stars  = (user.stars  || 0) + POINTS_FOR_POST;
    user.points = user.stars;
    await user.save();

    res.status(201).json({ post, starsEarned: POINTS_FOR_POST, totalStars: user.stars });
  } catch (err) {
    console.error('[Feed/POST]', err);
    res.status(500).json({ error: err.message || 'Errore nella creazione del post' });
  }
});

// POST /api/feed/:id/like — toggle like
router.post('/:id/like', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post non trovato' });

    const uid = req.userId.toString();
    const idx = post.likes.findIndex(id => id.toString() === uid);

    if (idx === -1) {
      post.likes.push(req.userId);
    } else {
      post.likes.splice(idx, 1);
    }
    await post.save();

    res.json({ likesCount: post.likes.length, liked: idx === -1 });
  } catch (err) {
    console.error('[Feed/Like]', err);
    res.status(500).json({ error: 'Errore like' });
  }
});

// POST /api/feed/:id/comment
router.post('/:id/comment', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'Commento vuoto' });

    const [post, user] = await Promise.all([
      Post.findById(req.params.id),
      User.findById(req.userId).select('username').lean(),
    ]);
    if (!post) return res.status(404).json({ error: 'Post non trovato' });

    const comment = { userId: req.userId, username: user.username, text: text.trim().slice(0, 500) };
    post.comments.push(comment);
    await post.save();

    const newComment = post.comments[post.comments.length - 1];
    res.status(201).json({ comment: newComment, commentsCount: post.comments.length });
  } catch (err) {
    console.error('[Feed/Comment]', err);
    res.status(500).json({ error: 'Errore commento' });
  }
});

// DELETE /api/feed/:id — elimina il proprio post
router.delete('/:id', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post non trovato' });
    if (post.userId.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Non puoi eliminare questo post' });
    }
    await post.deleteOne();
    res.json({ success: true });
  } catch (err) {
    console.error('[Feed/DELETE]', err);
    res.status(500).json({ error: 'Errore eliminazione post' });
  }
});

module.exports = router;
