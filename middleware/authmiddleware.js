const jwt = require('jsonwebtoken');
const User = require('../models/user.js');
const logger = require('../utils/logger');

const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');

        if (!user) {
          logger.warn("User not found for token", { token });
          return res.status(401).json({ message: 'Not authorized, user does not exist' });
        }

        req.user = user;
        logger.info("User authenticated", { email: req.user.email });
        next();
      } catch (jwtError) {
        logger.error("Token verification failed", { error: jwtError.message });
        return res.status(401).json({ message: 'Not authorized, invalid token' });
      }
    } else {
      logger.warn("No token provided in authorization header");
      return res.status(401).json({ message: 'Not authorized, token missing' });
    }
  } catch (error) {
    logger.error("Unexpected auth error", { error: error.message });
    return res.status(500).json({ message: 'Internal server error' });
  }
};

const admin = (req, res, next) => {
  if (!req.user) {
    logger.warn("Admin check failed: no user in request");
    return res.status(401).json({ message: 'Not authorized, user not found' });
  }

  logger.info("Checking admin access", { email: req.user.email });

  if (req.user.isAdmin === true) {
    logger.info("Admin access granted", { email: req.user.email });
    next();
  } else {
    logger.warn("Admin access denied", { email: req.user.email });
    return res.status(403).json({ message: 'Not authorized as admin' });
  }
};

module.exports = { protect, admin };