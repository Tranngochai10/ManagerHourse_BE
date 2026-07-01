const Result = require("../models/Result");
const RaceResult = require("../models/RaceResult");
const { updateJockeyStats } = require("./jockeyController");
const Race = require("../models/Race");
const Horse = require("../models/Horse");
const Jockey = require("../models/Jockey");
const RaceRegistration = require("../models/RaceRegistration");

// GET /races/:raceId/results — Public: Get all results for a race
exports.getResultsByRace = async (req, res) => {
  try {
    const { raceId } = req.params;

    const race = await Race.findById(raceId);
    if (!race) {
      return res.status(404).json({ message: "Race not found" });
    }

    // Ưu tiên kết quả do trọng tài confirm (RaceResult)
    const raceResult = await RaceResult.findOne({ raceId })
      .populate("rankings.horseId", "name breed color")
      .populate("rankings.jockeyId", "fullName")
      .populate("confirmedBy", "fullName email");

    if (raceResult) {
      return res.status(200).json({
        raceId,
        raceName: race.name,
        source: "REFEREE_CONFIRMED",
        confirmedAt: raceResult.confirmedAt,
        confirmedBy: raceResult.confirmedBy,
        notes: raceResult.notes,
        rankings: raceResult.rankings,
      });
    }

    // Fallback: kết quả do admin publish (Result model cũ)
    const results = await Result.find({ raceId })
      .populate("horseId", "name breed color ownerId")
      .populate("jockeyId", "fullName")
      .sort({ position: 1 });

    res.status(200).json({
      raceId,
      raceName: race.name,
      source: "ADMIN_PUBLISHED",
      rankings: results,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// POST /admin/races/:raceId/publish-result — ADMIN: Publish race results
exports.publishRaceResult = async (req, res) => {
  try {
    const { raceId } = req.params;
    const { results } = req.body; // Array of { horseId, jockeyId, position, finishTime, status, prizeAmount }

    const race = await Race.findById(raceId);
    if (!race) {
      return res.status(404).json({ message: "Race not found" });
    }

    if (!Array.isArray(results) || results.length === 0) {
      return res
        .status(400)
        .json({ message: "Results array is required and cannot be empty" });
    }

    // Validate all horses are registered
    const horseIds = results.map((r) => r.horseId);
    const registrations = await RaceRegistration.find({
      raceId,
      horseId: { $in: horseIds },
    });

    if (registrations.length !== horseIds.length) {
      return res
        .status(400)
        .json({ message: "Some horses are not registered for this race" });
    }

    // Delete existing results for this race
    await Result.deleteMany({ raceId });

    // Create new results
    const createdResults = [];
    for (const result of results) {
      const newResult = new Result({
        raceId,
        horseId: result.horseId,
        jockeyId: result.jockeyId,
        position: result.position,
        finishTime: result.finishTime,
        status: result.status || "FINISHED",
        prizeAmount: result.prizeAmount || 0,
        notes: result.notes || "",
        publishedAt: new Date(),
        publishedBy: req.user._id,
      });
      createdResults.push(await newResult.save());
    }

    // Update race status to COMPLETED
    race.status = "COMPLETED";
    await race.save();

    // Populate results before sending
    const populatedResults = await Result.find({ raceId })
      .populate("horseId", "name breed")
      .populate("jockeyId", "fullName experience winRate");

    // Update Jockey Stats
    const uniqueJockeyIds = [...new Set(results.map(r => r.jockeyId))];
    for (const jId of uniqueJockeyIds) {
      await updateJockeyStats(jId);
    }

    // Trigger Auto-Advance check asynchronously if race belongs to a tournament
    if (race.tournamentId) {
      const { checkAndAdvanceRound } = require('../utils/autoAdvance');
      checkAndAdvanceRound(race.tournamentId, race._id).catch(err => console.error("[AutoAdvance] Error:", err));
    }

    res.status(201).json({
      message: "Race results published successfully",
      raceId,
      results: populatedResults,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /horses/me/:horseId/results — OWNER: Get all results for a specific horse
exports.getHorseResults = async (req, res) => {
  try {
    const { horseId } = req.params;

    // Check horse belongs to this owner
    const horse = await Horse.findById(horseId);
    if (!horse) {
      return res.status(404).json({ message: "Horse not found" });
    }
    if (horse.ownerId.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "Not authorized to view this horse's results" });
    }

    const results = await Result.find({ horseId })
      .populate("raceId", "name distance scheduledAt")
      .populate("jockeyId", "fullName")
      .sort({ createdAt: -1 });

    const stats = {
      totalRaces: results.length,
      wins: results.filter((r) => r.position === 1).length,
      topThree: results.filter((r) => r.position <= 3).length,
      totalPrizes: results.reduce((sum, r) => sum + r.prizeAmount, 0),
    };

    res.status(200).json({
      horseId,
      horseName: horse.name,
      stats,
      results,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /jockeys/me/results — JOCKEY: Get all results for this jockey
exports.getJockeyResults = async (req, res) => {
  try {
    const jockeyId = req.user._id; // Assuming jockey _id is stored in user

    const results = await Result.find({ jockeyId })
      .populate("raceId", "name distance scheduledAt")
      .populate("horseId", "name ownerId")
      .sort({ createdAt: -1 });

    const stats = {
      totalRaces: results.length,
      wins: results.filter((r) => r.position === 1).length,
      topThree: results.filter((r) => r.position <= 3).length,
      totalPrizes: results.reduce((sum, r) => sum + r.prizeAmount, 0),
    };

    res.status(200).json({
      jockeyId,
      stats,
      results,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /horses/me/:horseId/prize — OWNER: Get total prize earnings for a horse
exports.getHorsePrize = async (req, res) => {
  try {
    const { horseId } = req.params;

    // Check horse belongs to this owner
    const horse = await Horse.findById(horseId);
    if (!horse) {
      return res.status(404).json({ message: "Horse not found" });
    }
    if (horse.ownerId.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "Not authorized to view this horse's prize" });
    }

    const results = await Result.find({ horseId });
    const totalPrize = results.reduce((sum, r) => sum + r.prizeAmount, 0);

    const detailedPrizes = await Result.find({ horseId })
      .populate("raceId", "name scheduledAt")
      .sort({ createdAt: -1 });

    res.status(200).json({
      horseId,
      horseName: horse.name,
      totalPrize,
      prizeHistory: detailedPrizes.map((r) => ({
        raceId: r.raceId._id,
        raceName: r.raceId.name,
        position: r.position,
        prizeAmount: r.prizeAmount,
        date: r.raceId.scheduledAt,
      })),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /tournaments/:tournId/leaderboard — Public: Tournament leaderboard
exports.getTournamentLeaderboard = async (req, res) => {
  try {
    const { tournId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    // Get all races in this tournament
    const races = await Race.find({ tournamentId: tournId });
    const raceIds = races.map((r) => r._id);

    // Get all results for these races
    const results = await Result.find({ raceId: { $in: raceIds } }).populate(
      "horseId",
      "name ownerId",
    );

    // Group by horse and calculate stats
    const leaderboard = {};
    results.forEach((result) => {
      const horseId = result.horseId._id;
      if (!leaderboard[horseId]) {
        leaderboard[horseId] = {
          horseId,
          horseName: result.horseId.name,
          ownerId: result.horseId.ownerId,
          wins: 0,
          topThree: 0,
          totalRaces: 0,
          totalPrize: 0,
        };
      }
      leaderboard[horseId].totalRaces += 1;
      if (result.position === 1) leaderboard[horseId].wins += 1;
      if (result.position <= 3) leaderboard[horseId].topThree += 1;
      leaderboard[horseId].totalPrize += result.prizeAmount;
    });

    // Convert to array and sort by wins, then prize
    let leaderboardArray = Object.values(leaderboard).sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.totalPrize - a.totalPrize;
    });

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = leaderboardArray.length;
    leaderboardArray = leaderboardArray.slice(skip, skip + parseInt(limit));

    res.status(200).json({
      tournId,
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      leaderboard: leaderboardArray,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /jockeys/leaderboard — Public: Overall jockey leaderboard
exports.getJockeyLeaderboard = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    // Get all results
    const results = await Result.find().populate("jockeyId", "_id fullName");

    // Group by jockey and calculate stats
    const leaderboard = {};
    results.forEach((result) => {
      const jockeyId = result.jockeyId._id;
      if (!leaderboard[jockeyId]) {
        leaderboard[jockeyId] = {
          jockeyId,
          jockeyName: result.jockeyId.fullName,
          wins: 0,
          topThree: 0,
          totalRaces: 0,
          totalPrize: 0,
        };
      }
      leaderboard[jockeyId].totalRaces += 1;
      if (result.position === 1) leaderboard[jockeyId].wins += 1;
      if (result.position <= 3) leaderboard[jockeyId].topThree += 1;
      leaderboard[jockeyId].totalPrize += result.prizeAmount;
    });

    // Convert to array and sort by wins, then prize
    let leaderboardArray = Object.values(leaderboard).sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.totalPrize - a.totalPrize;
    });

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = leaderboardArray.length;
    leaderboardArray = leaderboardArray.slice(skip, skip + parseInt(limit));

    res.status(200).json({
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      leaderboard: leaderboardArray,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
