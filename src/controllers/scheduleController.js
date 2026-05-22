const Schedule = require("../models/Schedule");
const Horse = require("../models/Horse");
const Jockey = require("../models/Jockey");
const RaceRegistration = require("../models/RaceRegistration");

/**
 * GET /me/schedule
 * Lấy lịch thi đấu của người dùng (OWNER, JOCKEY)
 */
exports.getMySchedule = async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    let schedules = [];

    if (userRole === "OWNER") {
      // Lấy lịch của tất cả ngựa của OWNER
      schedules = await Schedule.find({
        "registeredHorses.ownerId": userId,
        status: { $in: ["SCHEDULED", "ONGOING"] },
      })
        .populate("registeredHorses.horseId", "name breed gender")
        .populate("registeredHorses.ownerId", "fullName email")
        .populate("registeredHorses.jockeyId", "fullName winRate")
        .sort({ scheduledTime: 1 });
    } else if (userRole === "JOCKEY") {
      // Lấy lịch của jockey
      const jockey = await Jockey.findOne({ userId: userId });
      if (!jockey) {
        return res.status(404).json({ message: "Jockey not found" });
      }

      schedules = await Schedule.find({
        "registeredHorses.jockeyId": jockey._id,
        status: { $in: ["SCHEDULED", "ONGOING"] },
      })
        .populate("registeredHorses.horseId", "name breed")
        .populate("registeredHorses.ownerId", "fullName phone")
        .populate("registeredHorses.jockeyId", "fullName")
        .sort({ scheduledTime: 1 });
    }

    res.status(200).json({
      count: schedules.length,
      data: schedules,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /races/:raceId/schedule
 * Chi tiết lịch cuộc đua (Public)
 */
exports.getRaceSchedule = async (req, res) => {
  try {
    const { raceId } = req.params;

    const schedule = await Schedule.findOne({ raceId })
      .populate("registeredHorses.horseId", "name breed gender age")
      .populate("registeredHorses.ownerId", "fullName phone")
      .populate("registeredHorses.jockeyId", "fullName experience winRate");

    if (!schedule) {
      return res.status(404).json({ message: "Schedule not found" });
    }

    res.status(200).json({
      raceId: schedule.raceId,
      raceName: schedule.raceName,
      scheduledTime: schedule.scheduledTime,
      location: schedule.location,
      distance: schedule.distance,
      raceType: schedule.raceType,
      trackCondition: schedule.trackCondition,
      status: schedule.status,
      prizePool: schedule.prizePool,
      registeredHorses: schedule.registeredHorses,
      totalRegistered: schedule.registeredHorses.length,
      maxParticipants: schedule.maxParticipants,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /tournaments/:tournamentId/schedule
 * Lịch toàn bộ giải đấu (Public)
 */
exports.getTournamentSchedule = async (req, res) => {
  try {
    const { tournamentId } = req.params;

    const schedules = await Schedule.find({ tournamentId })
      .populate("registeredHorses.horseId", "name breed")
      .populate("registeredHorses.jockeyId", "fullName")
      .sort({ scheduledTime: 1 });

    if (schedules.length === 0) {
      return res
        .status(404)
        .json({ message: "No schedules found for this tournament" });
    }

    const totalRaces = schedules.length;
    const completedRaces = schedules.filter(
      (s) => s.status === "COMPLETED",
    ).length;
    const upcomingRaces = schedules.filter(
      (s) => s.status === "SCHEDULED",
    ).length;

    res.status(200).json({
      tournamentId,
      totalRaces,
      completedRaces,
      upcomingRaces,
      schedules,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * PATCH /me/horses/:horseId/races/:raceId/confirm
 * Đồng ý nhận tham gia cuộc đua (OWNER)
 */
exports.confirmRaceParticipation = async (req, res) => {
  try {
    const { horseId, raceId } = req.params;
    const ownerId = req.user._id;

    // Kiểm tra ngựa có tồn tại và thuộc về owner
    const horse = await Horse.findById(horseId);
    if (!horse) {
      return res.status(404).json({ message: "Horse not found" });
    }

    if (horse.ownerId.toString() !== ownerId.toString()) {
      return res.status(403).json({ message: "Horse does not belong to you" });
    }

    // Tìm schedule và cập nhật status
    const schedule = await Schedule.findOne({ raceId });
    if (!schedule) {
      return res.status(404).json({ message: "Race schedule not found" });
    }

    // Tìm registered horse và update status
    const horseIndex = schedule.registeredHorses.findIndex(
      (h) =>
        h.horseId.toString() === horseId &&
        h.ownerId.toString() === ownerId.toString(),
    );

    if (horseIndex === -1) {
      return res
        .status(404)
        .json({ message: "Horse not registered for this race" });
    }

    schedule.registeredHorses[horseIndex].status = "CONFIRMED";
    await schedule.save();

    res.status(200).json({
      message: "Race participation confirmed successfully",
      horseId,
      raceId,
      status: "CONFIRMED",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * PATCH /me/horses/:horseId/races/:raceId/withdraw
 * Rút ngựa khỏi cuộc đua (OWNER)
 */
exports.withdrawFromRace = async (req, res) => {
  try {
    const { horseId, raceId } = req.params;
    const ownerId = req.user._id;

    // Kiểm tra ngựa có tồn tại và thuộc về owner
    const horse = await Horse.findById(horseId);
    if (!horse) {
      return res.status(404).json({ message: "Horse not found" });
    }

    if (horse.ownerId.toString() !== ownerId.toString()) {
      return res.status(403).json({ message: "Horse does not belong to you" });
    }

    // Tìm schedule và cập nhật status
    const schedule = await Schedule.findOne({ raceId });
    if (!schedule) {
      return res.status(404).json({ message: "Race schedule not found" });
    }

    // Kiểm tra xem race đã diễn ra chưa
    if (schedule.status === "COMPLETED" || schedule.status === "ONGOING") {
      return res
        .status(400)
        .json({ message: "Cannot withdraw from an ongoing or completed race" });
    }

    // Tìm registered horse và update status
    const horseIndex = schedule.registeredHorses.findIndex(
      (h) =>
        h.horseId.toString() === horseId &&
        h.ownerId.toString() === ownerId.toString(),
    );

    if (horseIndex === -1) {
      return res
        .status(404)
        .json({ message: "Horse not registered for this race" });
    }

    schedule.registeredHorses[horseIndex].status = "WITHDRAWN";
    await schedule.save();

    res.status(200).json({
      message: "Horse withdrawn from race successfully",
      horseId,
      raceId,
      status: "WITHDRAWN",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /jockeys/me/races
 * Danh sách cuộc đua được phân công (JOCKEY)
 */
exports.getJockeyRaces = async (req, res) => {
  try {
    const userId = req.user._id;

    // Tìm jockey
    const jockey = await Jockey.findOne({ userId });
    if (!jockey) {
      return res.status(404).json({ message: "Jockey not found" });
    }

    // Lấy tất cả race được assigned
    const races = await Schedule.find({
      "registeredHorses.jockeyId": jockey._id,
    })
      .populate("registeredHorses.horseId", "name breed gender")
      .populate("registeredHorses.ownerId", "fullName phone")
      .sort({ scheduledTime: -1 });

    res.status(200).json({
      jockeyId: jockey._id,
      jockeyName: jockey.fullName,
      totalRaces: races.length,
      data: races,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /jockeys/me/races/:raceId
 * Chi tiết cuộc đua + thông tin ngựa được phân công (JOCKEY)
 */
exports.getJockeyRaceDetail = async (req, res) => {
  try {
    const { raceId } = req.params;
    const userId = req.user._id;

    // Tìm jockey
    const jockey = await Jockey.findOne({ userId });
    if (!jockey) {
      return res.status(404).json({ message: "Jockey not found" });
    }

    // Tìm schedule
    const schedule = await Schedule.findOne({ raceId })
      .populate("registeredHorses.horseId", "name breed gender age weight")
      .populate("registeredHorses.ownerId", "fullName phone email");

    if (!schedule) {
      return res.status(404).json({ message: "Race not found" });
    }

    // Tìm horse được assigned cho jockey này
    const assignedHorse = schedule.registeredHorses.find(
      (h) => h.jockeyId.toString() === jockey._id.toString(),
    );

    if (!assignedHorse) {
      return res
        .status(404)
        .json({ message: "You are not assigned to this race" });
    }

    res.status(200).json({
      raceId: schedule.raceId,
      raceName: schedule.raceName,
      scheduledTime: schedule.scheduledTime,
      location: schedule.location,
      distance: schedule.distance,
      raceType: schedule.raceType,
      trackCondition: schedule.trackCondition,
      status: schedule.status,
      jockey: {
        id: jockey._id,
        fullName: jockey.fullName,
        experience: jockey.experience,
        winRate: jockey.winRate,
      },
      horse: {
        id: assignedHorse.horseId._id,
        name: assignedHorse.horseId.name,
        breed: assignedHorse.horseId.breed,
        gender: assignedHorse.horseId.gender,
        age: assignedHorse.horseId.age,
        weight: assignedHorse.horseId.weight,
      },
      owner: {
        id: assignedHorse.ownerId._id,
        fullName: assignedHorse.ownerId.fullName,
        phone: assignedHorse.ownerId.phone,
        email: assignedHorse.ownerId.email,
      },
      registrationStatus: assignedHorse.status,
      registrationDate: assignedHorse.registrationDate,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /schedules/:scheduleId
 * Lấy chi tiết một schedule (Internal use)
 */
exports.getScheduleDetail = async (req, res) => {
  try {
    const { scheduleId } = req.params;

    const schedule = await Schedule.findById(scheduleId)
      .populate("registeredHorses.horseId")
      .populate("registeredHorses.ownerId", "fullName email phone")
      .populate("registeredHorses.jockeyId", "fullName experience");

    if (!schedule) {
      return res.status(404).json({ message: "Schedule not found" });
    }

    res.status(200).json(schedule);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * POST /schedules
 * Tạo lịch thi đấu (Admin/Referee)
 */
exports.createSchedule = async (req, res) => {
  try {
    const {
      raceId,
      tournamentId,
      raceName,
      scheduledTime,
      location,
      distance,
      raceType,
      maxParticipants,
      prizePool,
      trackCondition,
    } = req.body;

    // Validation
    if (
      !raceId ||
      !tournamentId ||
      !raceName ||
      !scheduledTime ||
      !location ||
      !distance ||
      !raceType ||
      !maxParticipants
    ) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const schedule = new Schedule({
      raceId,
      tournamentId,
      raceName,
      scheduledTime,
      location,
      distance,
      raceType,
      maxParticipants,
      prizePool: prizePool || 0,
      trackCondition: trackCondition || "GOOD",
    });

    await schedule.save();

    res.status(201).json({
      message: "Schedule created successfully",
      data: schedule,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
