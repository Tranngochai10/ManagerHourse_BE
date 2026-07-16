const Tournament = require('../models/Tournament');
const TournamentRegistration = require('../models/TournamentRegistration');
const Horse = require('../models/Horse');
const { emitEvent } = require('../utils/socket');

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

// GET /tournaments/:tournamentId/bracket — Public
exports.getBracket = async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.tournamentId);
    if (!tournament) {
      return res.status(404).json({ message: 'Tournament not found' });
    }
    if (!tournament.bracket) {
      return res.status(404).json({ message: 'Bracket not generated yet' });
    }
    res.status(200).json(tournament.bracket);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /tournaments/:tournamentId/register — Owner đăng ký ngựa vào tournament
exports.registerToTournament = async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const { horseId } = req.body;

    // Chỉ OWNER mới được đăng ký
    if (req.user.role !== 'OWNER') {
      return res.status(403).json({ message: 'Only OWNER can register horses to a tournament' });
    }

    if (!horseId) {
      return res.status(400).json({ message: 'horseId is required' });
    }

    // Kiểm tra tournament tồn tại và đang mở đăng ký
    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) {
      return res.status(404).json({ message: 'Tournament not found' });
    }
    if (!['PUBLISHED'].includes(tournament.status)) {
      return res.status(400).json({ message: `Tournament is not open for registration. Status: ${tournament.status}` });
    }

    // Kiểm tra ngựa tồn tại và thuộc owner này
    const horse = await Horse.findById(horseId);
    if (!horse) {
      return res.status(404).json({ message: 'Horse not found' });
    }
    if (horse.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You do not own this horse' });
    }
    if (horse.status !== 'APPROVED') {
      return res.status(400).json({ message: `Horse must be APPROVED to register. Current status: ${horse.status}` });
    }

    // Kiểm tra số lượng ngựa đã đăng ký chưa vượt maxHorses
    const currentCount = await TournamentRegistration.countDocuments({
      tournamentId,
      status: { $in: ['PENDING', 'APPROVED'] },
    });
    if (currentCount >= tournament.maxHorses) {
      return res.status(400).json({ message: 'Tournament has reached maximum horse registrations' });
    }

    // Tạo đăng ký (nếu đã tồn tại sẽ throw duplicate key error)
    const registration = new TournamentRegistration({
      tournamentId,
      horseId,
      ownerId: req.user._id,
      status: 'PENDING',
    });
    await registration.save();

    emitEvent('registration_updated', {
      registrationId: registration._id,
      tournamentId: registration.tournamentId
    });

    return res.status(201).json({
      registrationId: registration._id,
      tournamentId: registration.tournamentId,
      horseId: registration.horseId,
      ownerId: registration.ownerId,
      status: registration.status,
      createdAt: registration.createdAt,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'This horse is already registered to this tournament' });
    }
    res.status(500).json({ message: error.message });
  }
};
