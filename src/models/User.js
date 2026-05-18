const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
  },
  fullName: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['OWNER', 'JOCKEY', 'SPECTATOR', 'ADMIN', 'REFEREE'],
    required: true,
  },
  phone: {
    type: String,
    trim: true,
  },
  refreshToken: {
    type: String,
    default: null,
  }
}, {
  timestamps: true,
});

const User = mongoose.model('User', userSchema);
module.exports = User;
