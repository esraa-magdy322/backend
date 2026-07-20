const express = require('express');
const router = express.Router();
const { protect } = require('../backend/middlewares/auth');
const { allowRoles } = require('../backend/middlewares/roleMiddleware');
const {
  createSubscription,
  getSubscription,
  updateSubscription,
  activateSubscription,
  cancelSubscription,
} = require('../backend/controller/subscriptionController');

router.use(protect, allowRoles('company_admin', 'superadmin'));

router.post('/', createSubscription);
router.get('/company/:companyId', getSubscription);
router.put('/:id', updateSubscription);
router.post('/:id/activate', activateSubscription);
router.post('/:id/cancel', cancelSubscription);

module.exports = router;
