const mongoose = require("mongoose");

const raceRegistrationSchema = new mongoose.Schema(
  {
    horseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Horse",
      required: true,
    },
    raceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Race",
      required: true,
    },
    status: {
      type: String,
      enum: ["PENDING_APPROVAL", "APPROVED", "REJECTED", "CONFIRMED"],
      default: "PENDING_APPROVAL",
    },
    confirmedByOwner: {
      type: Boolean,
      default: false,
    },
    startingGate: {
      type: Number,
      default: null,
    },
    rejectionReason: {
      type: String,
      default: null,
    },
    horseName: {
      type: String,
      default: null,
    },
    horseBreed: {
      type: String,
      default: null,
    },
    raceName: {
      type: String,
      default: null,
    },
    ownerName: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Unique index: one horse can only register once per race
raceRegistrationSchema.index({ horseId: 1, raceId: 1 }, { unique: true });

const RaceRegistration = mongoose.model(
  "RaceRegistration",
  raceRegistrationSchema,
);
module.exports = RaceRegistration;
