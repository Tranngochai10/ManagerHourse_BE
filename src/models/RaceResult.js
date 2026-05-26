const mongoose = require('mongoose');

const rankingSchema = new mongoose.Schema({
  position: {
    type: Number,
    required: true,
    min: 1,
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
  finishTime: {
    type: String, // e.g. "1:12.345"
    required: true,
  },
}, { _id: false });

const raceResultSchema = new mongoose.Schema({
  raceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Race',
    required: true,
    unique: true,
  },
  rankings: {
    type: [rankingSchema],
    required: true,
  },
  notes: {
    type: String,
    default: '',
  },
  confirmedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  confirmedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

const RaceResult = mongoose.model('RaceResult', raceResultSchema);
module.exports = RaceResult;
