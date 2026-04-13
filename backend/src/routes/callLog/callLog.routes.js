const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const callLogController = require('../../controllers/callLog/callLog.controller');
const { authenticate, checkCompanyAccess } = require('../../middleware/auth');
const { checkSubscriptionLimit } = require('../../middleware/subscription');
const { validate } = require('../../middleware/validate');

// Validation rules
const syncValidation = [
  body('simId').isMongoId().withMessage('Valid SIM ID is required'),
  body('callLogs').isArray({ min: 1 }).withMessage('Call logs array is required'),
  body('callLogs.*.phoneNumber').notEmpty().withMessage('Phone number is required'),
  body('callLogs.*.callType').isIn(['incoming', 'outgoing', 'missed']).withMessage('Invalid call type'),
  body('callLogs.*.duration').optional().isInt({ min: 0 }),
  body('callLogs.*.timestamp').isISO8601().withMessage('Valid timestamp is required'),
  body('callLogs.*.contactName').optional().isString(),
];

// Validation rules for device sync (public endpoint)
const deviceSyncValidation = [
  body('mobileNumber')
    .matches(/^\d{10}$/)
    .withMessage('Mobile number must be exactly 10 digits'),
  body('callLogs').isArray({ min: 1 }).withMessage('Call logs array is required'),
  body('callLogs.*.phoneNumber').notEmpty().withMessage('Phone number is required'),
  body('callLogs.*.callType').isIn(['incoming', 'outgoing', 'missed']).withMessage('Invalid call type'),
  body('callLogs.*.duration').optional().isInt({ min: 0 }),
  body('callLogs.*.timestamp').isISO8601().withMessage('Valid timestamp is required'),
  body('callLogs.*.contactName').optional().isString(),
];

const queryValidation = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('simId').optional().isMongoId(),
  query('callType').optional().isIn(['incoming', 'outgoing', 'missed']),
  query('phoneNumber').optional().trim(),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('sortBy').optional().isIn(['timestamp', 'duration', 'callType']),
  query('sortOrder').optional().isIn(['asc', 'desc']),
];

const flagValidation = [
  param('id').isMongoId().withMessage('Invalid call log ID'),
  body('flagged').isBoolean().withMessage('Flagged must be a boolean'),
  body('reason').optional().isString().isLength({ max: 200 }),
];

// Public routes (no authentication required)
router.post('/device-sync', deviceSyncValidation, validate, callLogController.deviceSync);

// All routes below require authentication
router.use(authenticate);

// Routes
router.post('/sync', checkSubscriptionLimit('callLogSync'), syncValidation, validate, callLogController.sync);
router.get('/', queryValidation, validate, callLogController.getAll);
router.get('/stats', callLogController.getStats);
router.get('/export', callLogController.export);
router.get('/:id', callLogController.getById);
router.get('/sim/:simId/stats', callLogController.getSimStats);
router.patch('/:id/flag', flagValidation, validate, callLogController.flag);

module.exports = router;