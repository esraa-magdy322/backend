const express = require('express');
const router  = express.Router();
const { protect } = require('../backend/middlewares/auth');
const {
  createPayslip,
  getPayslips,
  getPayrollTrend,
  updatePayslip,
  deletePayslip,
} = require('../backend/controller/payrollController');

// All routes require login
router.use(protect);

router.post('/payslips',          createPayslip);     // Create payslip
router.get('/payslips',           getPayslips);       // Get payslips for a month
router.get('/payslips/trend',     getPayrollTrend);   // Last 6 months trend
router.put('/payslips/:id',       updatePayslip);     // Update payslip
router.delete('/payslips/:id',    deletePayslip);     // Delete payslip

module.exports = router;
