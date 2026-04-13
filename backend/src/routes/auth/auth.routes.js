const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const authController = require('../../controllers/auth/auth.controller');
const otpController = require('../../controllers/auth/otp.controller');
const { authenticate, authorize } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');

// Validation rules
const registerValidation = [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  // body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('password')
    .if(body('role').isIn(['admin', 'super_admin']))
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),

  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 50 }),
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 50 }),
  body('role').optional().isIn(['admin', 'user']).withMessage('Invalid role'),
  body('phone').optional().isMobilePhone().withMessage('Invalid phone number'),
  body('companyId').optional().isMongoId().withMessage('Invalid company ID'),
];

const loginValidation = [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

const refreshTokenValidation = [
  body('refreshToken').notEmpty().withMessage('Refresh token is required'),
];

const changePasswordValidation = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
];

const updateProfileValidation = [
  body('name').optional().trim().isLength({ max: 50 }).withMessage('Name cannot exceed 50 characters'),
  body('phone').optional().isMobilePhone().withMessage('Invalid phone number'),
  body('preferences.notifications.email').optional().isBoolean(),
  body('preferences.notifications.sms').optional().isBoolean(),
  body('preferences.notifications.inApp').optional().isBoolean(),
  body('preferences.timezone').optional().isString(),
  body('preferences.language').optional().isString(),
];

const resetPasswordValidation = [
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
];

// OTP validation rules
const sendOTPValidation = [
  body('mobileNumber')
    .matches(/^\d{10}$/)
    .withMessage('Mobile number must be exactly 10 digits'),
];

const verifyOTPValidation = [
  body('mobileNumber')
    .matches(/^\d{10}$/)
    .withMessage('Mobile number must be exactly 10 digits'),
  body('otp')
    .matches(/^\d{6}$/)
    .withMessage('OTP must be exactly 6 digits'),
];

// Public routes
router.post('/register', registerValidation, validate, authController.register);
router.post('/login', loginValidation, validate, authController.login);
router.post('/refresh-token', refreshTokenValidation, validate, authController.refreshToken);
router.post('/forgot-password', [body('email').isEmail()], validate, authController.forgotPassword);
router.post('/reset-password/:token', resetPasswordValidation, validate, authController.resetPassword);
router.post('/init-super-admin', authController.initSuperAdmin);

// OTP Authentication routes (public)
router.post('/send-otp', sendOTPValidation, validate, otpController.sendOTP);
router.post('/verify-otp', verifyOTPValidation, validate, otpController.verifyOTP);
router.post('/resend-otp', sendOTPValidation, validate, otpController.resendOTP);

// Protected routes
router.use(authenticate);

router.post('/logout', authController.logout);
router.get('/profile', authController.getProfile);
router.put('/profile', updateProfileValidation, validate, authController.updateProfile);
router.post('/change-password', changePasswordValidation, validate, authController.changePassword);

module.exports = router;