const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');
const { uploadSingle } = require('../middleware/upload');

// GET /api/feed - Get feed posts with pagination
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;

    const posts = await Post.getFeedPosts(page, limit);

    res.json({
      posts: posts
    });
  } catch (error) {
    console.error('Get feed error:', error);
    res.status(500).json({ error: 'Errore nel caricamento del feed' });
  }
});

// POST /api/feed/create - Create a new post with media upload
router.post('/create', authMiddleware, uploadSingle('media', 'feed'), async (req, res) => {
  try {
    const userId = req.userId;
    const { title, description } = req.body;

    if (!title || title.trim().length === 0) {
      return res.status(400).json({ error: 'Il titolo è obbligatorio' });
    }

    const mediaUrl = req.file ? `/uploads/feed/${req.file.filename}` : null;
    const mediaType = req.file ? (req.file.mimetype.startsWith('video/') ? 'video' : 'image') : 'none';

    const post = new Post({
      userId: userId,
      title: title.trim(),
      description: description ? description.trim() : '',
      mediaUrl,
      mediaType
    });

    await post.save();

    // Award points to user
    const user = await User.findById(userId);
    if (user) {
      user.points += post.points;
      user.updateHonorTitle();
      await user.save();
    }

    // Emit new post via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.emit('newPost', post);
    }

    res.status(201).json({
      message: 'Post creato con successo',
      post: post
    });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ error: error.message || 'Errore nella creazione del post' });
  }
});

// POST /api/feed/:id/like - Toggle like on post
router.post('/:id/like', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const post = await Post.findById(id);

    if (!post) {
      return res.status(404).json({ error: 'Post non trovato' });
    }

    const isLiked = post.likes.includes(userId);

    if (isLiked) {
      post.removeLike(userId);
    } else {
      post.addLike(userId);
    }

    await post.save();

    res.json({
      message: isLiked ? 'Like rimosso' : 'Like aggiunto',
      liked: !isLiked,
      likeCount: post.getLikeCount()
    });
  } catch (error) {
    console.error('Toggle like error:', error);
    res.status(500).json({ error: 'Errore nel toggle del like' });
  }
});

// POST /api/feed/:id/comment - Add comment to post
router.post('/:id/comment', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;
    const userId = req.userId;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'Il commento è obbligatorio' });
    }

    const post = await Post.findById(id).populate('userId', 'name');

    if (!post) {
      return res.status(404).json({ error: 'Post non trovato' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    post.addComment(userId, user.name, text.trim());
    await post.save();

    // Emit new comment via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.emit('newComment', {
        postId: id,
        comment: post.comments[post.comments.length - 1]
      });
    }

    res.json({
      message: 'Commento aggiunto con successo',
      commentCount: post.getCommentCount()
    });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ error: 'Errore nell\'aggiunta del commento' });
  }
});

// DELETE /api/feed/:id - Delete a post
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const post = await Post.findById(id);

    if (!post) {
      return res.status(404).json({ error: 'Post non trovato' });
    }

    // Check if user owns the post
    if (post.userId.toString() !== userId) {
      return res.status(403).json({ error: 'Non hai permesso di eliminare questo post' });
    }

    await Post.findByIdAndDelete(id);

    res.json({
      message: 'Post eliminato con successo'
    });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ error: 'Errore nell\'eliminazione del post' });
  }
});

// GET /api/feed/user/:userId - Get user's posts
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    const posts = await Post.getUserPosts(userId, limit);

    res.json({
      posts: posts
    });
  } catch (error) {
    console.error('Get user posts error:', error);
    res.status(500).json({ error: 'Errore nel caricamento dei post' });
  }
});

// GET /api/feed/search?q=query - Search posts
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    const limit = parseInt(req.query.limit) || 50;

    if (!q) {
      return res.status(400).json({ error: 'Query di ricerca obbligatoria' });
    }

    const posts = await Post.searchPosts(q, limit);

    res.json({
      posts: posts
    });
  } catch (error) {
    console.error('Search posts error:', error);
    res.status(500).json({ error: 'Errore nella ricerca dei post' });
  }
});

module.exports = router;
