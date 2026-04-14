const otpService = require('../../services/auth/otp.service');
const logger = require('../../utils/logger');
const auditLogService = require('../../services/auditLog/auditLog.service');
// [PHONE NORMALIZATION FIX]
const { normalizePhoneNumber } = require('../../utils/response');

/**
 * Send OTP to mobile number
 * POST /api/auth/send-otp
 */
const sendOTP = async (req, res) => {
  try {
    // [PHONE NORMALIZATION FIX] - Normalize phone number
    const { mobileNumber } = req.body;

    // Validate mobile number
    if (!mobileNumber) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number is required',
      });
    }

    // [PHONE NORMALIZATION FIX] - Normalize and validate phone number
    const { normalized, original, valid } = normalizePhoneNumber(mobileNumber);

    if (!valid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid mobile number. Please enter a valid 10-digit number or number with country code.',
      });
    }

    // [PHONE NORMALIZATION FIX] - Log normalization
    logger.info('Phone number normalized for sendOTP', {
      original: original,
      normalized: normalized
    });

    const result = await otpService.sendOTP(normalized);

    // [AUDIT LOG] - Log OTP send attempt (no user session yet, so performedBy is null)
    await auditLogService.logAction({
      action: 'OTP_SEND',
      module: 'AUTH',
      description: `OTP sent to mobile number ${normalized}`,
      performedBy: null, // No user session yet
      role: 'user',
      companyId: null,
      metadata: {
        mobileNumber: normalized,
        success: result.success,
      },
      req,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    logger.error('Send OTP error', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to send OTP. Please try again.',
    });
  }
};

/**
 * Verify OTP and login
 * POST /api/auth/verify-otp
 */
const verifyOTP = async (req, res) => {
  try {
    const { mobileNumber, otp } = req.body;

    // Validate inputs
    if (!mobileNumber || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number and OTP are required',
      });
    }

    // [PHONE NORMALIZATION FIX] - Normalize and validate phone number
    const { normalized, original, valid } = normalizePhoneNumber(mobileNumber);

    if (!valid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid mobile number format',
      });
    }

    // Validate OTP format (6 digits)
    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP format. OTP must be 6 digits.',
      });
    }

    // [PHONE NORMALIZATION FIX] - Log normalization
    logger.info('Phone number normalized for verifyOTP', {
      original: original,
      normalized: normalized
    });

    const result = await otpService.verifyOTP(normalized, otp);

    if (!result.success) {
      return res.status(401).json(result);
    }

    // [AUDIT LOG] - Log mobile user login
    await auditLogService.logAction({
      action: 'USER_LOGIN',
      module: 'AUTH',
      description: `Mobile user logged in via OTP (${result.user.mobileNumber})`,
      performedBy: result.user.id,
      role: result.user.role,
      companyId: result.user.companyId || null,
      metadata: {
        loginMethod: 'otp',
        mobileNumber: result.user.mobileNumber,
        userAgent: req.headers['user-agent'],
      },
      req,
    });

    return res.status(200).json(result);
  } catch (error) {
    logger.error('Verify OTP error', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to verify OTP. Please try again.',
    });
  }
};

/**
 * Resend OTP
 * POST /api/auth/resend-otp
 */
const resendOTP = async (req, res) => {
  try {
    const { mobileNumber } = req.body;

    // Validate mobile number
    if (!mobileNumber) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number is required',
      });
    }

    // [PHONE NORMALIZATION FIX] - Normalize and validate phone number
    const { normalized, original, valid } = normalizePhoneNumber(mobileNumber);

    if (!valid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid mobile number format',
      });
    }

    // [PHONE NORMALIZATION FIX] - Log normalization
    logger.info('Phone number normalized for resendOTP', {
      original: original,
      normalized: normalized
    });

    const result = await otpService.resendOTP(normalized);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    logger.error('Resend OTP error', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to resend OTP. Please try again.',
    });
  }
};

module.exports = {
  sendOTP,
  verifyOTP,
  resendOTP,
};