const { protect } = require('./auth');
const { handleError } = require('./errorHandler');
const { validate } = require('./validation');

module.exports = {
  protect,
  handleError,
  validate
};
