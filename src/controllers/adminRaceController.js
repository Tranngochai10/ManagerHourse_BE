const Race = require('../models/Race');
const Tournament = require('../models/Tournament');
const User = require('../models/User');

// POST /admin/races
exports.createRace = async (req, res) => {
  try {
    const { tournamentId, name, distance, scheduledAt, maxHorses, prizeFirst, prizeSecond, prizeThird } = req.body;

    // Check tournament exists
    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) {
      return res.status(404).json({ message: 'Tournament not found' });
    }

    // Validate scheduledAt is within tournament date range
    const scheduled = new Date(scheduledAt);
    if (isNaN(scheduled)) {
      return res.status(400).json({ message: 'Invalid scheduledAt date' });
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
      status: 'SCHEDULED',
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
      return res.status(404).json({ message: 'Race not found' });
    }

    // Prevent updates to completed/cancelled races
    if (['COMPLETED', 'CANCELLED'].includes(race.status)) {
      return res.status(400).json({ message: 'Cannot update a completed or cancelled race' });
    }

    const { name, distance, scheduledAt, maxHorses, prizeFirst, prizeSecond, prizeThird, status } = req.body;

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
        return res.status(400).json({ message: 'Invalid scheduledAt date' });
      }
      // Validate against tournament dates
      const tournament = await Tournament.findById(race.tournamentId);
      if (tournament && (scheduled < tournament.startDate || scheduled > tournament.endDate)) {
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
      return res.status(404).json({ message: 'Race not found' });
    }

    const { refereeId } = req.body;
    if (!refereeId) {
      return res.status(400).json({ message: 'refereeId is required' });
    }

    // Verify the user exists and has REFEREE role
    const referee = await User.findById(refereeId);
    if (!referee) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (referee.role !== 'REFEREE') {
      return res.status(400).json({ message: 'User is not a REFEREE' });
    }

    race.refereeId = refereeId;
    await race.save();

    res.status(200).json({
      raceId: race._id,
      name: race.name,
      refereeId: race.refereeId,
      refereeName: referee.fullName,
      message: 'Referee assigned successfully',
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
