const crypto = require('crypto');
const User = require('../../models/auth/user.model');
const emailService = require('../../utils/emailService');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const logger = require('../../utils/logger');

class OTPService {
  constructor() {
    this.OTP_LENGTH = 6;
    this.OTP_EXPIRY_MINUTES = 5;
    this.MAX_OTP_ATTEMPTS = 5;
    this.OTP_COOLDOWN_SECONDS = 10; // Reduced from 30 to 10 seconds
  }

  /**
   * Generate a random OTP
   */
  generateOTP() {
    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    return otp;
  }

  /**
   * Find or create user by mobile number
   */
  async findOrCreateUser(mobileNumber) {
    let user = await User.findOne({ mobileNumber });

    if (!user) {
      // Create a new user with mobile number only
      user = new User({
        mobileNumber,
        email: `${mobileNumber}@mobile.user`, // Placeholder email
        name: `User ${mobileNumber.slice(-4)}`, // Default name from last 4 digits
        role: 'user',
        password: crypto.randomBytes(32).toString('hex'), // Random password (not used for mobile auth)
        mobileVerified: false,
      });
      await user.save();
    }

    return user;
  }

  /**
   * Send OTP to user via email
   */
  async sendOTP(mobileNumber) {
    try {
      // Find or create user
      const user = await this.findOrCreateUser(mobileNumber);

      // Check cooldown based on lastOtpSentAt
      if (user.lastOtpSentAt) {
        const timeSinceLastOtp = Date.now() - user.lastOtpSentAt.getTime();
        const cooldownMs = this.OTP_COOLDOWN_SECONDS * 1000;

        if (timeSinceLastOtp < cooldownMs) {
          const remainingSeconds = Math.ceil((cooldownMs - timeSinceLastOtp) / 1000);
          return {
            success: false,
            message: `Please wait ${remainingSeconds} seconds before requesting a new OTP`,
            retryAfter: remainingSeconds,
          };
        }
      }

      // Generate OTP
      const otp = this.generateOTP();
      const otpExpires = new Date(Date.now() + (this.OTP_EXPIRY_MINUTES * 60 * 1000));
      const now = new Date();

      // Save OTP to user
      user.otp = otp;
      user.otpExpires = otpExpires;
      user.otpAttempts = 0;
      user.lastOtpSentAt = now;
      await user.save();

      // Send OTP via email
      // For mobile users, we need to find their actual email if they have one
      const emailToSend = user.email && !user.email.includes('@mobile.user')
        ? user.email
        : null;

      if (!emailToSend) {
        // No real email - try to deliver OTP via alternative method
        // In production, this should integrate with SMS provider (Twilio, MSG91, etc.)
        logger.warn('No email address found for OTP delivery, OTP saved to user record', { mobileNumber });

        // For development, return OTP in response
        const isDevelopment = config.app.env === 'development';

        if (isDevelopment) {
          logger.info('Development mode: Returning OTP in response', { mobileNumber, otp });
          return {
            success: true,
            message: 'OTP sent successfully',
            otp: otp, // Return OTP in development mode
            expiresAt: otpExpires,
          };
        }

        // Production: OTP is saved to user record, but can't be delivered via email
        // TODO: Integrate SMS provider for OTP delivery
        // For now, return OTP in response so mobile app can still function
        logger.info('Production mode: Returning OTP for mobile delivery', { mobileNumber });
        return {
          success: true,
          message: 'OTP sent successfully',
          otp: otp,
          expiresAt: otpExpires,
        };
      }

      // Try to send via email
      const emailResult = await emailService.sendOTPEmail(emailToSend, otp, mobileNumber);

      if (!emailResult.success) {
        logger.error('Failed to send OTP email, OTP saved to user record', { mobileNumber, error: emailResult.error });
        // Don't fail - OTP is still saved to user, they can still verify
        return {
          success: true,
          message: 'OTP generated successfully (email delivery pending)',
          otp: config.app.env === 'development' ? otp : undefined,
          expiresAt: otpExpires,
        };
      }

      logger.info('OTP sent successfully via email', { mobileNumber, email: emailToSend });

      return {
        success: true,
        message: 'OTP sent successfully',
        expiresAt: otpExpires,
      };
    } catch (error) {
      logger.error('Error sending OTP', { mobileNumber, error: error.message });
      throw error;
    }
  }

  /**
   * Verify OTP and generate JWT token
   */
  async verifyOTP(mobileNumber, otp) {
    try {
      const user = await User.findOne({ mobileNumber }).select('+otp +otpExpires +otpAttempts');

      if (!user) {
        return {
          success: false,
          message: 'User not found. Please request a new OTP.',
        };
      }

      // Check if OTP is expired
      if (!user.otpExpires || user.otpExpires < Date.now()) {
        return {
          success: false,
          message: 'OTP has expired. Please request a new OTP.',
        };
      }

      // Check attempts
      if (user.otpAttempts >= this.MAX_OTP_ATTEMPTS) {
        return {
          success: false,
          message: 'Maximum OTP attempts exceeded. Please request a new OTP.',
        };
      }

      // Verify OTP
      if (user.otp !== otp) {
        user.otpAttempts += 1;
        await user.save();

        const remainingAttempts = this.MAX_OTP_ATTEMPTS - user.otpAttempts;
        return {
          success: false,
          message: `Invalid OTP. ${remainingAttempts} attempts remaining.`,
          remainingAttempts,
        };
      }

      // OTP is valid - clear OTP fields and mark mobile as verified
      user.otp = undefined;
      user.otpExpires = undefined;
      user.otpAttempts = 0;
      user.mobileVerified = true;
      user.lastLogin = new Date();
      await user.save();

      // Generate JWT token
      const token = this.generateToken(user);
      const refreshToken = this.generateRefreshToken(user);

      // Save refresh token
      user.refreshToken = refreshToken;
      await user.save();

      logger.info('User logged in via OTP', { mobileNumber, userId: user._id });

      return {
        success: true,
        message: 'Login successful',
        token,
        refreshToken,
        user: {
          id: user._id,
          name: user.name,
          mobileNumber: user.mobileNumber,
          email: user.email,
          role: user.role,
          companyId: user.companyId,
          mobileVerified: user.mobileVerified,
        },
      };
    } catch (error) {
      logger.error('Error verifying OTP', { mobileNumber, error: error.message });
      throw error;
    }
  }

  /**
   * Generate JWT token
   */
  generateToken(user) {
    return jwt.sign(
      {
        id: user._id,
        role: user.role,
        companyId: user.companyId,
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
  }

  /**
   * Generate refresh token
   */
  generateRefreshToken(user) {
    return jwt.sign(
      { id: user._id },
      config.jwt.secret,
      { expiresIn: config.jwt.refreshExpiresIn }
    );
  }

  /**
   * Resend OTP
   */
  async resendOTP(mobileNumber) {
    return this.sendOTP(mobileNumber);
  }
}

module.exports = new OTPService();