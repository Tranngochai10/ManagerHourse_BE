const mongoose = require('mongoose');

const tournamentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true,
  },
  description: {
    type: String,
    trim: true,
  },
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    required: true,
  },
  venue: {
    type: String,
    required: true,
    trim: true,
  },
  prizePool: {
    type: Number,
    required: true,
    min: 0,
  },
  currency: {
    type: String,
    default: 'VND',
    trim: true,
  },
  maxHorses: {
    type: Number,
    required: true,
    min: 1,
  },
  status: {
    type: String,
    enum: ['DRAFT', 'PUBLISHED', 'REGISTRATION_CLOSED', 'BRACKET_GENERATED', 'ONGOING', 'COMPLETED', 'CANCELLED'],
    default: 'DRAFT',
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, {
  timestamps: true,
});

const Tournament = mongoose.model('Tournament', tournamentSchema);
module.exports = Tournament;
