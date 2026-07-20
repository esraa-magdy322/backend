const asyncHandler = require('express-async-handler');

const adminOnly = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    res.status(401);
    throw new Error('Not authorized');
  }

  if (req.user.role !== 'superadmin') {
    res.status(403);
    throw new Error('Access denied: Super Admin only');
  }

  next();
});

module.exports = { adminOnly };
