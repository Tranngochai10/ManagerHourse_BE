const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    spectatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    predictionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Prediction",
      required: true,
    },
    raceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Race",
      required: true,
    },
    type: {
      type: String,
      enum: ["PREDICTION_WON", "PREDICTION_LOST", "RACE_CLOSED"],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    prizeAmount: {
      type: Number,
      default: 0,
      comment: "Prize amount if won",
    },
  },
  {
    timestamps: true,
  },
);

// Index để tìm kiếm nhanh
notificationSchema.index({ spectatorId: 1 });
notificationSchema.index({ predictionId: 1 });
notificationSchema.index({ spectatorId: 1, isRead: 1 });
notificationSchema.index({ createdAt: -1 });

const Notification = mongoose.model("Notification", notificationSchema);
module.exports = Notification;
