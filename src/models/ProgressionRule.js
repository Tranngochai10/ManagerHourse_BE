const mongoose = require('mongoose');

const progressionRuleSchema = new mongoose.Schema({
  tournamentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tournament',
    required: true,
  },
  fromRound: {
    type: Number,
    required: true,
  },
  toRound: {
    type: Number,
    required: true,
  },
  directQualifiersPerHeat: {
    type: Number,
    required: true,
  },
  wildcardsCount: {
    type: Number,
    required: true,
  },
}, {
  timestamps: true,
});

// A tournament can have only one rule per fromRound
progressionRuleSchema.index({ tournamentId: 1, fromRound: 1 }, { unique: true });

const ProgressionRule = mongoose.model('ProgressionRule', progressionRuleSchema);
module.exports = ProgressionRule;
