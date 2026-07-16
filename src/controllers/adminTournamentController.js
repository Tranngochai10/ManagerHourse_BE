const Tournament = require('../models/Tournament');
const Race = require('../models/Race');
const TournamentRegistration = require('../models/TournamentRegistration');

const TournamentAuditLog = require('../models/TournamentAuditLog');
const Schedule = require('../models/Schedule');
const RaceRegistration = require('../models/RaceRegistration');
const Horse = require('../models/Horse');
const { emitEvent } = require('../utils/socket');

const { balanceHeats } = require('../utils/tournamentAlgo');
const ProgressionRule = require('../models/ProgressionRule');
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

    emitEvent('tournament_updated', { tournamentId: tournament._id, action: 'create' });

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

    const { name, description, startDate, endDate, venue, prizePool, currency, maxHorses, status, bracket } = req.body;

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
    if (bracket !== undefined) tournament.bracket = bracket;

    const updated = await tournament.save();
    emitEvent('tournament_updated', { tournamentId: tournament._id, action: 'update' });
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
    if (['REGISTRATION_CLOSED', 'BRACKET_GENERATED', 'ONGOING', 'COMPLETED'].includes(tournament.status)) {
      return res.status(400).json({
        message: 'Cannot delete a tournament that has closed registration, generated bracket, started, or completed',
      });
    }

    // Also delete all races belonging to this tournament
    await Race.deleteMany({ tournamentId: tournament._id });
    await Tournament.deleteOne({ _id: tournament._id });

    emitEvent('tournament_updated', { tournamentId: tournament._id, action: 'delete' });

    res.status(200).json({ message: 'Tournament deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// PATCH /admin/tournaments/:tournamentId/close-registration
exports.closeRegistration = async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const { trigger = 'manual' } = req.body;

    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) {
      return res.status(404).json({ message: 'Tournament not found' });
    }

    // Allow closing only if in DRAFT or PUBLISHED status
    if (tournament.status !== 'PUBLISHED' && tournament.status !== 'DRAFT') {
      return res.status(400).json({ message: 'Invalid state' });
    }

    tournament.status = 'REGISTRATION_CLOSED';
    await tournament.save();

    const totalApproved = await TournamentRegistration.countDocuments({
      tournamentId,
      status: 'APPROVED',
    });

    const pendingRegistrations = await TournamentRegistration.find({
      tournamentId,
      status: 'PENDING',
    });

    const totalPending = pendingRegistrations.length;
    const rejectedIds = pendingRegistrations.map(r => r._id.toString());

    if (totalPending > 0) {
      await TournamentRegistration.updateMany(
        { tournamentId, status: 'PENDING' },
        { status: 'REJECTED', withdrawalReason: 'Registration auto-closed' }
      );
    }

    const auditLog = new TournamentAuditLog({
      tournamentId,
      action: 'CLOSE_REGISTRATION',
      performedBy: req.user._id,
      performedByRole: req.user.role,
      details: { trigger, totalApproved, totalPending, autoRejectedCount: totalPending },
      severity: 'IMPORTANT',
    });
    await auditLog.save();

    emitEvent('tournament_updated', { tournamentId, action: 'close_registration' });

    res.status(200).json({
      tournamentId,
      status: 'REGISTRATION_CLOSED',
      totalApproved,
      totalPending,
      autoRejectedCount: totalPending,
      rejectedIds,
    });
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

// POST /admin/tournaments/:tournamentId/generate-bracket
exports.generateBracket = async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const {
      pairingMethod = 'RANDOM',
      seeds = [],
      matchIntervalMinutes = 30,
      draftBracket,
    } = req.body;

    const maxPerHeat = 8; // Force fixed 8-horse layout

    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) {
      return res.status(404).json({ message: 'Tournament not found' });
    }

    if (seeds && seeds.length > 0) {
      for (const item of seeds) {
        await TournamentRegistration.updateOne(
          { tournamentId, horseId: item.horseId },
          { seed: item.seed }
        );
      }
    }

    // Refresh registrations to get updated seeds
    const registrations = await TournamentRegistration.find({
      tournamentId,
      status: 'APPROVED',
      withdrawn: false,
    }).populate('horseId');

    const approvedCount = registrations.length;
    const minHorses = tournament.minHorses || 2;
    if (approvedCount < minHorses) {
      return res.status(400).json({
        message: `Số lượng ngựa đã duyệt (${approvedCount}) không đạt điều kiện tối thiểu của giải đấu (${minHorses})`
      });
    }

    // Call balanceHeats algorithm with forced 8 limit
    const heats = balanceHeats(registrations, maxPerHeat, pairingMethod);
    
    // Clear old progression rules, races, schedules, and race registrations for this tournament first
    const oldRaces = await Race.find({ tournamentId });
    const oldRaceIds = oldRaces.map(r => r._id);
    await RaceRegistration.deleteMany({ raceId: { $in: oldRaceIds } });
    await Race.deleteMany({ tournamentId });
    await Schedule.deleteMany({ tournamentId });
    await ProgressionRule.deleteMany({ tournamentId });

    // Calculate and generate progression rules for all rounds in the tournament
    let currentHeatsCount = heats.length;
    let roundNo = 1;
    while (currentHeatsCount > 1) {
      const nextHeatsCount = Math.ceil(currentHeatsCount / 2);
      
      const rule = new ProgressionRule({
        tournamentId,
        fromRound: roundNo,
        toRound: roundNo + 1,
        directQualifiersPerHeat: 4, // Always Top 4
        wildcardsCount: 0, // No wildcards in standard 8-horse layout
      });
      await rule.save();

      currentHeatsCount = nextHeatsCount;
      roundNo++;
    }

    let racesCreatedCount = 0;
    let baseTime = new Date(tournament.startDate);

    let finalRounds = [];
    if (draftBracket && Array.isArray(draftBracket.rounds)) {
      finalRounds = JSON.parse(JSON.stringify(draftBracket.rounds));
    }

    for (let i = 0; i < heats.length; i++) {
      const heatHorses = heats[i]; // Array of { horse, startingGate }
      const scheduledTime = new Date(baseTime.getTime() + (i * matchIntervalMinutes * 60 * 1000));
      
      let raceName = `${tournament.name} - Round 1 - Heat ${i + 1}`;
      if (finalRounds[0] && finalRounds[0].races && finalRounds[0].races[i]) {
        raceName = finalRounds[0].races[i].name || raceName;
      }

      const race = new Race({
        tournamentId,
        name: raceName,
        distance: 1000,
        scheduledAt: scheduledTime,
        maxHorses: maxPerHeat,
        status: 'PENDING',
        createdBy: req.user._id,
      });
      await race.save();
      racesCreatedCount++;

      // Create RaceRegistration and assign startingGate
      for (const item of heatHorses) {
        const reg = new RaceRegistration({
          horseId: item.horse.horseId._id,
          raceId: race._id,
          status: 'APPROVED',
          startingGate: item.startingGate,
        });
        await reg.save();
      }

      const registeredScheduleHorses = heatHorses.map(item => ({
        horseId: item.horse.horseId._id,
        ownerId: item.horse.ownerId,
        status: 'CONFIRMED', // Assuming SCHEDULE follows CONFIRMED logic
      }));

      const scheduleObj = {
        raceId: race._id,
        tournamentId,
        raceName: race.name,
        scheduledTime,
        location: tournament.venue,
        distance: 1000,
        maxParticipants: maxPerHeat,
        raceType: 'SPRINT',
        registeredHorses: registeredScheduleHorses,
      };
      
      // Instantiate Schedule correctly before saving
      const schedule = new Schedule(scheduleObj);
      await schedule.save();

      if (finalRounds[0] && finalRounds[0].races && finalRounds[0].races[i]) {
        finalRounds[0].races[i].raceId = race._id;
        finalRounds[0].races[i].horseCount = heatHorses.length;
        if (finalRounds[0].races[i].topAdvance === undefined) {
          finalRounds[0].races[i].topAdvance = 4;
        }
      } else {
        if (!finalRounds[0]) {
          const roundNameVal = heats.length === 1 ? 'Chung kết' : (heats.length === 2 ? 'Bán kết' : 'Vòng loại');
          finalRounds[0] = {
            roundNumber: 1,
            roundName: roundNameVal,
            name: roundNameVal,
            races: []
          };
        }
        finalRounds[0].races.push({
          name: race.name,
          raceId: race._id,
          horseCount: heatHorses.length,
          topAdvance: 4
        });
      }
    }

    // Pre-generate future placeholder rounds and pending races in database
    let simulationHeatsCount = heats.length;
    let simulatedRoundNo = 1;
    while (simulationHeatsCount > 1) {
      simulatedRoundNo++;
      const nextHeatsCount = Math.ceil(simulationHeatsCount / 2);
      const roundName = nextHeatsCount === 1 ? 'Chung kết' : (nextHeatsCount === 2 ? 'Bán kết' : 'Vòng loại');
      const roundIdx = simulatedRoundNo - 1;
      
      for (let i = 0; i < nextHeatsCount; i++) {
        let futureRaceName = `${tournament.name} - ${roundName} - Heat ${i + 1}`;
        if (finalRounds[roundIdx] && finalRounds[roundIdx].races && finalRounds[roundIdx].races[i]) {
          futureRaceName = finalRounds[roundIdx].races[i].name || futureRaceName;
        }

        // Create pending future race in DB
        const futureRace = new Race({
          tournamentId,
          name: futureRaceName,
          distance: 1000,
          scheduledAt: new Date(baseTime.getTime() + ((simulatedRoundNo - 1) * 24 * 60 * 60 * 1000)), // dummy schedule time (+days)
          maxHorses: maxPerHeat,
          status: 'PENDING',
          createdBy: req.user._id,
        });
        await futureRace.save();
        racesCreatedCount++;

        if (finalRounds[roundIdx] && finalRounds[roundIdx].races && finalRounds[roundIdx].races[i]) {
          finalRounds[roundIdx].races[i].raceId = futureRace._id;
          finalRounds[roundIdx].races[i].horseCount = 0;
          if (finalRounds[roundIdx].races[i].topAdvance === undefined) {
            finalRounds[roundIdx].races[i].topAdvance = 4;
          }
        } else {
          if (!finalRounds[roundIdx]) {
            finalRounds[roundIdx] = {
              roundNumber: simulatedRoundNo,
              roundName: roundName,
              name: roundName,
              races: []
            };
          }
          finalRounds[roundIdx].races.push({
            name: futureRace.name,
            raceId: futureRace._id,
            horseCount: 0,
            topAdvance: 4
          });
        }
      }

      simulationHeatsCount = nextHeatsCount;
    }

    const bracket = {
      tournamentId,
      rounds: finalRounds,
    };

    tournament.bracket = bracket;
    tournament.status = 'BRACKET_GENERATED';
    await tournament.save();

    const auditLog = new TournamentAuditLog({
      tournamentId,
      action: 'GENERATE_BRACKET',
      performedBy: req.user._id,
      performedByRole: req.user.role,
      details: { pairingMethod, maxPerHeat, racesCreated: racesCreatedCount, approvedCount },
      severity: 'IMPORTANT',
    });
    await auditLog.save();

    emitEvent('tournament_updated', { tournamentId, action: 'generate_bracket' });

    res.status(201).json({
      tournamentId,
      status: 'BRACKET_GENERATED',
      racesCreated: racesCreatedCount,
      bracket,
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

    emitEvent('registration_updated', {
      registrationId: registration._id,
      tournamentId: registration.tournamentId._id || registration.tournamentId
    });

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

// PATCH /admin/tournaments/:tournamentId/seeds
exports.updateSeeds = async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const { seeds = [], applyToExistingBracket = false } = req.body;

    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) {
      return res.status(404).json({ message: 'Tournament not found' });
    }

    for (const item of seeds) {
      await TournamentRegistration.updateOne(
        { tournamentId, horseId: item.horseId },
        { seed: item.seed }
      );
    }

    if (applyToExistingBracket) {
      if (tournament.bracket) {
        return res.status(409).json({ message: 'Cannot apply to existing bracket without regeneration. Please regenerate the bracket.' });
      }
    }

    const auditLog = new TournamentAuditLog({
      tournamentId,
      action: 'UPDATE_SEEDS',
      performedBy: req.user._id,
      performedByRole: req.user.role,
      details: { seedsCount: seeds.length, applyToExistingBracket },
      severity: 'INFO',
    });
    await auditLog.save();

    emitEvent('registration_updated', { tournamentId });

    res.status(200).json({ message: 'Updated seeds successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /admin/tournaments/:tournamentId/withdraw/:horseId
exports.withdrawHorse = async (req, res) => {
  try {
    const { tournamentId, horseId } = req.params;
    const { reason = 'Withdrawn by Admin' } = req.body || {};

    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) {
      return res.status(404).json({ message: 'Tournament not found' });
    }

    const registration = await TournamentRegistration.findOneAndUpdate(
      { tournamentId, horseId },
      { withdrawn: true, withdrawalReason: reason },
      { new: true }
    );

    if (!registration) {
      return res.status(404).json({ message: 'Horse registration not found in this tournament' });
    }

    const affectedRaces = [];

    if (tournament.bracket && tournament.bracket.rounds) {
      const rounds = tournament.bracket.rounds;
      for (const round of rounds) {
        for (const match of round.matches) {
          if (match.horse1Id?.toString() === horseId || match.horse2Id?.toString() === horseId) {
            if (match.raceId) {
              const race = await Race.findById(match.raceId);
              if (race && race.status === 'SCHEDULED') {
                race.status = 'CANCELLED';
                await race.save();
                affectedRaces.push({ raceId: race._id, name: race.name, status: race.status });

                const schedule = await Schedule.findOne({ raceId: race._id });
                if (schedule) {
                  const horseIndex = schedule.registeredHorses.findIndex(h => h.horseId.toString() === horseId);
                  if (horseIndex > -1) {
                    schedule.registeredHorses[horseIndex].status = 'WITHDRAWN';
                  }
                  schedule.status = 'CANCELLED';
                  await schedule.save();
                }

                await RaceRegistration.updateOne(
                  { raceId: race._id, horseId },
                  { status: 'REJECTED', rejectionReason: reason }
                );
              }
            }

            if (match.horse1Id?.toString() === horseId) {
              match.horse1Id = null;
            } else {
              match.horse2Id = null;
            }
            match.isBye = true;
          }
        }
      }
      tournament.markModified('bracket');
      await tournament.save();
    }

    const auditLog = new TournamentAuditLog({
      tournamentId,
      action: 'WITHDRAW_HORSE',
      performedBy: req.user._id,
      performedByRole: req.user.role,
      details: { horseId, reason },
      severity: 'WARNING',
    });
    await auditLog.save();

    emitEvent('tournament_updated', { tournamentId, action: 'withdraw_horse' });

    res.status(200).json({
      tournamentId,
      affectedRaces,
      updatedBracket: tournament.bracket,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Tự động chia các ngựa APPROVED thành các heat (Race) trong tournament
exports.generateHeats = async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const { horsesPerHeat = 8, distanceMeters = 1200, scheduledAt } = req.body;

    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) {
      return res.status(404).json({ message: 'Tournament not found' });
    }

    // Cho phép generate heats khi tournament đã đóng đăng ký hoặc đang tiến hành
    if (!['PUBLISHED', 'REGISTRATION_CLOSED', 'BRACKET_GENERATED', 'ONGOING'].includes(tournament.status)) {
      return res.status(400).json({
        message: `Can only generate heats for PUBLISHED, REGISTRATION_CLOSED, BRACKET_GENERATED or ONGOING tournaments. Current: ${tournament.status}`,
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

    // Tự động chuyển trạng thái tournament sang BRACKET_GENERATED nếu chưa phải ONGOING
    if (tournament.status !== 'ONGOING') {
      tournament.status = 'BRACKET_GENERATED';
      await tournament.save();
    }

    emitEvent('tournament_updated', { tournamentId, action: 'generate_heats' });

    return res.status(201).json({
      message: `Generated ${createdRaces.length} heat(s) successfully`,
      tournamentId,
      tournamentStatus: tournament.status,
      totalHorses: approvedRegs.length,
      heatsCreated: createdRaces.length,
      races: createdRaces,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /admin/tournaments/:tournamentId/audit-log
exports.getAuditLogs = async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const { limit = 50, since } = req.query;

    const filter = { tournamentId };
    if (since) {
      filter.timestamp = { $gte: new Date(since) };
    }

    const logs = await TournamentAuditLog.find(filter)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .populate('performedBy', 'fullName email role');

    res.status(200).json(logs.map(log => ({
      id: log._id,
      action: log.action,
      performedBy: log.performedBy ? log.performedBy.fullName : 'System',
      performedByRole: log.performedByRole,
      timestamp: log.timestamp,
      details: log.details,
      severity: log.severity,
    })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /admin/tournaments/registrations
exports.getTournamentRegistrationsAll = async (req, res) => {
  try {
    const { tournamentId, status } = req.query;

    const filter = {};
    if (tournamentId) filter.tournamentId = tournamentId;
    if (status) filter.status = status;

    const registrations = await TournamentRegistration.find(filter)
      .populate({
        path: 'horseId',
        select: 'name breed age weight color gender status',
        populate: { path: 'ownerId', select: 'fullName email phone' },
      })
      .populate('ownerId', 'fullName email phone')
      .populate('tournamentId', 'name status')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      total: registrations.length,
      registrations: registrations.map((r) => ({
        registrationId: r._id,
        tournament: r.tournamentId ? {
          id: r.tournamentId._id,
          name: r.tournamentId.name,
          status: r.tournamentId.status,
        } : null,
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

// PATCH /admin/tournaments/registrations/:registrationId/approve
exports.approveTournamentRegistration = async (req, res) => {
  try {
    const { registrationId } = req.params;

    const registration = await TournamentRegistration.findById(registrationId)
      .populate('horseId', 'name breed')
      .populate('ownerId', 'fullName email')
      .populate('tournamentId', 'name maxHorses');

    if (!registration) {
      return res.status(404).json({ message: 'Registration not found' });
    }

    if (registration.status !== 'PENDING') {
      return res.status(400).json({
        message: `Cannot approve registration with status: ${registration.status}`,
      });
    }

    // Check max approved horses
    const approvedCount = await TournamentRegistration.countDocuments({
      tournamentId: registration.tournamentId._id,
      status: 'APPROVED',
    });
    if (approvedCount >= registration.tournamentId.maxHorses) {
      return res.status(400).json({ message: 'Tournament has reached maximum approved horses' });
    }

    registration.status = 'APPROVED';
    await registration.save();

    return res.status(200).json({
      registrationId: registration._id,
      horse: registration.horseId,
      owner: registration.ownerId,
      tournament: registration.tournamentId,
      status: registration.status,
      message: 'Registration approved successfully',
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PATCH /admin/tournaments/registrations/:registrationId/reject
exports.rejectTournamentRegistration = async (req, res) => {
  try {
    const { registrationId } = req.params;
    const { reason } = req.body;

    const registration = await TournamentRegistration.findById(registrationId)
      .populate('horseId', 'name breed')
      .populate('ownerId', 'fullName email')
      .populate('tournamentId', 'name');

    if (!registration) {
      return res.status(404).json({ message: 'Registration not found' });
    }

    if (registration.status !== 'PENDING') {
      return res.status(400).json({
        message: `Cannot reject registration with status: ${registration.status}`,
      });
    }

    registration.status = 'REJECTED';
    registration.rejectionReason = reason || 'No reason provided';
    await registration.save();

    return res.status(200).json({
      registrationId: registration._id,
      horse: registration.horseId,
      owner: registration.ownerId,
      tournament: registration.tournamentId,
      status: registration.status,
      rejectionReason: registration.rejectionReason,
      message: 'Registration rejected successfully',
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

