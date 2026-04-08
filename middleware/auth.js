const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to verify JWT token and protect routes
const authMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Token non fornito. Accesso negato.' });
    }
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key_here');
    
    // Find user by ID from token
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ error: 'Utente non trovato. Token non valido.' });
    }
    
    if (!user.isActive) {
      return res.status(401).json({ error: 'Account disattivato. Contatta l\'amministratore.' });
    }
    
    // Add user to request object
    req.user = user;
    req.userId = user._id;
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Token non valido.' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token scaduto. Effettua nuovamente il login.' });
    }
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Errore di autenticazione.' });
  }
};

// Middleware to check if user is admin
const adminMiddleware = async (req, res, next) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accesso negato. Privilegi di admin richiesti.' });
    }
    next();
  } catch (error) {
    console.error('Admin middleware error:', error);
    res.status(500).json({ error: 'Errore di autorizzazione.' });
  }
};

// Middleware to check if user is the owner of a resource
const ownerMiddleware = (resourceUserField) => {
  return async (req, res, next) => {
    try {
      if (req.user.role === 'admin') {
        return next(); // Admins can access any resource
      }
      
      // This would typically be used with a specific resource check
      // For now, we'll pass through and let individual routes handle ownership
      next();
    } catch (error) {
      console.error('Owner middleware error:', error);
      res.status(500).json({ error: 'Errore di autorizzazione.' });
    }
  };
};

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET || 'your_jwt_secret_key_here',
    { expiresIn: '7d' }
  );
};

// Verify JWT token
const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key_here');
  } catch (error) {
    return null;
  }
};

module.exports = {
  authMiddleware,
  adminMiddleware,
  ownerMiddleware,
  generateToken,
  verifyToken
};
