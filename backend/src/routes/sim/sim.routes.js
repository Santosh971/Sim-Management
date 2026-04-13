const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const simController = require('../../controllers/sim/sim.controller');
const { authenticate, authorize, checkCompanyAccess } = require('../../middleware/auth');
const { checkSubscriptionLimit } = require('../../middleware/subscription');
const { validate } = require('../../middleware/validate');

// Multer configuration for Excel upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'sim-import-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files are allowed'), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// Validation rules
const createSimValidation = [
  body('mobileNumber').matches(/^\d{10}$/).withMessage('Valid 10-digit mobile number required'),
  body('operator').isIn(['Jio', 'Airtel', 'Vi', 'BSNL', 'MTNL', 'Other']).withMessage('Invalid operator'),
  body('companyId').optional().isMongoId().withMessage('Invalid company ID'),
  body('circle').optional().isString(),
  body('notes').optional().isString().isLength({ max: 500 }),
];

const bulkCreateValidation = [
  body('sims').isArray({ min: 1 }).withMessage('SIMs must be a non-empty array'),
  body('sims.*.mobileNumber').matches(/^\d{10}$/).withMessage('Valid 10-digit mobile number required'),
  body('sims.*.operator').isIn(['Jio', 'Airtel', 'Vi', 'BSNL', 'MTNL', 'Other']).withMessage('Invalid operator'),
  body('sims.*.status').optional().isIn(['active', 'inactive', 'suspended', 'lost']),
  body('sims.*.assignedUserEmail').optional().isEmail().withMessage('Valid email required for assigned user'),
];

const updateSimValidation = [
  param('id').isMongoId().withMessage('Invalid SIM ID'),
  body('mobileNumber').optional().matches(/^\d{10}$/),
  body('operator').optional().isIn(['Jio', 'Airtel', 'Vi', 'BSNL', 'MTNL', 'Other']),
  body('circle').optional().isString(),
  body('notes').optional().isString().isLength({ max: 500 }),
  body('status').optional().isIn(['active', 'inactive', 'suspended', 'lost']),
];

const queryValidation = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().trim(),
  query('status').optional().isIn(['active', 'inactive', 'suspended', 'lost']),
  query('operator').optional().isIn(['Jio', 'Airtel', 'Vi', 'BSNL', 'MTNL', 'Other']),
  query('sortBy').optional().isIn(['createdAt', 'mobileNumber', 'status', 'operator']),
  query('sortOrder').optional().isIn(['asc', 'desc']),
];

const statusValidation = [
  param('id').isMongoId().withMessage('Invalid SIM ID'),
  body('status').isIn(['active', 'inactive', 'suspended', 'lost']).withMessage('Invalid status'),
];

const assignValidation = [
  param('id').isMongoId().withMessage('Invalid SIM ID'),
  body('userId').isMongoId().withMessage('Invalid user ID'),
];

const messagingStatusValidation = [
  param('id').isMongoId().withMessage('Invalid SIM ID'),
  body('platform').isIn(['whatsapp', 'telegram']).withMessage('Platform must be whatsapp or telegram'),
  body('enabled').isBoolean().withMessage('Enabled must be a boolean'),
];

// All routes require authentication
router.use(authenticate);

// Routes
router.post('/bulk', checkCompanyAccess, checkSubscriptionLimit('sims'), bulkCreateValidation, validate, simController.bulkCreate);
router.post('/', checkCompanyAccess, checkSubscriptionLimit('sims'), createSimValidation, validate, simController.create);
router.post('/import', checkCompanyAccess, checkSubscriptionLimit('sims'), upload.single('file'), simController.bulkImport);
router.get('/template', simController.downloadTemplate);
router.get('/export', simController.export);
router.get('/stats', simController.getStats);
router.get('/messaging-stats', simController.getMessagingStats);
router.get('/', queryValidation, validate, simController.getAll);
router.get('/:id', simController.getById);
router.put('/:id', updateSimValidation, validate, simController.update);
router.delete('/:id', authorize('super_admin', 'admin'), simController.delete);
router.patch('/:id/status', statusValidation, validate, simController.updateStatus);
router.patch('/:id/messaging', messagingStatusValidation, validate, simController.updateMessagingStatus);
router.post('/:id/assign', assignValidation, validate, simController.assign);
router.post('/:id/unassign', simController.unassign);

module.exports = router;