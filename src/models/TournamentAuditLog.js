const mongoose = require('mongoose');

const tournamentAuditLogSchema = new mongoose.Schema({
  tournamentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tournament',
    required: true,
  },
  action: {
    type: String,
    required: true,
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  performedByRole: {
    type: String,
    required: true,
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  severity: {
    type: String,
    enum: ['INFO', 'IMPORTANT', 'WARNING', 'CRITICAL'],
    default: 'INFO',
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

tournamentAuditLogSchema.index({ tournamentId: 1, timestamp: -1 });

const TournamentAuditLog = mongoose.model('TournamentAuditLog', tournamentAuditLogSchema);
module.exports = TournamentAuditLog;
