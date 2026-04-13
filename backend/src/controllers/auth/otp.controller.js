const otpService = require('../../services/auth/otp.service');
const logger = require('../../utils/logger');

/**
 * Send OTP to mobile number
 * POST /api/auth/send-otp
 */
const sendOTP = async (req, res) => {
  try {
    const { mobileNumber } = req.body;

    // Validate mobile number
    if (!mobileNumber) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number is required',
      });
    }

    // Validate format (10 digits)
    if (!/^\d{10}$/.test(mobileNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid mobile number. Please enter a 10-digit number.',
      });
    }

    const result = await otpService.sendOTP(mobileNumber);

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

    // Validate mobile number format
    if (!/^\d{10}$/.test(mobileNumber)) {
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

    const result = await otpService.verifyOTP(mobileNumber, otp);

    if (!result.success) {
      return res.status(401).json(result);
    }

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

    // Validate format
    if (!/^\d{10}$/.test(mobileNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid mobile number format',
      });
    }

    const result = await otpService.resendOTP(mobileNumber);

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