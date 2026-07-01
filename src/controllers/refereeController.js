const Race = require('../models/Race');
const Horse = require('../models/Horse');
const Jockey = require('../models/Jockey');
const RaceRegistration = require('../models/RaceRegistration');
const Violation = require('../models/Violation');
const RaceResult = require('../models/RaceResult');
const RaceReport = require('../models/RaceReport');
const Invitation = require('../models/Invitation');
const { updateJockeyStats } = require('./jockeyController');

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
    if (!['ONGOING', 'COMPLETED'].includes(race.status)) {
      return res.status(400).json({
        message: 'RACE_NOT_FINISHED',
        detail: 'Race must be ONGOING or COMPLETED before confirming results',
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
    await Race.findByIdAndUpdate(req.params.raceId, { $set: { status: 'COMPLETED' } });

    // Update Jockey Stats
    const uniqueJockeyIds = [...new Set(rankings.map(r => r.jockeyId))];
    for (const jId of uniqueJockeyIds) {
      await updateJockeyStats(jId);
    }

    res.status(200).json({
      raceId: race._id,
      status: 'RESULT_CONFIRMED',
      confirmedAt: raceResult.confirmedAt,
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
