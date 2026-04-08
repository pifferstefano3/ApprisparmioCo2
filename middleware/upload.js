const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const ensureUploadsDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let uploadPath;
    
    // Determine upload path based on file type and context
    if (req.body.uploadType === 'chat') {
      uploadPath = path.join(__dirname, '../public/uploads/chat');
    } else if (req.body.uploadType === 'profile') {
      uploadPath = path.join(__dirname, '../public/uploads/profile');
    } else if (req.body.uploadType === 'goal') {
      uploadPath = path.join(__dirname, '../public/uploads/goals');
    } else if (req.body.uploadType === 'feed') {
      uploadPath = path.join(__dirname, '../public/uploads/feed');
    } else {
      // Default to general uploads
      uploadPath = path.join(__dirname, '../public/uploads');
    }
    
    ensureUploadsDir(uploadPath);
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  }
});

// File filter for validation
const fileFilter = (req, file, cb) => {
  // Allowed file types
  const allowedTypes = {
    'image/jpeg': true,
    'image/jpg': true,
    'image/png': true,
    'image/gif': true,
    'image/webp': true,
    'video/mp4': true,
    'video/webm': true,
    'video/ogg': true
  };
  
  // Check file type
  if (allowedTypes[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new Error('Tipo di file non supportato. Sono permessi solo immagini (JPEG, PNG, GIF, WebP) e video (MP4, WebM, OGG).'), false);
  }
};

// Upload middleware configuration
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
    files: 5 // Max 5 files per request
  }
});

// Helper functions for different upload scenarios
const uploadSingle = (fieldName, uploadType) => (req, res, next) => {
  // Set upload type in request body for destination determination
  req.body.uploadType = uploadType;
  
  const singleUpload = upload.single(fieldName);
  singleUpload(req, res, (err) => {
    if (err) {
      console.error('Upload error:', err);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File troppo grande. Massimo 10MB.' });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ error: 'Troppi file. Massimo 5 file.' });
      }
      if (err.message.includes('non supportato')) {
        return res.status(400).json({ error: err.message });
      }
      return res.status(500).json({ error: 'Errore durante il caricamento del file.' });
    }
    next();
  });
};

const uploadMultiple = (fieldName, uploadType, maxCount = 5) => (req, res, next) => {
  // Set upload type in request body for destination determination
  req.body.uploadType = uploadType;
  
  const multiUpload = upload.array(fieldName, maxCount);
  multiUpload(req, res, (err) => {
    if (err) {
      console.error('Upload error:', err);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File troppo grande. Massimo 10MB.' });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ error: `Troppi file. Massimo ${maxCount} file.` });
      }
      if (err.message.includes('non supportato')) {
        return res.status(400).json({ error: err.message });
      }
      return res.status(500).json({ error: 'Errore durante il caricamento dei file.' });
    }
    next();
  });
};

// Cleanup function for removing uploaded files on error
const cleanupOnError = (files) => {
  if (files && Array.isArray(files)) {
    files.forEach(file => {
      try {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      } catch (error) {
        console.error('Cleanup error:', error);
      }
    });
  } else if (files && files.path) {
    try {
      if (fs.existsSync(files.path)) {
        fs.unlinkSync(files.path);
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }
};

// Create uploads directories on startup
const createUploadDirectories = () => {
  const directories = [
    path.join(__dirname, '../public/uploads'),
    path.join(__dirname, '../public/uploads/profile'),
    path.join(__dirname, '../public/uploads/chat'),
    path.join(__dirname, '../public/uploads/feed'),
    path.join(__dirname, '../public/uploads/goals')
  ];
  
  directories.forEach(dir => {
    ensureUploadsDir(dir);
  });
};

// Initialize directories
createUploadDirectories();

module.exports = {
  upload,
  uploadSingle,
  uploadMultiple,
  cleanupOnError
};
