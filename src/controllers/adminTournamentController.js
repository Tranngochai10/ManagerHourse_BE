const Tournament = require('../models/Tournament');
const Race = require('../models/Race');
const TournamentRegistration = require('../models/TournamentRegistration');
const TournamentAuditLog = require('../models/TournamentAuditLog');
const Schedule = require('../models/Schedule');
const RaceRegistration = require('../models/RaceRegistration');
const Horse = require('../models/Horse');

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

// POST /admin/tournaments/:tournamentId/generate-bracket
exports.generateBracket = async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const {
      pairingMethod = 'RANDOM',
      seeds = [],
      matchIntervalMinutes = 30,
      roundIntervalDays = 1,
      forceContinueIfBelowMin = false,
    } = req.body;

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

    const registrations = await TournamentRegistration.find({
      tournamentId,
      status: 'APPROVED',
      withdrawn: false,
    }).populate('horseId');

    const approvedCount = registrations.length;
    if (approvedCount < 2 && !forceContinueIfBelowMin) {
      return res.status(409).json({ message: 'Conflict: Approved horse count is below minimum (2)' });
    }

    if (approvedCount === 0) {
      return res.status(400).json({ message: 'No approved horses to generate bracket' });
    }

    function getSeedingOrder(size) {
      if (size === 2) return [1, 2];
      const prev = getSeedingOrder(size / 2);
      const order = [];
      for (let i = 0; i < prev.length; i++) {
        order.push(prev[i]);
        order.push(size + 1 - prev[i]);
      }
      return order;
    }

    const R = Math.ceil(Math.log2(approvedCount));
    const P = Math.pow(2, R === 0 ? 1 : R);

    let sortedHorses = [...registrations];
    if (pairingMethod === 'SEEDED') {
      sortedHorses.sort((a, b) => {
        const seedA = a.seed !== null && a.seed !== undefined ? a.seed : Infinity;
        const seedB = b.seed !== null && b.seed !== undefined ? b.seed : Infinity;
        return seedA - seedB;
      });
    } else {
      sortedHorses.sort(() => Math.random() - 0.5);
    }

    const slots = new Array(P).fill(null);
    for (let i = 0; i < sortedHorses.length; i++) {
      slots[i] = sortedHorses[i].horseId;
    }

    const seedingOrder = getSeedingOrder(P);
    let racesCreatedCount = 0;
    const rounds = [];
    let baseTime = new Date(tournament.startDate);

    for (let r = 1; r <= R; r++) {
      const roundMatchesCount = P / Math.pow(2, r);
      const roundMatches = [];
      const roundName = `Round ${r}`;

      for (let m = 1; m <= roundMatchesCount; m++) {
        let horse1 = null;
        let horse2 = null;
        let isBye = false;
        let raceId = null;

        const scheduledTime = new Date(baseTime.getTime() + (r - 1) * roundIntervalDays * 24 * 60 * 60 * 1000 + (m - 1) * matchIntervalMinutes * 60 * 1000);

        if (r === 1) {
          const slot1Idx = seedingOrder[2 * (m - 1)] - 1;
          const slot2Idx = seedingOrder[2 * (m - 1) + 1] - 1;
          horse1 = slots[slot1Idx];
          horse2 = slots[slot2Idx];

          if (horse1 && !horse2) {
            isBye = true;
          } else if (!horse1 && horse2) {
            horse1 = horse2;
            horse2 = null;
            isBye = true;
          } else if (!horse1 && !horse2) {
            isBye = true;
          }
        } else {
          // Placeholder for subsequent rounds
          isBye = false;
        }

        if (!isBye && (horse1 || horse2)) {
          const race = new Race({
            tournamentId,
            name: `${tournament.name} - Round ${r} - Match ${m}`,
            distance: 1000,
            scheduledAt: scheduledTime,
            maxHorses: 2,
            createdBy: req.user._id,
          });
          await race.save();
          raceId = race._id;
          racesCreatedCount++;

          const horseIds = [horse1, horse2].filter(h => h !== null);
          for (const horse of horseIds) {
            const reg = new RaceRegistration({
              horseId: horse._id,
              raceId: race._id,
              status: 'APPROVED',
            });
            await reg.save();
          }

          const registeredHorses = [];
          for (const horse of horseIds) {
            registeredHorses.push({
              horseId: horse._id,
              ownerId: horse.ownerId,
              status: 'CONFIRMED',
            });
          }
          const schedule = new Schedule({
            raceId: race._id,
            tournamentId,
            raceName: race.name,
            scheduledTime,
            location: tournament.venue,
            distance: 1000,
            maxParticipants: 2,
            raceType: 'SPRINT',
            registeredHorses,
          });
          await schedule.save();
        }

        roundMatches.push({
          matchNumber: m,
          raceId,
          horse1Id: horse1 ? horse1._id : null,
          horse2Id: horse2 ? horse2._id : null,
          isBye,
          scheduledAt: scheduledTime.toISOString(),
          bracketPosition: `${r}-${m}`,
        });
      }
      rounds.push({
        roundNumber: r,
        roundName,
        matches: roundMatches,
      });
    }

    const bracket = {
      tournamentId,
      rounds,
    };

    tournament.bracket = bracket;
    tournament.status = 'BRACKET_GENERATED';
    await tournament.save();

    const auditLog = new TournamentAuditLog({
      tournamentId,
      action: 'GENERATE_BRACKET',
      performedBy: req.user._id,
      performedByRole: req.user.role,
      details: { pairingMethod, racesCreated: racesCreatedCount, approvedCount },
      severity: 'IMPORTANT',
    });
    await auditLog.save();

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

    res.status(200).json({
      tournamentId,
      affectedRaces,
      updatedBracket: tournament.bracket,
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

