const Race = require('../models/Race');
const Horse = require('../models/Horse');
const Jockey = require('../models/Jockey');
const RaceRegistration = require('../models/RaceRegistration');
const Violation = require('../models/Violation');
const RaceResult = require('../models/RaceResult');
const RaceReport = require('../models/RaceReport');
const Invitation = require('../models/Invitation');
const Result = require('../models/Result');
const Prediction = require('../models/Prediction');
const Spectator = require('../models/Spectator');
const Notification = require('../models/Notification');
const mongoose = require('mongoose');
const { updateJockeyStats } = require('./jockeyController');

const { checkAndAdvanceRound } = require('../utils/autoAdvance');

// ─── Helper ──────────────────────────────────────────────────────────────────

/**
 * Verify the requesting referee is assigned to the race.
 * Returns the race document or throws/responds with an error.
 */
const getAssignedRace = async (raceId, refereeId, res) => {
  const race = await Race.findById(raceId);
  if (!race) {
    res.status(404).json({ message: 'Race not found' });
    return null;
  }
  if (!race.refereeId || race.refereeId.toString() !== refereeId.toString()) {
    res.status(403).json({ message: 'You are not assigned as referee for this race' });
    return null;
  }
  return race;
};

// ─── GET /referee/races ───────────────────────────────────────────────────────

/**
 * @desc  Danh sách cuộc đua được phân công cho trọng tài đang đăng nhập
 * @route GET /referee/races
 * @access REFEREE
 */
exports.getAssignedRaces = async (req, res) => {
  try {
    const races = await Race.find({ refereeId: req.user._id })
      .populate('tournamentId', 'name startDate endDate')
      .sort({ scheduledAt: 1 });

    res.status(200).json(races);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── GET /referee/races/:raceId/horses ───────────────────────────────────────

/**
 * @desc  Kiểm tra thông tin ngựa trước đua (danh sách ngựa đã được duyệt cho cuộc đua)
 * @route GET /referee/races/:raceId/horses
 * @access REFEREE
 */
exports.getHorsesForRace = async (req, res) => {
  try {
    const race = await getAssignedRace(req.params.raceId, req.user._id, res);
    if (!race) return;

    const [registrations, invitations] = await Promise.all([
      RaceRegistration.find({
        raceId: req.params.raceId,
        status: { $in: ['APPROVED', 'CONFIRMED'] },
      }).populate({
        path: 'horseId',
        select: 'name breed age weight color gender origin healthCertUrl status ownerId',
        populate: { path: 'ownerId', select: 'fullName email phone' },
      }),
      Invitation.find({ raceId: req.params.raceId, status: 'ACCEPTED' })
        .populate({
          path: 'jockeyId',
          populate: { path: 'userId', select: 'fullName' }
        })
    ]);

    const jockeyMap = {};
    invitations.forEach((inv) => {
      if (inv.horseId) {
        let jockeyId = null;
        let jockeyName = null;

        if (inv.jockeyId) {
          jockeyId = inv.jockeyId._id;
          if (inv.jockeyId.userId) {
            jockeyName = inv.jockeyId.userId.fullName;
          }
        }

        jockeyMap[inv.horseId.toString()] = {
          jockeyId,
          jockeyName,
        };
      }
    });

    const horses = registrations.map((reg) => {
      const horseIdStr = reg.horseId ? reg.horseId._id.toString() : '';
      const jockeyInfo = jockeyMap[horseIdStr] || { jockeyId: null, jockeyName: null };
      return {
        registrationId: reg._id,
        registrationStatus: reg.status,
        confirmedByOwner: reg.confirmedByOwner,
        horse: reg.horseId,
        jockeyId: jockeyInfo.jockeyId,
        jockeyName: jockeyInfo.jockeyName,
      };
    });

    res.status(200).json({ raceId: race._id, raceName: race.name, horses });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── POST /referee/races/:raceId/violations ──────────────────────────────────

/**
 * @desc  Ghi nhận vi phạm trong đua
 * @route POST /referee/races/:raceId/violations
 * @access REFEREE
 */
exports.createViolation = async (req, res) => {
  try {
    const race = await getAssignedRace(req.params.raceId, req.user._id, res);
    if (!race) return;

    const { horseId, jockeyId, type, description, penalty, fineAmount } = req.body;

    if (!horseId || !jockeyId || !type || !description || !penalty) {
      return res.status(400).json({
        message: 'horseId, jockeyId, type, description, and penalty are required',
      });
    }

    // Validate horse belongs to this race
    const registration = await RaceRegistration.findOne({
      raceId: req.params.raceId,
      horseId,
      status: { $in: ['APPROVED', 'CONFIRMED'] },
    });
    if (!registration) {
      return res.status(404).json({ message: 'Horse is not registered / approved for this race' });
    }

    // Validate jockey exists
    const jockey = await Jockey.findById(jockeyId);
    if (!jockey) {
      return res.status(404).json({ message: 'Jockey not found' });
    }

    const violation = new Violation({
      raceId: req.params.raceId,
      horseId,
      jockeyId,
      type,
      description,
      penalty,
      fineAmount: penalty === 'FINE' ? (fineAmount || 0) : null,
      status: 'OPEN',
      createdBy: req.user._id,
    });

    await violation.save();

    res.status(201).json({
      violationId: violation._id,
      status: violation.status,
      createdAt: violation.createdAt,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── GET /referee/races/:raceId/violations ───────────────────────────────────

/**
 * @desc  Xem danh sách vi phạm của cuộc đua
 * @route GET /referee/races/:raceId/violations
 * @access REFEREE, ADMIN
 */
exports.getViolations = async (req, res) => {
  try {
    const race = await Race.findById(req.params.raceId);
    if (!race) {
      return res.status(404).json({ message: 'Race not found' });
    }

    // REFEREEs must be assigned to the race; ADMINs have unrestricted access
    if (req.user.role === 'REFEREE') {
      if (!race.refereeId || race.refereeId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'You are not assigned as referee for this race' });
      }
    }

    const violations = await Violation.find({ raceId: req.params.raceId })
      .populate('horseId', 'name breed')
      .populate('jockeyId', 'fullName')
      .populate('createdBy', 'fullName')
      .populate('resolvedBy', 'fullName')
      .sort({ createdAt: -1 });

    res.status(200).json({ raceId: race._id, raceName: race.name, violations });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── PATCH /referee/violations/:vId/resolve ──────────────────────────────────

/**
 * @desc  Xử lý / đóng vi phạm
 * @route PATCH /referee/violations/:vId/resolve
 * @access REFEREE
 */
exports.resolveViolation = async (req, res) => {
  try {
    const violation = await Violation.findById(req.params.vId);
    if (!violation) {
      return res.status(404).json({ message: 'Violation not found' });
    }

    // Verify the referee is assigned to the race this violation belongs to
    const race = await getAssignedRace(violation.raceId, req.user._id, res);
    if (!race) return;

    if (violation.status === 'RESOLVED') {
      return res.status(400).json({ message: 'Violation is already resolved' });
    }

    const { resolutionNote } = req.body;

    violation.status = 'RESOLVED';
    violation.resolvedBy = req.user._id;
    violation.resolvedAt = new Date();
    violation.resolutionNote = resolutionNote || '';

    await violation.save();

    res.status(200).json({
      violationId: violation._id,
      status: violation.status,
      resolvedAt: violation.resolvedAt,
      resolutionNote: violation.resolutionNote,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const parseFinishTimeToSeconds = (timeVal) => {
  if (timeVal === undefined || timeVal === null || timeVal === '') {
    return 0;
  }
  if (typeof timeVal === 'number') {
    return timeVal;
  }
  const str = String(timeVal).trim();
  if (str.includes(':')) {
    const parts = str.split(':');
    const minutes = parseFloat(parts[0]) || 0;
    const seconds = parseFloat(parts[1]) || 0;
    return minutes * 60 + seconds;
  }
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
};

// ─── POST /referee/races/:raceId/confirm-result ──────────────────────────────

/**
 * @desc  Xác nhận kết quả cuộc đua
 * @route POST /referee/races/:raceId/confirm-result
 * @access REFEREE
 */
exports.confirmResult = async (req, res) => {
  try {
    const race = await getAssignedRace(req.params.raceId, req.user._id, res);
    if (!race) return;

    // Race must be COMPLETED (ONGOING or COMPLETED - depending on workflow)
    if (!['ONGOING', 'COMPLETED', 'RESULT_CONFIRMED'].includes(race.status)) {
      return res.status(400).json({
        message: 'RACE_NOT_FINISHED',
        detail: 'Race must be ONGOING, COMPLETED or RESULT_CONFIRMED before confirming results',
      });
    }

    // Check for unresolved (OPEN) violations
    const openViolations = await Violation.countDocuments({
      raceId: req.params.raceId,
      status: 'OPEN',
    });
    if (openViolations > 0) {
      return res.status(409).json({
        message: 'OPEN_VIOLATIONS_EXIST',
        detail: `There are ${openViolations} unresolved violation(s). Resolve them before confirming results.`,
      });
    }

    const { rankings, notes } = req.body;

    if (!rankings || !Array.isArray(rankings) || rankings.length === 0) {
      return res.status(400).json({ message: 'rankings array is required and must not be empty' });
    }

    // Validate each ranking entry
    for (const r of rankings) {
      if (!r.position || !r.horseId || !r.jockeyId || !r.finishTime) {
        return res.status(400).json({
          message: 'Each ranking must have position, horseId, jockeyId, and finishTime',
        });
      }
    }

    // Upsert result (allow re-confirmation)
    // Dùng $set rõ ràng để tránh lỗi runValidators với required fields khi update
    const raceResult = await RaceResult.findOneAndUpdate(
      { raceId: req.params.raceId },
      {
        $set: {
          raceId: req.params.raceId,
          rankings,
          notes: notes || '',
          confirmedBy: req.user._id,
          confirmedAt: new Date(),
        },
      },
      { upsert: true, new: true, runValidators: false }
    );

    // Update race status to COMPLETED
    const updatedRace = await Race.findByIdAndUpdate(
      req.params.raceId, 
      { $set: { status: 'RESULT_CONFIRMED' } },
      { new: true }
    );

    // Update Jockey Stats
    const uniqueJockeyIds = [...new Set(rankings.map(r => r.jockeyId))];
    for (const jId of uniqueJockeyIds) {
      await updateJockeyStats(jId);
    }

    // 1. Tự động đồng bộ sang bảng Result chính thức
    await Result.deleteMany({ raceId: req.params.raceId });
    for (const r of rankings) {
      const newResult = new Result({
        raceId: req.params.raceId,
        horseId: r.horseId,
        jockeyId: r.jockeyId,
        position: r.position,
        finishTime: parseFinishTimeToSeconds(r.finishTime),
        status: 'FINISHED',
        prizeAmount: 0,
        notes: notes || '',
        publishedAt: new Date(),
        publishedBy: req.user._id,
      });
      await newResult.save();
    }

    // 2. Tự động quyết toán điểm cược và trả thưởng (Settle Predictions)
    const predictions = await Prediction.find({
      raceId: req.params.raceId,
      status: { $in: ['OPEN', 'CLOSED'] },
    });

    const horsePositionMap = {};
    rankings.forEach((r) => {
      horsePositionMap[r.horseId.toString()] = r.position;
    });

    for (const prediction of predictions) {
      const horseIdStr = prediction.horseId.toString();
      const actualPosition = horsePositionMap[horseIdStr];

      let status = 'LOST';
      let notificationType = 'PREDICTION_LOST';
      let notificationMessage = `Your prediction for this race was lost. Your horse finished at position ${actualPosition || 'N/A'}.`;
      let notificationTitle = 'Prediction Lost';

      if (actualPosition === 1) {
        status = 'WON';
        notificationType = 'PREDICTION_WON';
        notificationMessage = `Congratulations! You won! Prize: ${prediction.prizeAmount.toLocaleString()} points`;
        notificationTitle = 'Prediction Won!';

        // Cộng điểm ví cho spectator
        await Spectator.updateOne(
          { userId: prediction.spectatorId },
          { $inc: { points: prediction.prizeAmount } }
        );
      }

      // Cập nhật trạng thái prediction
      prediction.status = status;
      prediction.actualPosition = actualPosition || null;
      prediction.settledAt = new Date();
      prediction.settledBy = req.user._id;
      await prediction.save();

      // Tạo thông báo cho spectator
      const notification = new Notification({
        spectatorId: prediction.spectatorId,
        predictionId: prediction._id,
        raceId: req.params.raceId,
        type: notificationType,
        title: notificationTitle,
        message: notificationMessage,
        prizeAmount: status === 'WON' ? prediction.prizeAmount : 0,
      });
      await notification.save();
    }

    // Trigger Auto-Advance check asynchronously if race belongs to a tournament
    if (updatedRace && updatedRace.tournamentId) {
      checkAndAdvanceRound(updatedRace.tournamentId, updatedRace._id).catch(err => console.error("[AutoAdvance] Error:", err));
    }

    res.status(200).json({
      raceId: race._id,
      status: 'RESULT_CONFIRMED',
      confirmedAt: raceResult.confirmedAt,
      settledCount: predictions.length,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── POST /referee/races/:raceId/report ──────────────────────────────────────

/**
 * @desc  Lập biên bản thi đấu
 * @route POST /referee/races/:raceId/report
 * @access REFEREE
 */
exports.createReport = async (req, res) => {
  try {
    const race = await getAssignedRace(req.params.raceId, req.user._id, res);
    if (!race) return;

    const {
      summary,
      weatherCondition,
      trackCondition,
      incidentDetails,
      additionalNotes,
    } = req.body;

    // Count participants and violations for auto-fill
    const totalParticipants = await RaceRegistration.countDocuments({
      raceId: req.params.raceId,
      status: { $in: ['APPROVED', 'CONFIRMED'] },
    });
    const totalViolations = await Violation.countDocuments({ raceId: req.params.raceId });

    // Upsert report
    const report = await RaceReport.findOneAndUpdate(
      { raceId: req.params.raceId },
      {
        raceId: req.params.raceId,
        refereeId: req.user._id,
        summary: summary || '',
        weatherCondition: weatherCondition || '',
        trackCondition: trackCondition || '',
        totalParticipants,
        totalViolations,
        incidentDetails: incidentDetails || '',
        additionalNotes: additionalNotes || '',
      },
      { upsert: true, new: true, runValidators: true }
    );

    res.status(201).json({
      reportId: report._id,
      raceId: report.raceId,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── GET /referee/races/:raceId/report ───────────────────────────────────────

/**
 * @desc  Xem biên bản thi đấu
 * @route GET /referee/races/:raceId/report
 * @access REFEREE, ADMIN
 */
exports.getReport = async (req, res) => {
  try {
    const race = await Race.findById(req.params.raceId);
    if (!race) {
      return res.status(404).json({ message: 'Race not found' });
    }

    // REFEREEs must be assigned; ADMINs have full access
    if (req.user.role === 'REFEREE') {
      if (!race.refereeId || race.refereeId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'You are not assigned as referee for this race' });
      }
    }

    const report = await RaceReport.findOne({ raceId: req.params.raceId })
      .populate('refereeId', 'fullName email');

    if (!report) {
      return res.status(404).json({ message: 'Report not found for this race' });
    }

    res.status(200).json(report);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── GET /referee/races/:raceId/confirmed-result ──────────────────────────────

/**
 * @desc  Xem kết quả cuộc đua đã xác nhận
 * @route GET /referee/races/:raceId/confirmed-result
 * @access REFEREE, ADMIN
 */
exports.getConfirmedResult = async (req, res) => {
  try {
    const race = await getAssignedRace(req.params.raceId, req.user._id, res);
    if (!race) return;

    const raceResult = await RaceResult.findOne({ raceId: req.params.raceId })
      .populate({
        path: 'rankings.horseId',
        select: 'name breed color'
      })
      .populate({
        path: 'rankings.jockeyId',
        populate: { path: 'userId', select: 'fullName' }
      });

    if (!raceResult) {
      return res.status(404).json({ message: 'No confirmed result found for this race' });
    }

    res.status(200).json(raceResult);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
