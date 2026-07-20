const express = require('express');
const router = express.Router();
const { protect } = require('../backend/middlewares/auth');
const { allowRoles } = require('../backend/middlewares/roleMiddleware');
const {
  getDashboardStats,
  getCompanies,
  getCompanyById,
  createCompany,
  updateCompany,
  deleteCompany,
  activateCompany,
  suspendCompany,
} = require('../backend/controller/adminController');

router.use(protect, allowRoles('superadmin'));

router.get('/dashboard', getDashboardStats);
router.get('/companies', getCompanies);
router.get('/companies/:id', getCompanyById);
router.post('/companies', createCompany);
router.put('/companies/:id', updateCompany);
router.delete('/companies/:id', deleteCompany);
router.post('/companies/:id/activate', activateCompany);
router.post('/companies/:id/suspend', suspendCompany);

module.exports = router;
