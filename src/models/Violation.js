const mongoose = require('mongoose');

const violationSchema = new mongoose.Schema({
  raceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Race',
    required: true,
  },
  horseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Horse',
    required: true,
  },
  jockeyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Jockey',
    required: true,
  },
  type: {
    type: String,
    enum: ['FALSE_START', 'INTERFERENCE', 'OVERWEIGHT', 'DOPING', 'OTHER'],
    required: true,
  },
  description: {
    type: String,
    required: true,
    trim: true,
  },
  penalty: {
    type: String,
    enum: ['WARNING', 'DISQUALIFY', 'FINE'],
    required: true,
  },
  fineAmount: {
    type: Number,
    default: null,
    min: 0,
  },
  status: {
    type: String,
    enum: ['OPEN', 'RESOLVED'],
    default: 'OPEN',
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  resolvedAt: {
    type: Date,
    default: null,
  },
  resolutionNote: {
    type: String,
    default: null,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, {
  timestamps: true,
});

const Violation = mongoose.model('Violation', violationSchema);
module.exports = Violation;
