const User = require("../models/User");
const Jockey = require("../models/Jockey");
const Owner = require("../models/Owner");
const Referee = require("../models/Referee");
const Spectator = require("../models/Spectator");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// Helper to generate tokens
const generateTokens = (user) => {
  const payload = { userId: user._id, role: user.role };
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: "7d",
  });
  return { accessToken, refreshToken, expiresIn: 3600 };
};

// @desc    Register a new user
// @route   POST /auth/register
// @access  Public
exports.register = async (req, res) => {
  try {
    const { email, password, fullName, phone } = req.body;
    const role = "SPECTATOR";

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(409).json({ message: "EMAIL_ALREADY_EXISTS" });
    }

    if (!password || password.length < 8) {
      return res.status(400).json({ message: "INVALID_PASSWORD_FORMAT" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      email,
      password: hashedPassword,
      fullName,
      role,
      phone,
    });

    const spectator = await Spectator.create({
      userId: user._id,
    });

    res.status(201).json({
      userId: user._id,
      email: user.email,
      role: user.role,
      points: spectator.points,
      createdAt: user.createdAt,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Auth user & get token
// @route   POST /auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user || user.isDeleted) {
      return res.status(401).json({ message: "INVALID_CREDENTIALS" });
    }

    if (user.status === 'INACTIVE') {
      return res.status(403).json({ message: "ACCOUNT_DEACTIVATED" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "INVALID_CREDENTIALS" });
    }

    // Generate tokens
    const tokens = generateTokens(user);

    // Auto-reset points for Spectator if balance is low and 3 days have passed since last reset
    let points = 0;
    if (user.role === 'SPECTATOR') {
      let spectatorProfile = await Spectator.findOne({ userId: user._id });
      if (!spectatorProfile) {
        spectatorProfile = await Spectator.create({ userId: user._id });
      }
      if ((spectatorProfile.points || 0) < 100000) {
        const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
        if (!spectatorProfile.lastPointsResetAt || (Date.now() - new Date(spectatorProfile.lastPointsResetAt).getTime() >= THREE_DAYS_MS)) {
          spectatorProfile.points = 10000000;
          spectatorProfile.lastPointsResetAt = new Date();
          await spectatorProfile.save();
        }
      }
      points = spectatorProfile.points;
    }

    // Save refresh token in DB
    user.refreshToken = tokens.refreshToken;
    await user.save();

    res.status(200).json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      user: {
        userId: user._id,
        role: user.role,
        fullName: user.fullName,
        points: points,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Refresh access token
// @route   POST /auth/refresh
// @access  Public
exports.refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken)
      return res.status(401).json({ message: "No refresh token provided" });

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      return res.status(403).json({ message: "Invalid refresh token" });
    }

    const user = await User.findById(decoded.userId);
    if (!user || user.refreshToken !== refreshToken) {
      return res.status(403).json({ message: "Invalid refresh token" });
    }

    // Generate new tokens
    const tokens = generateTokens(user);
    user.refreshToken = tokens.refreshToken;
    await user.save();

    res.status(200).json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Logout user / clear refresh token
// @route   POST /auth/logout
// @access  Private
exports.logout = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (user) {
      user.refreshToken = null;
      await user.save();
    }
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get current user profile
// @route   GET /auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = req.user.toObject ? req.user.toObject() : req.user;
    let profile = null;

    if (user.role === 'JOCKEY') {
      profile = await Jockey.findOne({ userId: user._id });
      if (!profile) {
        profile = await Jockey.create({ userId: user._id });
      }
    } else if (user.role === 'OWNER') {
      profile = await Owner.findOne({ userId: user._id });
      if (!profile) {
        profile = await Owner.create({ userId: user._id });
      }
    } else if (user.role === 'REFEREE') {
      profile = await Referee.findOne({ userId: user._id });
      if (!profile) {
        profile = await Referee.create({ userId: user._id });
      }
    } else if (user.role === 'SPECTATOR') {
      profile = await Spectator.findOne({ userId: user._id });
      if (!profile) {
        profile = await Spectator.create({ userId: user._id });
      }
    }

    res.status(200).json({
      ...user,
      profile
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Update user profile
// @route   PUT /auth/me
// @access  Private
exports.updateMe = async (req, res) => {
  try {
    const { fullName, phone } = req.body;

    const user = await User.findById(req.user._id);
    if (user) {
      user.fullName = fullName || user.fullName;
      user.phone = phone !== undefined ? phone : user.phone;

      const updatedUser = await user.save();

      let points = 0;
      if (updatedUser.role === 'SPECTATOR') {
        let spectatorProfile = await Spectator.findOne({ userId: updatedUser._id });
        if (!spectatorProfile) {
          spectatorProfile = await Spectator.create({ userId: updatedUser._id });
        }
        points = spectatorProfile.points;
      }

      res.status(200).json({
        userId: updatedUser._id,
        email: updatedUser.email,
        fullName: updatedUser.fullName,
        role: updatedUser.role,
        phone: updatedUser.phone,
        points: points,
      });
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Change password
// @route   POST /auth/change-password
// @access  Private
exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ message: "INVALID_PASSWORD_FORMAT" });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Include full document with password if we used .select('-password') in protect
    // Wait, protect middleware excludes password, but findById again brings it unless excluded.
    // Wait, let's explicitly get the user with password
    const userWithPassword = await User.findById(req.user._id);

    const isMatch = await bcrypt.compare(
      oldPassword,
      userWithPassword.password,
    );
    if (!isMatch) {
      return res.status(400).json({ message: "Incorrect old password" });
    }

    const salt = await bcrypt.genSalt(10);
    userWithPassword.password = await bcrypt.hash(newPassword, salt);
    await userWithPassword.save();

    res.status(200).json({ message: "Password changed successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Reset virtual points back to default
// @route   POST /auth/reset-points
// @access  Private (Spectator only)
exports.resetPoints = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role !== "SPECTATOR") {
      return res.status(403).json({ message: "Only Spectator accounts can reset points" });
    }

    let spectatorProfile = await Spectator.findOne({ userId: user._id });
    if (!spectatorProfile) {
      spectatorProfile = await Spectator.create({ userId: user._id });
    }

    // Only allow reset if current points are less than the minimum bet (100,000)
    const MIN_BET = 100000;
    if (spectatorProfile.points >= MIN_BET) {
      return res.status(400).json({
        message: "You still have enough points to bet. Minimum required is less than " + MIN_BET,
      });
    }

    // Check if 3 days have passed since last reset
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
    if (spectatorProfile.lastPointsResetAt) {
      const timeSinceLastReset = Date.now() - new Date(spectatorProfile.lastPointsResetAt).getTime();
      if (timeSinceLastReset < THREE_DAYS_MS) {
        const remainingTimeMs = THREE_DAYS_MS - timeSinceLastReset;
        const remainingDays = Math.ceil(remainingTimeMs / (24 * 60 * 60 * 1000));
        return res.status(400).json({
          message: `You can only reset points after 3 days. Please wait ${remainingDays} more day(s).`,
          remainingDays,
        });
      }
    }

    // Reset points
    spectatorProfile.points = 10000000;
    spectatorProfile.lastPointsResetAt = new Date();
    await spectatorProfile.save();

    res.status(200).json({
      message: "Points reset to default balance successfully",
      points: spectatorProfile.points,
      lastPointsResetAt: spectatorProfile.lastPointsResetAt,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
