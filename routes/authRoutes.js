const express = require('express');
const router = express.Router();
const { registerCompanyAdmin, loginUser, getCurrentUser, sendVerificationCode, updateUserProfile } = require('../backend/controller/authController');
const { protect } = require('../backend/middlewares/auth');
const { validate } = require('../backend/middlewares/validation');
const { registerSchema, loginSchema } = require('../backend/validators/authValidators');

router.post('/send-code', sendVerificationCode);
router.post('/signUp', validate(registerSchema), registerCompanyAdmin);
router.post('/login', validate(loginSchema), loginUser);
router.get('/me', protect, getCurrentUser);
router.put('/profile', protect, updateUserProfile);

module.exports = router;
