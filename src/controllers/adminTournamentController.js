const Tournament = require('../models/Tournament');
const Race = require('../models/Race');

// POST /admin/tournaments
exports.createTournament = async (req, res) => {
  try {
    const { name, description, startDate, endDate, venue, prizePool, currency, maxHorses } = req.body;

    // Validate date range
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start) || isNaN(end) || start >= end) {
      return res.status(400).json({ message: 'INVALID_DATE_RANGE' });
    }

    // Check duplicate name
    const existing = await Tournament.findOne({ name: name.trim() });
    if (existing) {
      return res.status(409).json({ message: 'NAME_ALREADY_EXISTS' });
    }

    const tournament = new Tournament({
      name,
      description,
      startDate: start,
      endDate: end,
      venue,
      prizePool,
      currency: currency || 'VND',
      maxHorses,
      status: req.body.status || 'DRAFT',
      createdBy: req.user._id,
    });

    await tournament.save();

    res.status(201).json({
      tournamentId: tournament._id,
      name: tournament.name,
      status: tournament.status,
      createdAt: tournament.createdAt,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// PUT /admin/tournaments/:tournId
exports.updateTournament = async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.tournId);
    if (!tournament) {
      return res.status(404).json({ message: 'Tournament not found' });
    }

    const { name, description, startDate, endDate, venue, prizePool, currency, maxHorses, status } = req.body;

    // Validate date range if both provided
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : tournament.startDate;
      const end = endDate ? new Date(endDate) : tournament.endDate;
      if (start >= end) {
        return res.status(400).json({ message: 'INVALID_DATE_RANGE' });
      }
      tournament.startDate = start;
      tournament.endDate = end;
    }

    // Check name uniqueness if changing
    if (name && name.trim() !== tournament.name) {
      const existing = await Tournament.findOne({ name: name.trim() });
      if (existing) {
        return res.status(409).json({ message: 'NAME_ALREADY_EXISTS' });
      }
      tournament.name = name.trim();
    }

    if (description !== undefined) tournament.description = description;
    if (venue) tournament.venue = venue;
    if (prizePool !== undefined) tournament.prizePool = prizePool;
    if (currency) tournament.currency = currency;
    if (maxHorses) tournament.maxHorses = maxHorses;
    if (status) tournament.status = status;

    const updated = await tournament.save();
    res.status(200).json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// DELETE /admin/tournaments/:tournId
exports.deleteTournament = async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.tournId);
    if (!tournament) {
      return res.status(404).json({ message: 'Tournament not found' });
    }

    // Only allow delete if tournament hasn't started
    if (['ONGOING', 'COMPLETED'].includes(tournament.status)) {
      return res.status(400).json({ message: 'Cannot delete a tournament that has already started or completed' });
    }

    // Also delete all races belonging to this tournament
    await Race.deleteMany({ tournamentId: tournament._id });
    await Tournament.deleteOne({ _id: tournament._id });

    res.status(200).json({ message: 'Tournament deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
