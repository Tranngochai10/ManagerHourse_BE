const mongoose = require('mongoose');

const raceRegistrationSchema = new mongoose.Schema({
  horseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Horse',
    required: true,
  },
  raceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  status: {
    type: String,
    enum: ['PENDING_APPROVAL', 'APPROVED', 'REJECTED'],
    default: 'PENDING_APPROVAL',
  }
}, {
  timestamps: true,
});

const RaceRegistration = mongoose.model('RaceRegistration', raceRegistrationSchema);
module.exports = RaceRegistration;
