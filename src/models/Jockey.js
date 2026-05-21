const mongoose = require("mongoose");

const jockeySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    fullName: {
      type: String,
      required: true,
    },
    phone: String,
    age: Number,
    experience: Number, // số năm kinh nghiệm
    winRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    bio: String,
    image: String,
    status: {
      type: String,
      enum: ["AVAILABLE", "UNAVAILABLE", "INACTIVE"],
      default: "AVAILABLE",
    },
    specialties: [String], // ví dụ: ['Long Distance', 'Sprint', 'Turf']
    wins: {
      type: Number,
      default: 0,
    },
    races: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Jockey", jockeySchema);
