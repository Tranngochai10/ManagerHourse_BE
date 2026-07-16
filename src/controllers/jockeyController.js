const Jockey = require("../models/Jockey");
const Invitation = require("../models/Invitation");
const RaceRegistration = require("../models/RaceRegistration");
const Race = require("../models/Race");
const Horse = require("../models/Horse");
const Result = require("../models/Result");
const RaceResult = require("../models/RaceResult");

// GET /jockeys/me - Xem profile Jockey của bản thân
exports.getMyProfile = async (req, res) => {
  try {
    const jockey = await Jockey.findOne({ userId: req.user._id }).populate(
      "userId",
    );
    if (!jockey) {
      return res.status(404).json({ message: "Jockey profile not found" });
    }
    res.json(jockey);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUT /jockeys/me - Cập nhật profile Jockey
exports.updateMyProfile = async (req, res) => {
  try {
    const { age, experience, bio, image, specialties } = req.body;

    const jockey = await Jockey.findOneAndUpdate(
      { userId: req.user._id },
      {
        age,
        experience,
        bio,
        image,
        specialties,
      },
      { new: true },
    ).populate("userId", "fullName phone email");

    if (!jockey) {
      return res.status(404).json({ message: "Jockey profile not found" });
    }

    res.json(jockey);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /jockeys/:jockeyId - Xem thông tin Jockey công khai
exports.getJockeyById = async (req, res) => {
  try {
    const jockey = await Jockey.findById(req.params.jockeyId)
      .populate("userId", "fullName phone")
      .select("experience winRate bio image specialties wins races status");

    if (!jockey) {
      return res.status(404).json({ message: "Jockey not found" });
    }

    res.json(jockey);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /jockeys - Danh sách Jockey (Owner tìm kiếm để thuê)
exports.listJockeys = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const filter = {};
    if (status) filter.status = status;

    const skip = (page - 1) * limit;

    const jockeys = await Jockey.find(filter)
      .populate("userId", "fullName phone")
      .select("experience winRate bio image specialties wins races status")
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Jockey.countDocuments(filter);

    res.json({
      jockeys,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /horses/:horseId/invitations - Gửi lời mời jockey
exports.sendInvitation = async (req, res) => {
  try {
    const { jockeyId, raceId, message } = req.body;
    const { horseId } = req.params;

    // Kiểm tra ngựa có tồn tại và thuộc về owner
    const horse = await Horse.findById(horseId);
    if (!horse) {
      return res.status(404).json({ message: "Horse not found" });
    }

    if (horse.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Kiểm tra jockey có tồn tại
    const jockey = await Jockey.findById(jockeyId);
    if (!jockey) {
      return res.status(404).json({ message: "Jockey not found" });
    }

    // Kiểm tra race có tồn tại
    const race = await Race.findById(raceId);
    if (!race) {
      return res.status(404).json({ message: "Race not found" });
    }

    // Kiểm tra jockey đã được mời cho cuộc đua này chưa
    const existingInvitation = await Invitation.findOne({
      jockeyId,
      raceId,
      horseId,
      status: { $in: ["PENDING", "ACCEPTED"] },
    });

    if (existingInvitation) {
      return res.status(409).json({ message: "Jockey already invited" });
    }

    const invitation = new Invitation({
      jockeyId,
      horseId,
      raceId,
      ownerId: req.user._id,
      message,
    });

    await invitation.save();

    res.status(201).json({
      invitationId: invitation._id,
      raceId: invitation.raceId,
      jockeyId: invitation.jockeyId,
      horseId: invitation.horseId,
      status: invitation.status,
      sentAt: invitation.sentAt,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /jockeys/me/invitations - Xem danh sách lời mời nhận được
exports.getMyInvitations = async (req, res) => {
  try {
    const jockey = await Jockey.findOne({ userId: req.user._id });
    if (!jockey) {
      return res.status(404).json({ message: "Jockey profile not found" });
    }

    const { status, page = 1, limit = 10 } = req.query;

    const filter = { jockeyId: jockey._id };
    if (status) filter.status = status;

    const skip = (page - 1) * limit;

    const invitations = await Invitation.find(filter)
      .populate("horseId", "name breed weight")
      .populate("raceId", "name scheduledAt distance")
      .populate("ownerId", "fullName email")
      .sort({ sentAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Invitation.countDocuments(filter);

    res.json({
      invitations,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PATCH /jockeys/me/invitations/:invId/accept - Chấp nhận lời mời
exports.acceptInvitation = async (req, res) => {
  try {
    const jockey = await Jockey.findOne({ userId: req.user._id });
    if (!jockey) {
      return res.status(404).json({ message: "Jockey profile not found" });
    }

    const invitation = await Invitation.findById(req.params.invId);

    if (!invitation) {
      return res.status(404).json({ message: "Invitation not found" });
    }

    if (invitation.jockeyId.toString() !== jockey._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (invitation.status !== "PENDING") {
      return res.status(400).json({ message: "Invitation is not pending" });
    }

    // Kiểm tra invitation đã hết hạn chưa
    if (invitation.expiresAt < new Date()) {
      return res.status(400).json({ message: "Invitation expired" });
    }

    invitation.status = "ACCEPTED";
    invitation.updatedAt = new Date();
    await invitation.save();

    // Đồng bộ jockeyId vào Schedule của cuộc đua
    const Schedule = require("../models/Schedule");
    const schedule = await Schedule.findOne({ raceId: invitation.raceId });
    if (schedule) {
      const horseIndex = schedule.registeredHorses.findIndex(
        (h) => h.horseId.toString() === invitation.horseId.toString()
      );
      if (horseIndex !== -1) {
        schedule.registeredHorses[horseIndex].jockeyId = jockey._id;
        await schedule.save();
      }
    }

    res.json({
      invitationId: invitation._id,
      status: invitation.status,
      updatedAt: invitation.updatedAt,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PATCH /jockeys/me/invitations/:invId/reject - Từ chối lời mời
exports.rejectInvitation = async (req, res) => {
  try {
    const jockey = await Jockey.findOne({ userId: req.user._id });
    if (!jockey) {
      return res.status(404).json({ message: "Jockey profile not found" });
    }

    const invitation = await Invitation.findById(req.params.invId);

    if (!invitation) {
      return res.status(404).json({ message: "Invitation not found" });
    }

    if (invitation.jockeyId.toString() !== jockey._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (invitation.status !== "PENDING") {
      return res.status(400).json({ message: "Invitation is not pending" });
    }

    invitation.status = "REJECTED";
    invitation.updatedAt = new Date();
    await invitation.save();

    res.json({
      invitationId: invitation._id,
      status: invitation.status,
      updatedAt: invitation.updatedAt,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /horses/:horseId/jockeys - Xem danh sách jockey của ngựa
exports.getHorseJockeys = async (req, res) => {
  try {
    const { horseId } = req.params;

    const horse = await Horse.findById(horseId);
    if (!horse) {
      return res.status(404).json({ message: "Horse not found" });
    }

    if (horse.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const invitations = await Invitation.find({
      horseId,
      status: { $in: ["PENDING", "ACCEPTED"] },
    }).populate("jockeyId", "fullName experience winRate bio image");

    res.json(invitations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PATCH /horses/:horseId/jockeys/:jockeyId/confirm - Xác nhận jockey cho cuộc đua
exports.confirmJockey = async (req, res) => {
  try {
    const { horseId, jockeyId } = req.params;
    const { raceId } = req.body;

    // Kiểm tra quyền owner
    const horse = await Horse.findById(horseId);
    if (!horse) {
      return res.status(404).json({ message: "Horse not found" });
    }

    if (horse.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Cập nhật invitation thành ACCEPTED (nếu chưa)
    const invitation = await Invitation.findOne({
      horseId,
      jockeyId,
      raceId,
    });

    if (!invitation) {
      return res.status(404).json({ message: "Invitation not found" });
    }

    invitation.status = "ACCEPTED";
    await invitation.save();

    // Đồng bộ jockeyId vào Schedule của cuộc đua
    const Schedule = require("../models/Schedule");
    const schedule = await Schedule.findOne({ raceId });
    if (schedule) {
      const horseIndex = schedule.registeredHorses.findIndex(
        (h) => h.horseId.toString() === horseId.toString()
      );
      if (horseIndex !== -1) {
        schedule.registeredHorses[horseIndex].jockeyId = jockeyId;
        await schedule.save();
      }
    }

    res.json({
      invitationId: invitation._id,
      status: invitation.status,
      updatedAt: invitation.updatedAt,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /admin/jockeys - Quản lý danh sách jockey (ADMIN)
exports.adminGetJockeys = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    const filter = {};
    if (status) filter.status = status;

    const skip = (page - 1) * limit;

    const jockeys = await Jockey.find(filter)
      .populate("userId", "fullName email phone")
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Jockey.countDocuments(filter);

    res.json({
      jockeys,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// HELPER: Cập nhật thống kê Jockey (wins, races, winRate)
exports.updateJockeyStats = async (jockeyId) => {
  try {
    const results = await Result.find({ jockeyId });
    const raceResults = await RaceResult.find({ "rankings.jockeyId": jockeyId });

    let races = results.length + raceResults.length;
    let wins = results.filter((r) => r.position === 1).length;

    raceResults.forEach((rr) => {
      const rank = rr.rankings.find(
        (rk) => rk.jockeyId.toString() === jockeyId.toString()
      );
      if (rank && rank.position === 1) {
        wins++;
      }
    });

    const winRate = races > 0 ? (wins / races) * 100 : 0;
    
    await Jockey.findByIdAndUpdate(jockeyId, {
      wins,
      races,
      winRate: Math.round(winRate * 100) / 100, // round to 2 decimal places
    });
  } catch (error) {
    console.error("Error updating jockey stats:", error);
  }
};

// GET /jockeys/:jockeyId/history - Xem lịch sử thi đấu của Jockey
exports.getJockeyHistory = async (req, res) => {
  try {
    const { jockeyId } = req.params;

    const jockey = await Jockey.findById(jockeyId);
    if (!jockey) {
      return res.status(404).json({ message: "Jockey not found" });
    }

    const results = await Result.find({ jockeyId })
      .populate("raceId", "name date status")
      .populate("horseId", "name breed")
      .sort({ createdAt: -1 });

    const raceResults = await RaceResult.find({ "rankings.jockeyId": jockeyId })
      .populate("raceId", "name date status")
      .sort({ createdAt: -1 });

    // Format kết quả chung
    const history = [];

    results.forEach((r) => {
      history.push({
        source: "Result",
        resultId: r._id,
        race: r.raceId,
        horse: r.horseId,
        position: r.position,
        finishTime: r.finishTime,
        status: r.status,
        date: r.createdAt,
      });
    });

    raceResults.forEach((rr) => {
      const rank = rr.rankings.find(
        (rk) => rk.jockeyId.toString() === jockeyId.toString()
      );
      history.push({
        source: "RaceResult",
        resultId: rr._id,
        race: rr.raceId,
        horseId: rank.horseId, // You might want to populate this if needed
        position: rank.position,
        finishTime: rank.finishTime,
        status: "FINISHED",
        date: rr.createdAt,
      });
    });

    // Sắp xếp theo ngày mới nhất
    history.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({
      jockeyId: jockey._id,
      totalRaces: history.length,
      history,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
