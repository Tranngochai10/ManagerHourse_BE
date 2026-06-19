const jwt = require('jsonwebtoken');
const User = require('../models/User');

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
    if (user.role === 'SPECTATOR') {
      const Spectator = require('../models/Spectator');
      const spectatorProfile = await Spectator.findOne({ userId: user._id });
      if (spectatorProfile && (spectatorProfile.points || 0) < 100000) {
        const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
        if (!spectatorProfile.lastPointsResetAt || (Date.now() - new Date(spectatorProfile.lastPointsResetAt).getTime() >= THREE_DAYS_MS)) {
          spectatorProfile.points = 10000000;
          spectatorProfile.lastPointsResetAt = new Date();
          await spectatorProfile.save();
        }
      }
    }
    
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
