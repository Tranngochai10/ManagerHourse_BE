const Race = require("../models/Race");
const Tournament = require("../models/Tournament");
const User = require("../models/User");
const RaceRegistration = require("../models/RaceRegistration");
const Horse = require("../models/Horse");

// POST /admin/races
exports.createRace = async (req, res) => {
  try {
    const {
      tournamentId,
      name,
      distance,
      scheduledAt,
      maxHorses,
      prizeFirst,
      prizeSecond,
      prizeThird,
    } = req.body;

    // Check tournament exists
    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) {
      return res.status(404).json({ message: "Tournament not found" });
    }

    // Validate scheduledAt is within tournament date range
    const scheduled = new Date(scheduledAt);
    if (isNaN(scheduled)) {
      return res.status(400).json({ message: "Invalid scheduledAt date" });
    }
    if (scheduled < tournament.startDate || scheduled > tournament.endDate) {
      return res.status(400).json({
        message: `Race must be scheduled between ${tournament.startDate.toISOString()} and ${tournament.endDate.toISOString()}`,
      });
    }

    const race = new Race({
      tournamentId,
      name,
      distance,
      scheduledAt: scheduled,
      maxHorses,
      prizeFirst: prizeFirst || 0,
      prizeSecond: prizeSecond || 0,
      prizeThird: prizeThird || 0,
      status: "SCHEDULED",
      createdBy: req.user._id,
    });

    await race.save();

    res.status(201).json({
      raceId: race._id,
      name: race.name,
      tournamentId: race.tournamentId,
      distance: race.distance,
      scheduledAt: race.scheduledAt,
      maxHorses: race.maxHorses,
      prizeFirst: race.prizeFirst,
      prizeSecond: race.prizeSecond,
      prizeThird: race.prizeThird,
      status: race.status,
      createdAt: race.createdAt,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// PUT /admin/races/:raceId
exports.updateRace = async (req, res) => {
  try {
    const race = await Race.findById(req.params.raceId);
    if (!race) {
      return res.status(404).json({ message: "Race not found" });
    }

    // Prevent updates to completed/cancelled races
    if (["COMPLETED", "CANCELLED"].includes(race.status)) {
      return res
        .status(400)
        .json({ message: "Cannot update a completed or cancelled race" });
    }

    const {
      name,
      distance,
      scheduledAt,
      maxHorses,
      prizeFirst,
      prizeSecond,
      prizeThird,
      status,
    } = req.body;

    if (name) race.name = name;
    if (distance) race.distance = distance;
    if (maxHorses) race.maxHorses = maxHorses;
    if (prizeFirst !== undefined) race.prizeFirst = prizeFirst;
    if (prizeSecond !== undefined) race.prizeSecond = prizeSecond;
    if (prizeThird !== undefined) race.prizeThird = prizeThird;
    if (status) race.status = status;

    if (scheduledAt) {
      const scheduled = new Date(scheduledAt);
      if (isNaN(scheduled)) {
        return res.status(400).json({ message: "Invalid scheduledAt date" });
      }
      // Validate against tournament dates
      const tournament = await Tournament.findById(race.tournamentId);
      if (
        tournament &&
        (scheduled < tournament.startDate || scheduled > tournament.endDate)
      ) {
        return res.status(400).json({
          message: `Race must be scheduled between ${tournament.startDate.toISOString()} and ${tournament.endDate.toISOString()}`,
        });
      }
      race.scheduledAt = scheduled;
    }

    const updated = await race.save();
    res.status(200).json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// POST /admin/races/:raceId/assign-referee
exports.assignReferee = async (req, res) => {
  try {
    const race = await Race.findById(req.params.raceId);
    if (!race) {
      return res.status(404).json({ message: "Race not found" });
    }

    const { refereeId } = req.body;
    if (!refereeId) {
      return res.status(400).json({ message: "refereeId is required" });
    }

    // Verify the user exists and has REFEREE role
    const referee = await User.findById(refereeId);
    if (!referee) {
      return res.status(404).json({ message: "User not found" });
    }
    if (referee.role !== "REFEREE") {
      return res.status(400).json({ message: "User is not a REFEREE" });
    }

    race.refereeId = refereeId;
    await race.save();

    res.status(200).json({
      raceId: race._id,
      name: race.name,
      refereeId: race.refereeId,
      refereeName: referee.fullName,
      message: "Referee assigned successfully",
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// GET /admin/races/registrations
exports.getRaceRegistrations = async (req, res) => {
  try {
    const { raceId, status } = req.query;

    // Build query filter
    const filter = {};
    if (raceId) filter.raceId = raceId;
    if (status) filter.status = status;

    // Fetch registrations with populated references
    const registrations = await RaceRegistration.find(filter)
      .populate({
        path: "horseId",
        select: "name breed ownerId",
        populate: {
          path: "ownerId",
          select: "fullName email",
        },
      })
      .populate("raceId", "name distance scheduledAt maxHorses")
      .sort({ createdAt: -1 });

    res.status(200).json({
      total: registrations.length,
      registrations: registrations.map((reg) => ({
        regId: reg._id,
        horseId: reg.horseId ? reg.horseId._id : null,
        horseName: reg.horseId ? reg.horseId.name : null,
        horseBreed: reg.horseId ? reg.horseId.breed : null,
        horseOwner: reg.horseId ? reg.horseId.ownerId : null,
        raceId: reg.raceId ? reg.raceId._id : null,
        raceName: reg.raceId ? reg.raceId.name : null,
        raceDistance: reg.raceId ? reg.raceId.distance : null,
        raceScheduledAt: reg.raceId ? reg.raceId.scheduledAt : null,
        status: reg.status,
        confirmedByOwner: reg.confirmedByOwner,
        createdAt: reg.createdAt,
        updatedAt: reg.updatedAt,
      })),
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// PATCH /admin/races/registrations/:regId/approve
exports.approveRaceRegistration = async (req, res) => {
  try {
    const registration = await RaceRegistration.findById(req.params.regId)
      .populate("horseId", "name breed")
      .populate("raceId", "name distance");

    if (!registration) {
      return res.status(404).json({ message: "Registration not found" });
    }

    // Only approve if status is PENDING_APPROVAL
    if (registration.status !== "PENDING_APPROVAL") {
      return res.status(400).json({
        message: `Cannot approve registration with status: ${registration.status}`,
      });
    }

    registration.status = "APPROVED";
    await registration.save();

    res.status(200).json({
      regId: registration._id,
      horseId: registration.horseId._id,
      horseName: registration.horseId.name,
      raceId: registration.raceId._id,
      raceName: registration.raceId.name,
      status: registration.status,
      message: "Registration approved successfully",
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// PATCH /admin/races/registrations/:regId/reject
exports.rejectRaceRegistration = async (req, res) => {
  try {
    const { reason } = req.body;
    const registration = await RaceRegistration.findById(req.params.regId)
      .populate("horseId", "name breed")
      .populate("raceId", "name distance");

    if (!registration) {
      return res.status(404).json({ message: "Registration not found" });
    }

    // Only reject if status is PENDING_APPROVAL
    if (registration.status !== "PENDING_APPROVAL") {
      return res.status(400).json({
        message: `Cannot reject registration with status: ${registration.status}`,
      });
    }

    registration.status = "REJECTED";
    registration.rejectionReason = reason || "No reason provided";
    await registration.save();

    res.status(200).json({
      regId: registration._id,
      horseId: registration.horseId._id,
      horseName: registration.horseId.name,
      raceId: registration.raceId._id,
      raceName: registration.raceId.name,
      status: registration.status,
      rejectionReason: registration.rejectionReason,
      message: "Registration rejected successfully",
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// POST /admin/races/:raceId/assign-horse
exports.assignHorse = async (req, res) => {
  try {
    const race = await Race.findById(req.params.raceId);
    if (!race) {
      return res.status(404).json({ message: 'Race not found' });
    }

    if (['COMPLETED', 'CANCELLED'].includes(race.status)) {
      return res.status(400).json({ message: 'Cannot assign horse to a completed or cancelled race' });
    }

    const { horseId } = req.body;
    if (!horseId) {
      return res.status(400).json({ message: 'horseId is required' });
    }

    // Kiểm tra ngựa tồn tại và đã được approved
    const horse = await Horse.findById(horseId);
    if (!horse) {
      return res.status(404).json({ message: 'Horse not found' });
    }
    if (horse.status !== 'APPROVED') {
      return res.status(400).json({ message: `Horse must be APPROVED. Current status: ${horse.status}` });
    }

    // Kiểm tra số lượng ngựa hiện tại trong race
    const currentCount = await RaceRegistration.countDocuments({
      raceId: race._id,
      status: { $in: ['PENDING_APPROVAL', 'APPROVED', 'CONFIRMED'] },
    });
    if (currentCount >= race.maxHorses) {
      return res.status(400).json({ message: `Race is full. Max horses: ${race.maxHorses}` });
    }

    // Tạo RaceRegistration (throw 11000 nếu đã tồn tại)
    const reg = new RaceRegistration({
      horseId,
      raceId: race._id,
      status: 'APPROVED',
      confirmedByOwner: false,
    });
    await reg.save();

    return res.status(201).json({
      registrationId: reg._id,
      raceId: race._id,
      raceName: race.name,
      horseId: horse._id,
      horseName: horse.name,
      status: reg.status,
      message: 'Horse assigned to race successfully',
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'This horse is already registered to this race' });
    }
    res.status(500).json({ message: error.message });
  }
};

// POST /admin/races/advance-winner
// Chuyển ngựa thắng (vị trí 1) từ race hiện tại sang race vòng tiếp theo
exports.advanceWinner = async (req, res) => {
  try {
    const { fromRaceId, toRaceId, topN = 1 } = req.body;

    if (!fromRaceId || !toRaceId) {
      return res.status(400).json({ message: 'fromRaceId and toRaceId are required' });
    }

    const fromRace = await Race.findById(fromRaceId);
    if (!fromRace) {
      return res.status(404).json({ message: 'Source race (fromRaceId) not found' });
    }
    if (fromRace.status !== 'COMPLETED') {
      return res.status(400).json({ message: 'Source race must be COMPLETED before advancing winners' });
    }

    const toRace = await Race.findById(toRaceId);
    if (!toRace) {
      return res.status(404).json({ message: 'Target race (toRaceId) not found' });
    }
    if (['COMPLETED', 'CANCELLED'].includes(toRace.status)) {
      return res.status(400).json({ message: 'Target race must not be COMPLETED or CANCELLED' });
    }

    // Lấy kết quả của race nguồn, sắp xếp theo vị trí
    const Result = require('../models/Result');
    const winners = await Result.find({ raceId: fromRaceId, status: 'FINISHED' })
      .sort({ position: 1 })
      .limit(topN)
      .populate('horseId', 'name status');

    if (winners.length === 0) {
      return res.status(400).json({ message: 'No finished results found for source race' });
    }

    // Kiểm tra slot còn trống của race đích
    const toRaceCount = await RaceRegistration.countDocuments({
      raceId: toRaceId,
      status: { $in: ['PENDING_APPROVAL', 'APPROVED', 'CONFIRMED'] },
    });
    if (toRaceCount + winners.length > toRace.maxHorses) {
      return res.status(400).json({
        message: `Target race does not have enough slots. Available: ${toRace.maxHorses - toRaceCount}, Need: ${winners.length}`,
      });
    }

    // Assign từng winner vào race đích
    const assigned = [];
    const skipped = [];
    for (const winner of winners) {
      try {
        const reg = new RaceRegistration({
          horseId: winner.horseId._id,
          raceId: toRaceId,
          status: 'APPROVED',
          confirmedByOwner: false,
        });
        await reg.save();
        assigned.push({ horseId: winner.horseId._id, horseName: winner.horseId.name, position: winner.position });
      } catch (dupErr) {
        if (dupErr.code === 11000) {
          skipped.push({ horseId: winner.horseId._id, horseName: winner.horseId.name, reason: 'Already registered' });
        } else {
          throw dupErr;
        }
      }
    }

    return res.status(200).json({
      message: `Advanced ${assigned.length} winner(s) from race "${fromRace.name}" to race "${toRace.name}"`,
      fromRace: { id: fromRace._id, name: fromRace.name },
      toRace: { id: toRace._id, name: toRace.name },
      assigned,
      skipped,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
