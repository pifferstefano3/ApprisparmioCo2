const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const { uploadSingle, uploadMultiple } = require('../middleware/upload');

router.use(authMiddleware);

// GET /api/feed - Get feed posts with pagination
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;
    
    // Get posts with populated author info
    const posts = await Post.find({})
      .populate('userId', 'name avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    
    // Transform posts to include author info
    const transformedPosts = posts.map(post => ({
      ...post,
      author: {
        _id: post.userId._id,
        name: post.userId.name,
        avatar: post.userId.avatar
      },
      userId: undefined // Remove the original userId field
    }));
    
    const total = await Post.countDocuments();
    
    res.json({
      posts: transformedPosts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('Get feed error:', error);
    res.status(500).json({ error: 'Errore nel caricamento del feed' });
  }
});

// POST /api/feed - Create new post with media upload
router.post('/create', uploadSingle('media', 'feed'), async (req, res) => {
  try {
    const { title, description } = req.body;
    const userId = req.userId;
    
    // Validate required fields
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Il titolo è obbligatorio' });
    }
    
    // Create post object
    const postData = {
      title: title.trim(),
      description: description ? description.trim() : '',
      userId,
      createdAt: new Date()
    };
    
    // Add media if uploaded
    if (req.file) {
      postData.mediaUrl = `/uploads/feed/${req.file.filename}`;
      postData.mediaType = req.file.mimetype.startsWith('video/') ? 'video' : 'image';
    }
    
    // Create and save post
    const post = new Post(postData);
    await post.save();
    
    // Get user info for response
    const user = await User.findById(userId, 'name avatar');
    
    // Emit new post via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.emit('newPost', {
        ...post.toObject(),
        author: {
          _id: user._id,
          name: user.name,
          avatar: user.avatar
        }
      });
    }
    
    // Award points for creating post
    await User.findByIdAndUpdate(userId, { $inc: { points: 5 } });
    
    res.status(201).json({
      message: 'Post creato con successo',
      post: {
        ...post.toObject(),
        author: {
          _id: user._id,
          name: user.name,
          avatar: user.avatar
        },
        starsEarned: 5
      }
    });
    
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ error: 'Errore nella creazione del post' });
  }
});

// POST /api/feed/:id/like - Toggle like on post
router.post('/:id/like', async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.userId;
    
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post non trovato' });
    }
    
    // Check if user already liked the post
    const likeIndex = post.likes.indexOf(userId);
    const isLiked = likeIndex === -1;
    
    if (isLiked) {
      // Add like
      post.likes.push(userId);
    } else {
      // Remove like
      post.likes.splice(likeIndex, 1);
    }
    
    await post.save();
    
    res.json({
      liked: isLiked,
      likesCount: post.likes.length
    });
    
  } catch (error) {
    console.error('Toggle like error:', error);
    res.status(500).json({ error: 'Errore nel toggle like' });
  }
});

// POST /api/feed/:id/comment - Add comment to post
router.post('/:id/comment', async (req, res) => {
  try {
    const postId = req.params.id;
    const { text } = req.body;
    const userId = req.userId;
    
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Il testo del commento è obbligatorio' });
    }
    
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post non trovato' });
    }
    
    // Get user info
    const user = await User.findById(userId, 'name');
    
    // Add comment
    const comment = {
      userId,
      username: user.name,
      text: text.trim(),
      createdAt: new Date()
    };
    
    post.comments.push(comment);
    await post.save();
    
    // Emit new comment via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.emit('newComment', {
        postId,
        comment
      });
    }
    
    res.status(201).json({
      message: 'Commento aggiunto con successo',
      comment
    });
    
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ error: 'Errore nell\'aggiunta del commento' });
  }
});

// DELETE /api/feed/:id - Delete post (only by author)
router.delete('/:id', async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.userId;
    
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post non trovato' });
    }
    
    // Check if user is the author
    if (post.userId.toString() !== userId) {
      return res.status(403).json({ error: 'Non sei autorizzato a eliminare questo post' });
    }
    
    await Post.findByIdAndDelete(postId);
    
    res.json({
      message: 'Post eliminato con successo'
    });
    
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ error: 'Errore nell\'eliminazione del post' });
  }
});

// GET /api/feed/user/:userId - Get posts by specific user
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const posts = await Post.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    
    const total = await Post.countDocuments({ userId });
    
    res.json({
      posts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('Get user posts error:', error);
    res.status(500).json({ error: 'Errore nel caricamento dei post utente' });
  }
});

module.exports = router;
