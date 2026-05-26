const mongoose = require('mongoose');

const raceReportSchema = new mongoose.Schema({
  raceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Race',
    required: true,
    unique: true,
  },
  refereeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  summary: {
    type: String,
    default: '',
  },
  weatherCondition: {
    type: String,
    default: '',
  },
  trackCondition: {
    type: String,
    default: '',
  },
  totalParticipants: {
    type: Number,
    default: 0,
  },
  totalViolations: {
    type: Number,
    default: 0,
  },
  incidentDetails: {
    type: String,
    default: '',
  },
  additionalNotes: {
    type: String,
    default: '',
  },
}, {
  timestamps: true,
});

const RaceReport = mongoose.model('RaceReport', raceReportSchema);
module.exports = RaceReport;
