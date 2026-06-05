const Jockey = require("../models/Jockey");
const Invitation = require("../models/Invitation");
const RaceRegistration = require("../models/RaceRegistration");
const Race = require("../models/Race");
const Horse = require("../models/Horse");

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
      .populate("horseId", "name")
      .populate("raceId", "name date")
      .populate("ownerId", "name email")
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
      .populate("userId", "name email phone")
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
