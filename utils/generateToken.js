const jwt = require('jsonwebtoken');
require('dotenv').config();

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      isAdmin: user.isAdmin,
      isApproved: user.isApproved
    },
    process.env.JWT_SECRET,
    {
      expiresIn: '6d',
    }
  );
};

module.exports = generateToken;