const mongoose = require("mongoose");

const invitationSchema = new mongoose.Schema(
  {
    jockeyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Jockey",
      required: true,
    },
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
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    message: String,
    status: {
      type: String,
      enum: ["PENDING", "ACCEPTED", "REJECTED", "CANCELLED"],
      default: "PENDING",
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 ngày
    },
    sentAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Invitation", invitationSchema);
