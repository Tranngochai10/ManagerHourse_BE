const mongoose = require('mongoose');

const raceSchema = new mongoose.Schema({
  tournamentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tournament',
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  distance: {
    type: Number,
    required: true,
    min: 100,
    comment: 'Distance in meters',
  },
  scheduledAt: {
    type: Date,
    required: true,
  },
  maxHorses: {
    type: Number,
    required: true,
    min: 2,
  },
  prizeFirst: {
    type: Number,
    default: 0,
    min: 0,
  },
  prizeSecond: {
    type: Number,
    default: 0,
    min: 0,
  },
  prizeThird: {
    type: Number,
    default: 0,
    min: 0,
  },
  status: {
    type: String,
    enum: ['SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELLED'],
    default: 'SCHEDULED',
  },
  refereeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
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

const Race = mongoose.model('Race', raceSchema);
module.exports = Race;
