const mongoose = require('mongoose');
const Tournament = require('../models/Tournament');
const Prediction = require('../models/Prediction');
const User = require('../models/User');
const Race = require('../models/Race');
const Horse = require('../models/Horse');
const Result = require('../models/Result');
const Spectator = require('../models/Spectator');

// GET /admin/dashboard/stats
exports.getAdminDashboardStats = async (req, res) => {
  try {
    // 1. Financials
    const tournaments = await Tournament.find({ isDeleted: { $ne: true } });
    const totalPrizePool = tournaments.reduce((sum, t) => sum + (t.prizePool || 0), 0);

    const predictionFinancials = await Prediction.aggregate([
      {
        $group: {
          _id: null,
          totalBets: { $sum: "$betAmount" },
          totalPayouts: {
            $sum: {
              $cond: [{ $eq: ["$status", "WON"] }, "$prizeAmount", 0]
            }
          }
        }
      }
    ]);

    const totalBets = predictionFinancials.length > 0 ? predictionFinancials[0].totalBets : 0;
    const totalPayouts = predictionFinancials.length > 0 ? predictionFinancials[0].totalPayouts : 0;
    const netCommission = totalBets - totalPayouts;

    // 2. Prediction Donut
    const predictionStatusCounts = await Prediction.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);
    const predictionDonut = { WON: 0, LOST: 0, PENDING: 0 };
    predictionStatusCounts.forEach(item => {
      if (item._id === 'WON') predictionDonut.WON = item.count;
      else if (item._id === 'LOST') predictionDonut.LOST = item.count;
      else predictionDonut.PENDING += item.count;
    });

    // 3. Roles Count
    const userRoleCounts = await User.aggregate([
      { $group: { _id: "$role", count: { $sum: 1 } } }
    ]);
    const rolesCount = { SPECTATOR: 0, OWNER: 0, JOCKEY: 0, REFEREE: 0, ADMIN: 0 };
    userRoleCounts.forEach(item => {
      if (rolesCount.hasOwnProperty(item._id)) {
        rolesCount[item._id] = item.count;
      }
    });

    // 4. Race Status
    const raceStatusCounts = await Race.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);
    const raceStatus = { COMPLETED: 0, SCHEDULED: 0, ONGOING: 0, CANCELLED: 0 };
    raceStatusCounts.forEach(item => {
      if (item._id === 'COMPLETED' || item._id === 'RESULT_CONFIRMED' || item._id === 'FINISHED') {
        raceStatus.COMPLETED += item.count;
      } else if (item._id === 'SCHEDULED' || item._id === 'PENDING') {
        raceStatus.SCHEDULED += item.count;
      } else if (item._id === 'ONGOING' || item._id === 'RUNNING' || item._id === 'LIVE') {
        raceStatus.ONGOING += item.count;
      } else if (item._id === 'CANCELLED') {
        raceStatus.CANCELLED += item.count;
      }
    });

    // 5. Monthly Data (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const monthlyAggregate = await Prediction.aggregate([
      {
        $match: {
          createdAt: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" }
          },
          bets: { $sum: "$betAmount" },
          payouts: {
            $sum: {
              $cond: [{ $eq: ["$status", "WON"] }, "$prizeAmount", 0]
            }
          }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    const monthlyData = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mNum = d.getMonth() + 1;
      const yNum = d.getFullYear();
      
      const found = monthlyAggregate.find(item => item._id.month === mNum && item._id.year === yNum);
      monthlyData.push({
        month: `T.${mNum}`,
        bets: found ? found.bets : 0,
        payouts: found ? found.payouts : 0
      });
    }

    res.status(200).json({
      financials: {
        totalPrizePool,
        totalBets,
        totalPayouts,
        netCommission
      },
      predictionDonut,
      rolesCount,
      raceStatus,
      monthlyData
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /admin/predictions/race-stats
exports.getPredictionRaceStats = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, status } = req.query;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const skipNum = (pageNum - 1) * limitNum;

    const matchStage = {};
    if (status) {
      matchStage.status = status;
    }
    if (search) {
      matchStage.name = { $regex: search, $options: 'i' };
    }

    const pipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: 'predictions',
          localField: '_id',
          foreignField: 'raceId',
          as: 'preds'
        }
      },
      {
        $lookup: {
          from: 'tournaments',
          localField: 'tournamentId',
          foreignField: '_id',
          as: 'tourn'
        }
      },
      {
        $project: {
          id: "$_id",
          name: 1,
          scheduledAt: 1,
          status: 1,
          tournamentId: {
            $let: {
              vars: { t: { $arrayElemAt: ["$tourn", 0] } },
              in: { id: "$$t._id", name: "$$t.name" }
            }
          },
          betCount: { $size: "$preds" },
          totalBets: { $sum: "$preds.betAmount" },
          totalPayouts: {
            $sum: {
              $map: {
                input: "$preds",
                as: "p",
                in: { $cond: [{ $eq: ["$$p.status", "WON"] }, "$$p.prizeAmount", 0] }
              }
            }
          }
        }
      },
      {
        $addFields: {
          profit: { $subtract: ["$totalBets", "$totalPayouts"] }
        }
      }
    ];

    const totalCountRes = await Race.aggregate([...pipeline, { $count: "count" }]);
    const total = totalCountRes.length > 0 ? totalCountRes[0].count : 0;

    const data = await Race.aggregate([
      ...pipeline,
      { $sort: { scheduledAt: -1 } },
      { $skip: skipNum },
      { $limit: limitNum }
    ]);

    res.status(200).json({
      data,
      total,
      page: pageNum,
      limit: limitNum
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /owner/stats
exports.getOwnerStats = async (req, res) => {
  try {
    const ownerId = req.user._id;

    // 1. Get owned horses
    const horses = await Horse.find({ ownerId });
    const horseIds = horses.map(h => h._id);

    const totalHorses = horses.length;

    // 2. Query results
    const results = await Result.find({ horseId: { $in: horseIds } });
    const totalRacesParticipated = results.length;

    // 3. Win rate
    const wins = results.filter(r => r.position === 1).length;
    const winRate = totalRacesParticipated > 0 ? parseFloat(((wins / totalRacesParticipated) * 100).toFixed(2)) : 0;

    // 4. Total prize money won
    const totalPrizeMoney = results.reduce((sum, r) => sum + (r.prizeAmount || 0), 0);

    res.status(200).json({
      totalHorses,
      totalRacesParticipated,
      winRate,
      totalPrizeMoney
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
