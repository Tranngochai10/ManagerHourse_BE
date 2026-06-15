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
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE'],
    default: 'ACTIVE',
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
  points: {
    type: Number,
    default: 10000000, // 10,000,000 virtual points starting balance
  },
  lastPointsResetAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

const User = mongoose.model('User', userSchema);
module.exports = User;
