const mongoose = require("mongoose");

const spectatorSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    bio: {
      type: String,
      default: "",
    },
    points: {
      type: Number,
      default: 10000000, // 10,000,000 virtual points starting balance
    },
    lastPointsResetAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Spectator", spectatorSchema);
