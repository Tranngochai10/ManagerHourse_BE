const User = require('../models/User');
const Jockey = require('../models/Jockey');
const bcrypt = require('bcryptjs');

// ─── GET /admin/users ─────────────────────────────────────────────────────────

/**
 * @desc  Danh sách tất cả user (filter, search, phân trang)
 * @route GET /admin/users
 * @access ADMIN
 */
exports.getAllUsers = async (req, res) => {
  try {
    const { role, status, search, page = 1, limit = 20 } = req.query;

    const query = { isDeleted: false };

    // Role filter
    const validRoles = ['OWNER', 'JOCKEY', 'SPECTATOR', 'ADMIN', 'REFEREE'];
    if (role && validRoles.includes(role)) {
      query.role = role;
    }

    // Status filter
    if (status === 'ACTIVE' || status === 'INACTIVE') {
      query.status = status;
    }

    // Search by email or fullName (case-insensitive)
    if (search) {
      query.$or = [
        { email: { $regex: search, $options: 'i' } },
        { fullName: { $regex: search, $options: 'i' } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [total, users] = await Promise.all([
      User.countDocuments(query),
      User.find(query)
        .select('-password -refreshToken -isDeleted')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
    ]);

    const data = users.map((u) => ({
      userId: u._id,
      email: u.email,
      fullName: u.fullName,
      role: u.role,
      phone: u.phone,
      status: u.status,
      createdAt: u.createdAt,
    }));

    res.status(200).json({
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      data,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── GET /admin/users/:userId ─────────────────────────────────────────────────

/**
 * @desc  Chi tiết user
 * @route GET /admin/users/:userId
 * @access ADMIN
 */
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.userId, isDeleted: false })
      .select('-password -refreshToken -isDeleted');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({
      userId: user._id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      phone: user.phone,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── PATCH /admin/users/:userId/role ─────────────────────────────────────────

/**
 * @desc  Thay đổi role của user
 * @route PATCH /admin/users/:userId/role
 * @access ADMIN
 */
exports.changeUserRole = async (req, res) => {
  try {
    const { role } = req.body;

    const validRoles = ['OWNER', 'JOCKEY', 'SPECTATOR', 'ADMIN', 'REFEREE'];
    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({
        message: `role must be one of: ${validRoles.join(', ')}`,
      });
    }

    const user = await User.findOne({ _id: req.params.userId, isDeleted: false });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Cannot change ADMIN role (either direction)
    if (user.role === 'ADMIN') {
      return res.status(403).json({ message: 'CANNOT_CHANGE_ADMIN_ROLE' });
    }
    if (role === 'ADMIN') {
      return res.status(403).json({ message: 'CANNOT_CHANGE_ADMIN_ROLE' });
    }

    user.role = role;
    await user.save();

    res.status(200).json({
      userId: user._id,
      role: user.role,
      updatedAt: user.updatedAt,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── PATCH /admin/users/:userId/activate ─────────────────────────────────────

/**
 * @desc  Kích hoạt tài khoản
 * @route PATCH /admin/users/:userId/activate
 * @access ADMIN
 */
exports.activateUser = async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.userId, isDeleted: false });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.status === 'ACTIVE') {
      return res.status(400).json({ message: 'Account is already active' });
    }

    user.status = 'ACTIVE';
    await user.save();

    res.status(200).json({
      userId: user._id,
      status: user.status,
      updatedAt: user.updatedAt,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── PATCH /admin/users/:userId/deactivate ───────────────────────────────────

/**
 * @desc  Vô hiệu hóa tài khoản
 * @route PATCH /admin/users/:userId/deactivate
 * @access ADMIN
 */
exports.deactivateUser = async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.userId, isDeleted: false });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent deactivating another ADMIN
    if (user.role === 'ADMIN') {
      return res.status(403).json({ message: 'Cannot deactivate an ADMIN account' });
    }

    if (user.status === 'INACTIVE') {
      return res.status(400).json({ message: 'Account is already inactive' });
    }

    user.status = 'INACTIVE';
    // Revoke refresh token so active sessions expire
    user.refreshToken = null;
    await user.save();

    res.status(200).json({
      userId: user._id,
      status: user.status,
      updatedAt: user.updatedAt,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── DELETE /admin/users/:userId ─────────────────────────────────────────────

/**
 * @desc  Xóa tài khoản (soft delete)
 * @route DELETE /admin/users/:userId
 * @access ADMIN
 */
exports.deleteUser = async (req, res) => {
  try {
    // Prevent self-deletion
    if (req.params.userId === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    const user = await User.findOne({ _id: req.params.userId, isDeleted: false });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent deleting another ADMIN
    if (user.role === 'ADMIN') {
      return res.status(403).json({ message: 'Cannot delete an ADMIN account' });
    }

    user.isDeleted = true;
    user.status = 'INACTIVE';
    user.refreshToken = null;
    await user.save();

    res.status(200).json({
      userId: user._id,
      message: 'User deleted successfully',
      deletedAt: user.updatedAt,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── POST /admin/users ────────────────────────────────────────────────────────

/**
 * @desc  Admin tạo tài khoản cho OWNER, JOCKEY, REFEREE
 * @route POST /admin/users
 * @access ADMIN
 */
exports.createUser = async (req, res) => {
  try {
    const { email, password, fullName, role, phone } = req.body;

    const allowedRoles = ['OWNER', 'JOCKEY', 'REFEREE'];
    if (!role || !allowedRoles.includes(role)) {
      return res.status(400).json({
        message: `Role must be one of: ${allowedRoles.join(', ')}`,
      });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(409).json({ message: 'EMAIL_ALREADY_EXISTS' });
    }

    if (!password || password.length < 8) {
      return res.status(400).json({ message: 'INVALID_PASSWORD_FORMAT' });
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

    if (role === 'JOCKEY') {
      await Jockey.create({
        userId: user._id,
        fullName: fullName,
        phone: phone || '',
      });
    }

    res.status(201).json({
      userId: user._id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      phone: user.phone,
      status: user.status,
      createdAt: user.createdAt,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
