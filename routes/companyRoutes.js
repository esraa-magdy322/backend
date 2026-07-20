const express = require('express');
const router = express.Router();
const { protect } = require('../backend/middlewares/auth');
const { allowRoles } = require('../backend/middlewares/roleMiddleware');
const {
  getCompanyProfile,
  updateCompanyProfile,
  updateCompanyLogo,
} = require('../backend/controller/companyController');

router.use(protect, allowRoles('company_admin', 'superadmin'));

router.get('/profile', getCompanyProfile);
router.put('/profile', updateCompanyProfile);
router.put('/logo', updateCompanyLogo);

module.exports = router;
