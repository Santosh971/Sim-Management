const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const notificationController = require('../../controllers/notification/notification.controller');
const { authenticate } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');

// Validation rules
const queryValidation = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('type').optional().isIn(['recharge_due', 'inactive_sim', 'subscription_expiry', 'system', 'alert', 'info']),
  query('isRead').optional().isBoolean(),
  query('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
];

const preferencesValidation = [
  body('notifications.email').optional().isBoolean(),
  body('notifications.sms').optional().isBoolean(),
  body('notifications.inApp').optional().isBoolean(),
  body('timezone').optional().isString(),
  body('language').optional().isString(),
];

const idValidation = [
  param('id').isMongoId().withMessage('Invalid notification ID'),
];

// All routes require authentication
router.use(authenticate);

// Routes - IMPORTANT: Static routes must come BEFORE dynamic routes (/:id)
router.get('/', queryValidation, validate, notificationController.getAll);
router.get('/user', queryValidation, validate, notificationController.getUserNotifications);
router.get('/unread-count', notificationController.getUnreadCount);
router.post('/mark-all-read', notificationController.markAllAsRead);
router.post('/clear-read', notificationController.clearRead);
router.put('/preferences', preferencesValidation, validate, notificationController.updatePreferences);
// Dynamic routes with :id must come AFTER all static routes
router.get('/:id', idValidation, validate, notificationController.getById);
router.patch('/:id/read', idValidation, validate, notificationController.markAsRead);
router.delete('/:id', idValidation, validate, notificationController.delete);

module.exports = router;