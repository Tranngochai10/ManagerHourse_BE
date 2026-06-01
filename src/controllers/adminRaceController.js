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
      .populate("horseId", "name breed owner")
      .populate("raceId", "name distance scheduledAt maxHorses")
      .sort({ createdAt: -1 });

    res.status(200).json({
      total: registrations.length,
      registrations: registrations.map((reg) => ({
        regId: reg._id,
        horseId: reg.horseId._id,
        horseName: reg.horseId.name,
        horseBreed: reg.horseId.breed,
        horseOwner: reg.horseId.owner,
        raceId: reg.raceId._id,
        raceName: reg.raceId.name,
        raceDistance: reg.raceId.distance,
        raceScheduledAt: reg.raceId.scheduledAt,
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
