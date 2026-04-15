const crypto = require('crypto');
const User = require('../../models/auth/user.model');
const emailService = require('../../utils/emailService');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const logger = require('../../utils/logger');
// [OTP EMAIL FIX] - Import normalizePhoneNumber for phone number handling
const { normalizePhoneNumber } = require('../../utils/response');

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
   * [PHONE NORMALIZATION FIX] - Handle both phone formats for backward compatibility
   * [OTP EMAIL FIX] - Also check 'phone' field for users created by admin
   * [AUDIT LOG FIX] - Only create user if created by admin; don't create placeholder users
   */
  async findOrCreateUser(mobileNumber) {
    // [PHONE NORMALIZATION FIX] - Normalize phone number
    const { normalized } = normalizePhoneNumber(mobileNumber);
    const normalizedNumber = normalized || mobileNumber;

    // [OTP EMAIL FIX] - Build query to check multiple fields
    // Check: 1) mobileNumber field, 2) phone field (for admin-created users)
    // Handle both formats: 10-digit and with country code
    const last10Digits = normalizedNumber.slice(-10);

    const phoneQuery = {
      $or: [
        // Check mobileNumber field with various formats
        { mobileNumber: normalizedNumber },
        { mobileNumber: last10Digits },
        { mobileNumber: `+91${last10Digits}` },
        // Check phone field with various formats (for admin-created users)
        { phone: normalizedNumber },
        { phone: last10Digits },
        { phone: `+91${last10Digits}` },
      ]
    };

    let user = await User.findOne(phoneQuery);

    if (!user) {
      // [AUDIT LOG FIX] - Don't create placeholder users anymore
      // Users must be created by admin first with proper email and companyId
      // Return null to indicate user not found and should not be created
      logger.warn('[AUDIT LOG FIX] User not found for OTP - must be created by admin first', {
        mobileNumber: normalizedNumber,
        last10Digits
      });
      return null;
    } else {
      // [OTP EMAIL FIX] - User found - update mobileNumber if not set
      const last4Digits = last10Digits.slice(-4);

      // Update mobileNumber if not set (for admin-created users)
      if (!user.mobileNumber) {
        user.mobileNumber = normalizedNumber;
        logger.info('[OTP EMAIL FIX] Updated mobileNumber for existing user', {
          userId: user._id,
          email: user.email,
          mobileNumber: normalizedNumber
        });
      }

      // Save if there were changes
      if (user.isModified()) {
        await user.save();
      }
    }

    return user;
  }

  /**
   * Send OTP to user via email
   * [OTP EMAIL FIX] - Send OTP to user's registered email address
   * [AUDIT LOG FIX] - Only send OTP to users created by admin
   */
  async sendOTP(mobileNumber) {
    try {
      // Find user (don't create if not exists)
      const user = await this.findOrCreateUser(mobileNumber);

      // [AUDIT LOG FIX] - If user not found, they need to be created by admin first
      if (!user) {
        // Normalize phone number for logging
        const { normalized } = normalizePhoneNumber(mobileNumber);
        const normalizedNumber = normalized || mobileNumber;

        logger.warn('[AUDIT LOG FIX] User not found - must be created by admin first', {
          mobileNumber: normalizedNumber
        });

        return {
          success: false,
          message: 'No account found for this mobile number. Please contact your administrator to register.',
          requiresAdminAction: true,
        };
      }

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

      // [OTP EMAIL FIX] - Determine the email to send OTP
      // Priority: 1) User's real email (not placeholder), 2) Development fallback
      const isPlaceholderEmail = user.email && user.email.includes('@mobile.user');
      const emailToSend = isPlaceholderEmail ? null : user.email;

      logger.info('[OTP EMAIL FIX] Attempting to send OTP', {
        mobileNumber,
        userId: user._id,
        userEmail: user.email,
        isPlaceholderEmail,
        hasRealEmail: !!emailToSend
      });

      if (!emailToSend) {
        // [OTP EMAIL FIX] - No real email found - user needs to be created by admin first
        logger.warn('[OTP EMAIL FIX] No real email found for OTP delivery', {
          mobileNumber,
          placeholderEmail: user.email,
          suggestion: 'User should be created by admin with email and phone before OTP login'
        });

        // For development, return OTP in response
        const isDevelopment = config.app.env === 'development';

        if (isDevelopment) {
          logger.info('Development mode: Returning OTP in response', { mobileNumber, otp });
          return {
            success: true,
            message: 'OTP sent successfully (development mode)',
            otp: otp, // Return OTP in development mode
            expiresAt: otpExpires,
            email: user.email, // Include email for debugging
          };
        }

        // Production: Return error - user must have email registered
        return {
          success: false,
          message: 'No email address registered for this mobile number. Please contact your administrator to add your email.',
          requiresAdminAction: true,
        };
      }

      // [OTP EMAIL FIX] - Send OTP via email to user's registered email
      try {
        const emailResult = await emailService.sendOTPEmail(emailToSend, otp, mobileNumber);

        if (!emailResult.success) {
          logger.error('[OTP EMAIL FIX] Failed to send OTP email', {
            mobileNumber,
            email: emailToSend,
            error: emailResult.error
          });

          // Still allow development mode to work
          const isDevelopment = config.app.env === 'development';
          if (isDevelopment) {
            return {
              success: true,
              message: 'OTP generated (email delivery failed - check SMTP config)',
              otp: otp,
              expiresAt: otpExpires,
              email: emailToSend,
            };
          }

          return {
            success: false,
            message: 'Failed to send OTP email. Please try again or contact support.',
          };
        }

        logger.info('[OTP EMAIL FIX] OTP sent successfully via email', {
          mobileNumber,
          email: emailToSend,
          userId: user._id
        });
        
        return {
          success: true,
          message: 'OTP sent successfully to your registered email address',
          expiresAt: otpExpires,
          emailSent: true,
        };
      } catch (emailError) {
        logger.error('[OTP EMAIL FIX] Email sending error', {
          mobileNumber,
          error: emailError.message
        });

        // Fallback for development
        const isDevelopment = config.app.env === 'development';
        if (isDevelopment) {
          return {
            success: true,
            message: 'OTP generated (email service error)',
            otp: otp,
            expiresAt: otpExpires,
            email: emailToSend,
          };
        }

        return {
          success: false,
          message: 'Failed to send OTP. Please try again later.',
        };
      }
    } catch (error) {
      logger.error('Error sending OTP', { mobileNumber, error: error.message });
      throw error;
    }
  }

  /**
   * Verify OTP and generate JWT token
   * [OTP EMAIL FIX] - Handle both mobileNumber and phone fields for backward compatibility
   */
  async verifyOTP(mobileNumber, otp) {
    try {
      // [OTP EMAIL FIX] - Normalize phone number
      const { normalized } = normalizePhoneNumber(mobileNumber);
      const normalizedNumber = normalized || mobileNumber;
      const last10Digits = normalizedNumber.slice(-10);

      // [OTP EMAIL FIX] - Build query to check multiple fields
      const phoneQuery = {
        $or: [
          // Check mobileNumber field with various formats
          { mobileNumber: normalizedNumber },
          { mobileNumber: last10Digits },
          { mobileNumber: `+91${last10Digits}` },
          // Check phone field with various formats (for admin-created users)
          { phone: normalizedNumber },
          { phone: last10Digits },
          { phone: `+91${last10Digits}` },
        ]
      };

      const user = await User.findOne(phoneQuery).select('+otp +otpExpires +otpAttempts');

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

      // [OTP EMAIL FIX] - Ensure mobileNumber is set for future logins
      if (!user.mobileNumber) {
        user.mobileNumber = normalizedNumber;
      }

      await user.save();

      // Generate JWT token
      const token = this.generateToken(user);
      const refreshToken = this.generateRefreshToken(user);

      // Save refresh token
      user.refreshToken = refreshToken;
      await user.save();

      logger.info('[OTP EMAIL FIX] User logged in via OTP', {
        mobileNumber,
        userId: user._id,
        email: user.email,
        name: user.name
      });

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