const mongoose = require("mongoose");

const scheduleSchema = new mongoose.Schema(
  {
    raceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    tournamentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    raceName: {
      type: String,
      required: true,
      trim: true,
    },
    scheduledTime: {
      type: Date,
      required: true,
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
    distance: {
      type: Number,
      required: true,
    },
    prizePool: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["SCHEDULED", "ONGOING", "COMPLETED", "CANCELLED"],
      default: "SCHEDULED",
    },
    registeredHorses: [
      {
        horseId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Horse",
          required: true,
        },
        ownerId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        jockeyId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Jockey",
        },
        status: {
          type: String,
          enum: ["CONFIRMED", "PENDING", "WITHDRAWN", "DISQUALIFIED"],
          default: "PENDING",
        },
        registrationDate: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    maxParticipants: {
      type: Number,
      required: true,
    },
    raceType: {
      type: String,
      enum: ["SPRINT", "LONG_DISTANCE", "HANDICAP", "STEEPLECHASE"],
      required: true,
    },
    trackCondition: {
      type: String,
      enum: ["GOOD", "YIELDING", "SOFT", "HEAVY"],
      default: "GOOD",
    },
    result: {
      winner: {
        horseId: mongoose.Schema.Types.ObjectId,
        position: Number,
      },
      placings: [
        {
          position: Number,
          horseId: mongoose.Schema.Types.ObjectId,
          jockeyId: mongoose.Schema.Types.ObjectId,
        },
      ],
    },
  },
  {
    timestamps: true,
  },
);

// Index for faster queries
scheduleSchema.index({ tournamentId: 1, scheduledTime: 1 });
scheduleSchema.index({ raceId: 1 });
scheduleSchema.index({ "registeredHorses.ownerId": 1 });
scheduleSchema.index({ "registeredHorses.jockeyId": 1 });

const Schedule = mongoose.model("Schedule", scheduleSchema);
module.exports = Schedule;
