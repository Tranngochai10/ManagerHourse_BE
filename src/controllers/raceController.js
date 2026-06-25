const Race = require('../models/Race');
const RaceRegistration = require('../models/RaceRegistration');
const Horse = require('../models/Horse');
const Invitation = require('../models/Invitation');
const RaceResult = require('../models/RaceResult');

// GET /races — Public (filter by tournamentId)
exports.getRaces = async (req, res) => {
  try {
    const { tournamentId, status, page = 1, limit = 10 } = req.query;
    const filter = {};
    if (tournamentId) filter.tournamentId = tournamentId;
    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [races, total] = await Promise.all([
      Race.find(filter)
        .sort({ scheduledAt: 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('tournamentId', 'name venue')
        .populate('refereeId', 'fullName email'),
      Race.countDocuments(filter),
    ]);

    res.status(200).json({
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit),
      races,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /races/:raceId — Public
exports.getRaceById = async (req, res) => {
  try {
    const race = await Race.findById(req.params.raceId)
      .populate('tournamentId', 'name startDate endDate venue')
      .populate('refereeId', 'fullName email')
      .populate('createdBy', 'fullName email');

    if (!race) {
      return res.status(404).json({ message: 'Race not found' });
    }

    // Kèm theo kết quả (rankings) nếu đã được confirm bởi trọng tài
    const raceResult = await RaceResult.findOne({ raceId: req.params.raceId })
      .populate('rankings.horseId', 'name breed color')
      .populate('rankings.jockeyId', 'fullName')
      .populate('confirmedBy', 'fullName email');

    const response = race.toObject();
    response.result = raceResult || null;

    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /races/:raceId/horses — Public: list horses registered for this race
exports.getHorsesByRace = async (req, res) => {
  try {
    const race = await Race.findById(req.params.raceId);
    if (!race) {
      return res.status(404).json({ message: 'Race not found' });
    }

    const [registrations, invitations] = await Promise.all([
      RaceRegistration.find({ raceId: req.params.raceId })
        .populate({
          path: 'horseId',
          populate: { path: 'ownerId', select: 'fullName email' },
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

    res.status(200).json({ raceId: race._id, horses });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PATCH /horses/me/:horseId/confirm-race/:raceId — OWNER confirms participation
exports.confirmRaceParticipation = async (req, res) => {
  try {
    const { horseId, raceId } = req.params;

    // Check horse belongs to this owner
    const horse = await Horse.findById(horseId);
    if (!horse) {
      return res.status(404).json({ message: 'Horse not found' });
    }
    if (horse.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to confirm this horse' });
    }

    // Check race exists
    const race = await Race.findById(raceId);
    if (!race) {
      return res.status(404).json({ message: 'Race not found' });
    }

    // Find registration
    const registration = await RaceRegistration.findOne({ horseId, raceId });
    if (!registration) {
      return res.status(404).json({ message: 'No registration found for this horse and race' });
    }

    if (registration.status !== 'APPROVED') {
      return res.status(400).json({ message: 'Registration must be APPROVED before owner confirmation' });
    }

    if (registration.confirmedByOwner) {
      return res.status(409).json({ message: 'ALREADY_CONFIRMED' });
    }

    registration.confirmedByOwner = true;
    registration.status = 'CONFIRMED';
    await registration.save();

    res.status(200).json({
      registrationId: registration._id,
      horseId: registration.horseId,
      raceId: registration.raceId,
      status: registration.status,
      confirmedByOwner: registration.confirmedByOwner,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
