const mongoose = require("mongoose");
const Prediction = require("../models/Prediction");
const Notification = require("../models/Notification");
const Race = require("../models/Race");
const Horse = require("../models/Horse");
const Result = require("../models/Result");
const User = require("../models/User");

const BET_MULTIPLIER = 1.8; // betAmount × 1.8 khi thắng
const MIN_BET = 100000;
const MAX_BET = 10000000;

// GET /races/:raceId/predictions/open — Public: Check if race is still open for predictions
exports.checkRaceOpen = async (req, res) => {
  try {
    const { raceId } = req.params;

    // Validate raceId format
    if (!mongoose.Types.ObjectId.isValid(raceId)) {
      return res.status(400).json({ message: "Invalid race ID format" });
    }

    const race = await Race.findById(raceId);
    if (!race) {
      return res.status(404).json({ message: "Race not found" });
    }

    const now = new Date();
    const scheduledTime = new Date(race.scheduledAt);

    const nowUtc = now.getTime();
    const scheduledUtc = scheduledTime.getTime();

    // Only open if status is SCHEDULED or ONGOING and current time is before scheduled time
    const isOpen =
      (race.status === "SCHEDULED" || race.status === "ONGOING") &&
      nowUtc < scheduledUtc;

    res.status(200).json({
      raceId,
      raceName: race.name,
      isOpen,
      raceStatus: race.status,
      scheduledAt: race.scheduledAt,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /races/:raceId/predictions — SPECTATOR: Place a prediction
exports.placePrediction = async (req, res) => {
  try {
    const { raceId } = req.params;
    const { horseId, betAmount } = req.body;
    const spectatorId = req.user._id;

    // Validate raceId format
    if (!mongoose.Types.ObjectId.isValid(raceId)) {
      return res.status(400).json({ message: "Invalid race ID format" });
    }

    // Validate horseId format
    if (horseId && !mongoose.Types.ObjectId.isValid(horseId)) {
      return res.status(400).json({ message: "Invalid horse ID format" });
    }

    // Validate betAmount
    if (!betAmount || betAmount < MIN_BET || betAmount > MAX_BET) {
      return res.status(400).json({
        message: `Bet amount must be between ${MIN_BET} and ${MAX_BET}`,
      });
    }

    // Check race exists and is not completed/cancelled/draft/etc.
    const race = await Race.findById(raceId);
    if (!race) {
      return res.status(404).json({ message: "Race not found" });
    }

    const now = new Date();
    const scheduledTime = new Date(race.scheduledAt);

    const nowUtc = now.getTime();
    const scheduledUtc = scheduledTime.getTime();

    // Enforce status conditions
    if (race.status !== "SCHEDULED" && race.status !== "ONGOING") {
      return res.status(400).json({
        message: `Cannot place prediction for race with status ${race.status}`,
      });
    }

    // Enforce time condition
    if (nowUtc >= scheduledUtc) {
      return res.status(400).json({
        message: "Predictions are closed for this race",
      });
    }

    // Check horse exists
    const horse = await Horse.findById(horseId);
    if (!horse) {
      return res.status(404).json({ message: "Horse not found" });
    }

    // Check if horse is registered for this race
    const RaceRegistration = require("../models/RaceRegistration");
    const registration = await RaceRegistration.findOne({
      raceId,
      horseId,
      status: "CONFIRMED",
    });
    if (!registration) {
      return res.status(400).json({
        message: "Horse is not confirmed for this race",
      });
    }

    // Check if spectator already has a prediction for this race
    const existingPrediction = await Prediction.findOne({
      raceId,
      spectatorId,
    });
    if (existingPrediction) {
      return res.status(409).json({
        message: "You already have a prediction for this race",
      });
    }

    // Check points balance
    const user = await User.findById(spectatorId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (user.points < betAmount) {
      return res.status(400).json({ message: "INSUFFICIENT_POINTS" });
    }

    // Deduct points
    user.points -= betAmount;
    await user.save();

    // Create prediction
    const prediction = new Prediction({
      raceId,
      spectatorId,
      horseId,
      betAmount,
      predictedPosition: 1,
      prizeAmount: betAmount * BET_MULTIPLIER,
      status: "OPEN",
    });

    await prediction.save();

    const populatedPrediction = await Prediction.findById(prediction._id)
      .populate("horseId", "name")
      .populate("raceId", "name");

    res.status(201).json({
      message: "Prediction placed successfully",
      prediction: populatedPrediction,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /me/predictions — SPECTATOR: Get all my predictions
exports.getMyPredictions = async (req, res) => {
  try {
    const spectatorId = req.user._id;
    const { page = 1, limit = 10, status } = req.query;

    const filter = { spectatorId };
    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [predictions, total] = await Promise.all([
      Prediction.find(filter)
        .populate("raceId", "name scheduledAt")
        .populate("horseId", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Prediction.countDocuments(filter),
    ]);

    res.status(200).json({
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      predictions,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /me/predictions/:predId — SPECTATOR: Get prediction details
exports.getPredictionDetails = async (req, res) => {
  try {
    const { predId } = req.params;
    const spectatorId = req.user._id;

    const prediction = await Prediction.findById(predId)
      .populate("raceId", "name scheduledAt distance")
      .populate("horseId", "name breed")
      .populate("spectatorId", "fullName email");

    if (!prediction) {
      return res.status(404).json({ message: "Prediction not found" });
    }

    // Check authorization
    if (prediction.spectatorId._id.toString() !== spectatorId.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    res.status(200).json({
      prediction,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /me/notifications — SPECTATOR: Get notifications
exports.getNotifications = async (req, res) => {
  try {
    const spectatorId = req.user._id;
    const { page = 1, limit = 10, isRead } = req.query;

    const filter = { spectatorId };
    if (isRead !== undefined) filter.isRead = isRead === "true";

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [notifications, total] = await Promise.all([
      Notification.find(filter)
        .populate("raceId", "name")
        .populate("predictionId", "betAmount prizeAmount")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Notification.countDocuments(filter),
    ]);

    res.status(200).json({
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      notifications,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /admin/races/:raceId/predictions/close — ADMIN: Close predictions for a race
exports.closePredictions = async (req, res) => {
  try {
    const { raceId } = req.params;

    // Validate raceId format
    if (!mongoose.Types.ObjectId.isValid(raceId)) {
      return res.status(400).json({ message: "Invalid race ID format" });
    }

    const race = await Race.findById(raceId);
    if (!race) {
      return res.status(404).json({ message: "Race not found" });
    }

    // Close all OPEN predictions for this race
    const result = await Prediction.updateMany(
      { raceId, status: "OPEN" },
      {
        status: "CLOSED",
        closedAt: new Date(),
      },
    );

    res.status(200).json({
      message: "Predictions closed successfully",
      modifiedCount: result.modifiedCount,
      raceId,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /admin/races/:raceId/predictions/settle — ADMIN: Settle predictions after race result
exports.settlePredictions = async (req, res) => {
  try {
    const { raceId } = req.params;

    // Validate raceId format
    if (!mongoose.Types.ObjectId.isValid(raceId)) {
      return res.status(400).json({ message: "Invalid race ID format" });
    }

    // Get race results
    const results = await Result.find({ raceId });
    if (results.length === 0) {
      return res.status(400).json({
        message:
          "No results found for this race. Please publish results first.",
      });
    }

    // Get all closed predictions for this race
    const predictions = await Prediction.find({
      raceId,
      status: "CLOSED",
    });

    if (predictions.length === 0) {
      return res.status(400).json({
        message: "No closed predictions found for this race",
      });
    }

    // Create a map of horseId -> position from results
    const horsePositionMap = {};
    results.forEach((result) => {
      horsePositionMap[result.horseId] = result.position;
    });

    // Settle each prediction
    const settledPredictions = [];
    for (const prediction of predictions) {
      const horseId = prediction.horseId.toString();
      const actualPosition = horsePositionMap[horseId];

      let status = "LOST";
      let notificationType = "PREDICTION_LOST";
      let notificationMessage = `Your prediction for this race was lost. Your horse finished at position ${actualPosition || "N/A"}.`;
      let notificationTitle = "Prediction Lost";

      if (actualPosition === 1) {
        status = "WON";
        notificationType = "PREDICTION_WON";
        notificationMessage = `Congratulations! You won! Prize: ${prediction.prizeAmount.toLocaleString()} points`;
        notificationTitle = "Prediction Won!";

        // Credit points to spectator
        const spectator = await User.findById(prediction.spectatorId);
        if (spectator) {
          spectator.points = (spectator.points || 0) + prediction.prizeAmount;
          await spectator.save();
        }
      }

      // Update prediction
      prediction.status = status;
      prediction.actualPosition = actualPosition || null;
      prediction.settledAt = new Date();
      prediction.settledBy = req.user._id;
      await prediction.save();

      // Create notification
      const notification = new Notification({
        spectatorId: prediction.spectatorId,
        predictionId: prediction._id,
        raceId,
        type: notificationType,
        title: notificationTitle,
        message: notificationMessage,
        prizeAmount: status === "WON" ? prediction.prizeAmount : 0,
      });
      await notification.save();

      settledPredictions.push({
        predictionId: prediction._id,
        status,
        prizeAmount: prediction.prizeAmount,
      });
    }

    res.status(200).json({
      message: "Predictions settled successfully",
      raceId,
      settledCount: settledPredictions.length,
      settlements: settledPredictions,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /admin/predictions — ADMIN: Get all predictions
exports.getAllPredictions = async (req, res) => {
  try {
    const { raceId, status, page = 1, limit = 10 } = req.query;

    const filter = {};
    if (raceId) filter.raceId = raceId;
    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [predictions, total] = await Promise.all([
      Prediction.find(filter)
        .populate("raceId", "name")
        .populate("horseId", "name")
        .populate("spectatorId", "fullName email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Prediction.countDocuments(filter),
    ]);

    res.status(200).json({
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      predictions,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /admin/predictions/stats — ADMIN: Get prediction statistics by race
exports.getPredictionStats = async (req, res) => {
  try {
    const { raceId } = req.query;

    const filter = {};
    if (raceId) filter.raceId = raceId;

    // Aggregate stats
    const stats = await Prediction.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$raceId",
          totalBets: { $sum: "$betAmount" },
          totalPredictions: { $sum: 1 },
          wonCount: {
            $sum: { $cond: [{ $eq: ["$status", "WON"] }, 1, 0] },
          },
          totalPrizesPaid: {
            $sum: { $cond: [{ $eq: ["$status", "WON"] }, "$prizeAmount", 0] },
          },
        },
      },
      {
        $lookup: {
          from: "races",
          localField: "_id",
          foreignField: "_id",
          as: "race",
        },
      },
    ]);

    res.status(200).json({
      stats: stats.map((stat) => ({
        raceId: stat._id,
        raceName: stat.race[0]?.name,
        totalBets: stat.totalBets,
        totalPredictions: stat.totalPredictions,
        wonCount: stat.wonCount,
        lostCount: stat.totalPredictions - stat.wonCount,
        totalPrizesPaid: stat.totalPrizesPaid,
        profitMargin: stat.totalBets - stat.totalPrizesPaid,
      })),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
