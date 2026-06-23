const Tournament = require('../models/Tournament');
const Race = require('../models/Race');
const TournamentRegistration = require('../models/TournamentRegistration');
const RaceRegistration = require('../models/RaceRegistration');

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
      status: 'DRAFT',
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

// GET /admin/tournaments/:tournamentId/registrations
exports.getTournamentRegistrations = async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const { status } = req.query;

    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) {
      return res.status(404).json({ message: 'Tournament not found' });
    }

    const filter = { tournamentId };
    if (status) filter.status = status;

    const registrations = await TournamentRegistration.find(filter)
      .populate({
        path: 'horseId',
        select: 'name breed age weight color gender status',
        populate: { path: 'ownerId', select: 'fullName email phone' },
      })
      .populate('ownerId', 'fullName email phone')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      total: registrations.length,
      tournament: { id: tournament._id, name: tournament.name, status: tournament.status },
      registrations: registrations.map((r) => ({
        registrationId: r._id,
        horse: r.horseId,
        owner: r.ownerId,
        status: r.status,
        rejectionReason: r.rejectionReason,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PATCH /admin/tournaments/registrations/:registrationId
exports.updateTournamentRegistration = async (req, res) => {
  try {
    const { registrationId } = req.params;
    const { status, rejectionReason } = req.body;

    const allowed = ['APPROVED', 'REJECTED'];
    if (!status || !allowed.includes(status)) {
      return res.status(400).json({ message: `status must be one of: ${allowed.join(', ')}` });
    }

    const registration = await TournamentRegistration.findById(registrationId)
      .populate('horseId', 'name breed')
      .populate('ownerId', 'fullName email')
      .populate('tournamentId', 'name maxHorses');

    if (!registration) {
      return res.status(404).json({ message: 'Registration not found' });
    }

    if (registration.status !== 'PENDING') {
      return res.status(400).json({
        message: `Cannot update registration with status: ${registration.status}`,
      });
    }

    // Nếu duyệt, kiểm tra tổng số đã APPROVED chưa vượt maxHorses
    if (status === 'APPROVED') {
      const approvedCount = await TournamentRegistration.countDocuments({
        tournamentId: registration.tournamentId._id,
        status: 'APPROVED',
      });
      if (approvedCount >= registration.tournamentId.maxHorses) {
        return res.status(400).json({ message: 'Tournament has reached maximum approved horses' });
      }
    }

    registration.status = status;
    if (status === 'REJECTED') {
      registration.rejectionReason = rejectionReason || 'No reason provided';
    }
    await registration.save();

    return res.status(200).json({
      registrationId: registration._id,
      horse: registration.horseId,
      owner: registration.ownerId,
      tournament: registration.tournamentId,
      status: registration.status,
      rejectionReason: registration.rejectionReason,
      message: `Registration ${status.toLowerCase()} successfully`,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /admin/tournaments/:tournamentId/generate-heats
// Tự động chia các ngựa APPROVED thành các heat (Race) trong tournament
exports.generateHeats = async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const { horsesPerHeat = 8, distanceMeters = 1200, scheduledAt } = req.body;

    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) {
      return res.status(404).json({ message: 'Tournament not found' });
    }

    if (!['PUBLISHED', 'ONGOING'].includes(tournament.status)) {
      return res.status(400).json({
        message: `Can only generate heats for PUBLISHED or ONGOING tournaments. Current: ${tournament.status}`,
      });
    }

    // Lấy tất cả các đăng ký đã APPROVED trong tournament
    const approvedRegs = await TournamentRegistration.find({
      tournamentId,
      status: 'APPROVED',
    }).populate('horseId', 'name');

    if (approvedRegs.length < 2) {
      return res.status(400).json({
        message: `Need at least 2 approved horses to generate heats. Current: ${approvedRegs.length}`,
      });
    }

    // Xác định thời điểm các heat bắt đầu
    const baseSchedule = scheduledAt ? new Date(scheduledAt) : new Date(tournament.startDate);
    if (isNaN(baseSchedule)) {
      return res.status(400).json({ message: 'Invalid scheduledAt date' });
    }

    // Chia ngựa thành các nhóm heat
    const horses = approvedRegs.map((r) => r.horseId);
    const numHeats = Math.ceil(horses.length / horsesPerHeat);
    const createdRaces = [];

    for (let i = 0; i < numHeats; i++) {
      const heatHorses = horses.slice(i * horsesPerHeat, (i + 1) * horsesPerHeat);
      const heatSchedule = new Date(baseSchedule.getTime() + i * 60 * 60 * 1000); // cách nhau 1 giờ

      // Kiểm tra hạn bất đầu không vượt endDate tournament
      if (heatSchedule > tournament.endDate) {
        break;
      }

      const race = new Race({
        tournamentId,
        name: `Heat ${i + 1}`,
        distance: distanceMeters,
        scheduledAt: heatSchedule,
        maxHorses: heatHorses.length,
        status: 'SCHEDULED',
        createdBy: req.user._id,
      });
      await race.save();

      // Tạo RaceRegistration cho từng ngựa trong heat
      const raceRegs = heatHorses.map((horse) => ({
        horseId: horse._id,
        raceId: race._id,
        status: 'APPROVED',
        confirmedByOwner: false,
      }));
      await RaceRegistration.insertMany(raceRegs, { ordered: false });

      createdRaces.push({
        raceId: race._id,
        name: race.name,
        scheduledAt: race.scheduledAt,
        horses: heatHorses.map((h) => ({ id: h._id, name: h.name })),
      });
    }

    return res.status(201).json({
      message: `Generated ${createdRaces.length} heat(s) successfully`,
      tournamentId,
      totalHorses: approvedRegs.length,
      heatsCreated: createdRaces.length,
      races: createdRaces,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
