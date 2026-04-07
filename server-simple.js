// Simple MongoDB connection for testing
const mongoose = require('mongoose');

// In-memory fallback for testing without MongoDB
let mockData = {
  users: [],
  posts: [],
  teams: [],
  activities: []
};

async function connectDB() {
  try {
    // Try local MongoDB first
    await mongoose.connect('mongodb://localhost:27017/verdent');
    console.log('[MongoDB] Connesso a locale');
    return true;
  } catch (error) {
    console.warn('[MongoDB] Local MongoDB not available, using in-memory mode');
    console.log('[MongoDB] App running in DEMO MODE - data will not persist');
    return false;
  }
}

module.exports = { connectDB, mockData };
