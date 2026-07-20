const express = require('express');
const router = express.Router();
const { protect } = require('../backend/middlewares/auth');
const { allowRoles } = require('../backend/middlewares/roleMiddleware');
const {
  createPayment,
  getCompanyPayments,
  getPaymentById,
  updatePaymentStatus,
} = require('../backend/controller/paymentController');

router.use(protect, allowRoles('company_admin', 'superadmin'));

router.post('/', createPayment);
router.get('/company/:companyId', getCompanyPayments);
router.get('/:id', getPaymentById);
router.put('/:id', updatePaymentStatus);

module.exports = router;
