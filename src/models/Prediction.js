const mongoose = require("mongoose");

const predictionSchema = new mongoose.Schema(
  {
    raceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Race",
      required: true,
    },
    spectatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    horseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Horse",
      required: true,
    },
    betAmount: {
      type: Number,
      required: true,
      min: 100000,
      max: 10000000,
      comment: "Bet amount in VND",
    },
    predictedPosition: {
      type: Number,
      enum: [1],
      default: 1,
      comment: "Only predict position 1 (winner)",
    },
    status: {
      type: String,
      enum: ["OPEN", "CLOSED", "WON", "LOST"],
      default: "OPEN",
    },
    prizeAmount: {
      type: Number,
      default: 0,
      min: 0,
      comment: "Prize if won (betAmount × 1.8)",
    },
    actualPosition: {
      type: Number,
      default: null,
      comment: "Actual position of predicted horse in result",
    },
    closedAt: {
      type: Date,
      default: null,
    },
    settledAt: {
      type: Date,
      default: null,
    },
    settledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Index để tìm kiếm nhanh
predictionSchema.index({ raceId: 1 });
predictionSchema.index({ spectatorId: 1 });
predictionSchema.index({ horseId: 1 });
predictionSchema.index({ raceId: 1, spectatorId: 1 }, { unique: true }); // One prediction per spectator per race
predictionSchema.index({ status: 1 });
predictionSchema.index({ createdAt: 1 });

const Prediction = mongoose.model("Prediction", predictionSchema);
module.exports = Prediction;
