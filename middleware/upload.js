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
      uploadPath = path.join(__dirname, '../public/uploads/avatars');
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
    'video/quicktime': true,
    'application/pdf': true,
    'application/msword': true,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': true,
    'application/vnd.ms-excel': true,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': true,
    'application/vnd.ms-powerpoint': true,
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': true,
    'text/plain': true,
    'text/csv': true
  };
  
  if (allowedTypes[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new Error('Tipo di file non consentito. Tipi permessi: immagini, video, PDF, documenti Office, testo.'), false);
  }
};

// Size limits based on file type
const limits = {
  fileSize: function(req) {
    if (req.body.uploadType === 'chat') {
      return 5 * 1024 * 1024; // 5MB for chat
    } else if (req.body.uploadType === 'profile') {
      return 2 * 1024 * 1024; // 2MB for profile pictures
    } else if (req.body.uploadType === 'feed') {
      return 20 * 1024 * 1024; // 20MB for feed posts
    } else if (req.body.uploadType === 'goal') {
      return 10 * 1024 * 1024; // 10MB for goal attachments
    }
    return 10 * 1024 * 1024; // Default 10MB
  },
  files: 5 // Maximum 5 files per request
};

// Create multer instance
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: limits,
  // Error handling
  onError: function(err, next) {
    console.error('Multer error:', err);
    next(err);
  }
});

// Middleware for single file upload
const uploadSingle = (fieldName, uploadType = 'general') => {
  return (req, res, next) => {
    // Set upload type in request body for storage configuration
    req.body.uploadType = uploadType;
    
    upload.single(fieldName)(req, res, function(err) {
      if (err) {
        console.error('File upload error:', err);
        
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ 
              error: 'File troppo grande. Dimensione massima: ' + (limits.fileSize(req) / 1024 / 1024).toFixed(1) + 'MB' 
            });
          } else if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({ 
              error: 'Troppi file. Massimo ' + limits.files + ' file per richiesta' 
            });
          } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({ 
              error: 'Campo file non previsto' 
            });
          }
        }
        
        return res.status(400).json({ 
          error: err.message || 'Errore durante il caricamento del file' 
        });
      }
      
      next();
    });
  };
};

// Middleware for multiple file upload
const uploadMultiple = (fieldName, maxCount = 5, uploadType = 'general') => {
  return (req, res, next) => {
    req.body.uploadType = uploadType;
    
    upload.array(fieldName, maxCount)(req, res, function(err) {
      if (err) {
        console.error('File upload error:', err);
        
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ 
              error: 'File troppo grande. Dimensione massima: ' + (limits.fileSize(req) / 1024 / 1024).toFixed(1) + 'MB' 
            });
          } else if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({ 
              error: 'Troppi file. Massimo ' + maxCount + ' file per richiesta' 
            });
          }
        }
        
        return res.status(400).json({ 
          error: err.message || 'Errore durante il caricamento dei file' 
        });
      }
      
      next();
    });
  };
};

// Helper function to get file info
const getFileInfo = (file) => {
  if (!file) return null;
  
  return {
    filename: file.filename,
    originalName: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    url: `/uploads/${path.basename(file.destination)}/${file.filename}`,
    extension: path.extname(file.originalname).toLowerCase(),
    isImage: file.mimetype.startsWith('image/'),
    isVideo: file.mimetype.startsWith('video/'),
    isDocument: !file.mimetype.startsWith('image/') && !file.mimetype.startsWith('video/')
  };
};

// Helper function to delete uploaded file
const deleteUploadedFile = (filePath) => {
  try {
    const fullPath = path.join(__dirname, '../public', filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error deleting file:', error);
    return false;
  }
};

// Middleware to clean up files on request failure
const cleanupOnError = (req, res, next) => {
  const originalFiles = req.files ? [...req.files] : (req.file ? [req.file] : []);
  
  res.on('finish', () => {
    // If response status is error, clean up uploaded files
    if (res.statusCode >= 400) {
      originalFiles.forEach(file => {
        deleteUploadedFile(`/uploads/${path.basename(file.destination)}/${file.filename}`);
      });
    }
  });
  
  next();
};

module.exports = {
  upload,
  uploadSingle,
  uploadMultiple,
  getFileInfo,
  deleteUploadedFile,
  cleanupOnError,
  // Export configuration for reference
  config: {
    storage,
    fileFilter,
    limits
  }
};
