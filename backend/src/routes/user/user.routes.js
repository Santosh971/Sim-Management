const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const userController = require('../../controllers/user/user.controller');
const { authenticate, authorize } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');

// Validation rules
const createUserValidation = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 50 }),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  // body('password').optional().isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('password')
    .optional({ checkFalsy: true })
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
  body('phone').optional().isMobilePhone().withMessage('Invalid phone number'),
];

const updateUserValidation = [
  param('id').isMongoId().withMessage('Invalid user ID'),
  body('name').optional().trim().isLength({ max: 50 }),
  body('phone').optional().isMobilePhone().withMessage('Invalid phone number'),
  body('isActive').optional().isBoolean(),
];

const resetPasswordValidation = [
  param('id').isMongoId().withMessage('Invalid user ID'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
];

const queryValidation = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().trim(),
  query('status').optional().isIn(['active', 'inactive']),
  query('role').optional().isIn(['user', 'admin']),
  query('sortBy').optional().isIn(['name', 'createdAt', 'email']),
  query('sortOrder').optional().isIn(['asc', 'desc']),
];

// All routes require authentication and admin role
router.use(authenticate);
router.use(authorize('super_admin', 'admin'));

// Routes
router.get('/stats', userController.getStats);
router.get('/company', userController.getCompanyUsers);
router.get('/', queryValidation, validate, userController.getAll);
router.get('/:id', userController.getById);
router.post('/', createUserValidation, validate, userController.create);
router.put('/:id', updateUserValidation, validate, userController.update);
router.delete('/:id', userController.delete);
router.post('/:id/reset-password', resetPasswordValidation, validate, userController.resetPassword);

module.exports = router;