const asyncHandler = require('express-async-handler');

const allowRoles = (...allowedRoles) => {
  return asyncHandler(async (req, res, next) => {
    if (!req.user) {
      res.status(401);
      throw new Error('Not authorized');
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403);
      throw new Error('Access denied');
    }

    next();
  });
};

module.exports = { allowRoles };
