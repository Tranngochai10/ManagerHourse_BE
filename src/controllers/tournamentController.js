const Tournament = require('../models/Tournament');

// GET /tournaments — Public
exports.getTournaments = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [tournaments, total] = await Promise.all([
      Tournament.find(filter)
        .sort({ startDate: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('createdBy', 'fullName email'),
      Tournament.countDocuments(filter),
    ]);

    res.status(200).json({
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      tournaments,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /tournaments/:tournId — Public
exports.getTournamentById = async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.tournId).populate('createdBy', 'fullName email');
    if (!tournament) {
      return res.status(404).json({ message: 'Tournament not found' });
    }
    res.status(200).json(tournament);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
