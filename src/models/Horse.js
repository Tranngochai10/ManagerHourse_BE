const mongoose = require('mongoose');

const horseSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  breed: {
    type: String,
    required: true,
    trim: true,
  },
  age: {
    type: Number,
    required: true,
    min: 2,
    max: 20,
  },
  weight: {
    type: Number,
    required: true,
    min: 300,
    max: 700,
  },
  color: {
    type: String,
    required: true,
    trim: true,
  },
  gender: {
    type: String,
    enum: ['MALE', 'FEMALE'],
    required: true,
  },
  origin: {
    type: String,
    required: true,
    trim: true,
  },
  healthCertUrl: {
    type: String,
    required: true,
    trim: true,
  },
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    default: 'PENDING',
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  }
}, {
  timestamps: true,
});

const Horse = mongoose.model('Horse', horseSchema);
module.exports = Horse;
