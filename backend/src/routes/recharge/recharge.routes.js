const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const rechargeController = require('../../controllers/recharge/recharge.controller');
const { authenticate, authorize } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');

// Validation rules
const createRechargeValidation = [
  body('simId').isMongoId().withMessage('Valid SIM ID is required'),
  body('amount').isFloat({ min: 0 }).withMessage('Valid amount is required'),
  body('validity').optional().isInt({ min: 1 }).withMessage('Validity must be at least 1 day'),
  body('rechargeDate').optional().isISO8601().withMessage('Invalid date'),
  body('paymentMethod').optional().isIn(['cash', 'upi', 'card', 'netbanking', 'wallet', 'other']),
  body('transactionId').optional().isString(),
  body('notes').optional().isString().isLength({ max: 500 }),
  body('plan.name').optional().isString(),
  body('plan.validity').optional().isInt(),
  body('plan.data').optional().isString(),
  body('plan.calls').optional().isString(),
  body('plan.sms').optional().isString(),
];

const updateRechargeValidation = [
  param('id').isMongoId().withMessage('Invalid recharge ID'),
  body('amount').optional().isFloat({ min: 0 }),
  body('validity').optional().isInt({ min: 1 }),
  body('notes').optional().isString().isLength({ max: 500 }),
  body('status').optional().isIn(['pending', 'completed', 'failed', 'refunded']),
];

const queryValidation = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('simId').optional().isMongoId(),
  query('status').optional().isIn(['pending', 'completed', 'failed', 'refunded']),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('sortBy').optional().isIn(['rechargeDate', 'amount', 'nextRechargeDate']),
  query('sortOrder').optional().isIn(['asc', 'desc']),
];

// All routes require authentication
router.use(authenticate);

// Routes
router.post('/', createRechargeValidation, validate, rechargeController.create);
router.get('/', queryValidation, validate, rechargeController.getAll);
router.get('/upcoming', rechargeController.getUpcoming);
router.get('/overdue', rechargeController.getOverdue);
router.get('/stats', rechargeController.getStats);
router.get('/history/:simId', rechargeController.getHistory);
router.get('/:id', rechargeController.getById);
router.put('/:id', updateRechargeValidation, validate, rechargeController.update);
router.delete('/:id', authorize('super_admin', 'admin'), rechargeController.delete);

// Admin only - manual trigger
router.post('/process-reminders', authorize('super_admin'), rechargeController.processReminders);

module.exports = router;