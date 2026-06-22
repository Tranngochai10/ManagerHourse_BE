const jwt = require('jsonwebtoken');
const User = require('../models/User');
const checkExpiredInvitationsAndFallback = require('../utils/invitationFallback');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Attach user to request, excluding password
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      return res.status(401).json({ message: 'Not authorized, user not found' });
    }

    // Auto-reset points for Spectator if balance is low and 3 days have passed since last reset
    if (user.role === 'SPECTATOR' && (user.points || 0) < 100000) {
      const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
      if (!user.lastPointsResetAt || (Date.now() - new Date(user.lastPointsResetAt).getTime() >= THREE_DAYS_MS)) {
        user.points = 10000000;
        user.lastPointsResetAt = new Date();
        await user.save();
      }
    }

    // Tự động kiểm tra và hủy các đăng ký đua khi lời mời Jockey đã hết hạn và cận giờ đua
    checkExpiredInvitationsAndFallback().catch((err) =>
      console.error('Error running checkExpiredInvitationsAndFallback:', err)
    );
    
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: `User role ${req.user ? req.user.role : 'Unknown'} is not authorized to access this route` });
    }
    next();
  };
};

module.exports = { protect, authorize };
