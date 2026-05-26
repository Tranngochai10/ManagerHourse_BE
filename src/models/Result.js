const mongoose = require("mongoose");

const resultSchema = new mongoose.Schema(
  {
    raceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Race",
      required: true,
    },
    horseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Horse",
      required: true,
    },
    jockeyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Jockey",
      required: true,
    },
    position: {
      type: Number,
      required: true,
      min: 1,
    },
    finishTime: {
      type: Number,
      required: false,
      comment: "Finish time in seconds",
    },
    status: {
      type: String,
      enum: ["FINISHED", "DISQUALIFIED", "DNF"], // DNF = Did Not Finish
      default: "FINISHED",
    },
    prizeAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    publishedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Index để tìm kiếm nhanh kết quả theo race
resultSchema.index({ raceId: 1 });
// Unique index: một horse chỉ có một result duy nhất trên một race
resultSchema.index({ raceId: 1, horseId: 1 }, { unique: true });
// Index để tìm kết quả của một horse
resultSchema.index({ horseId: 1 });
// Index để tìm kết quả của một jockey
resultSchema.index({ jockeyId: 1 });

const Result = mongoose.model("Result", resultSchema);
module.exports = Result;
