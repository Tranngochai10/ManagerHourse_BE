const mongoose = require('mongoose');


const tournamentRegistrationSchema = new mongoose.Schema({
  tournamentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tournament',
    required: true,
  },
  horseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Horse',
    required: true,
  },
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    default: 'PENDING',
  },
  seed: {
    type: Number,
    default: null,
  },
  withdrawn: {
    type: Boolean,
    default: false,
  },
  withdrawalReason: {
    type: String,
    default: null,
  },
}, {
  timestamps: true,
});

// A horse can register only once per tournament
const tournamentRegistrationSchema = new mongoose.Schema(
  {
    tournamentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tournament',
      required: true,
    },
    horseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Horse',
      required: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
    },
    rejectionReason: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Unique: một ngựa chỉ đăng ký một lần trong một tournament
tournamentRegistrationSchema.index({ tournamentId: 1, horseId: 1 }, { unique: true });

const TournamentRegistration = mongoose.model('TournamentRegistration', tournamentRegistrationSchema);
module.exports = TournamentRegistration;
