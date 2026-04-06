const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String, required: true },
  text:     { type: String, required: true, maxlength: 500 },
}, { timestamps: true });

const postSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  username:    { type: String, required: true },
  profilePic:  { type: String, default: '' },
  title:       { type: String, required: true, maxlength: 120 },
  description: { type: String, maxlength: 600, default: '' },
  mediaUrl:    { type: String, default: '' },      // immagine/video upload
  mediaType:   { type: String, enum: ['image', 'video', ''], default: '' },
  likes:       { type: [mongoose.Schema.Types.ObjectId], default: [] }, // userId che hanno messo like
  comments:    { type: [commentSchema], default: [] },
  pointsAwarded: { type: Number, default: 10 },    // stelle bonus assegnate alla creazione
}, {
  timestamps: true,
});

postSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Post', postSchema);
