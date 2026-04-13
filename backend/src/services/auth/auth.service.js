const jwt = require('jsonwebtoken');
const User = require('../../models/auth/user.model');
const Company = require('../../models/company/company.model');
const Subscription = require('../../models/subscription/subscription.model');
const { AppError, UnauthorizedError, ConflictError, NotFoundError } = require('../../utils/errors');
const config = require('../../config');
const emailService = require('../../utils/emailService');
const crypto = require('crypto');

class AuthService {
  async register(userData) {
    const { email, password, name, role, companyId, phone } = userData;

    // Check if user exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      throw new ConflictError('User with this email already exists');
    }

    // Validate role-specific requirements
    if (role === 'super_admin') {
      throw new AppError('Cannot create super admin through registration', 403);
    }

    if (role === 'admin' && !companyId) {
      throw new AppError('Company ID is required for admin role', 400);
    }

    // Create user
    const user = new User({
      email: email.toLowerCase(),
      password,
      name,
      role: role || 'user',
      companyId: companyId || null,
      phone,
    });

    await user.save();

    // Generate tokens
    const { accessToken, refreshToken } = this.generateTokens(user);

    // Save refresh token
    user.refreshToken = refreshToken;
    await user.save();

    return {
      user: this.sanitizeUser(user),
      accessToken,
      refreshToken,
    };
  }

  async login(email, password) {
    // Find user
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Check if active
    if (!user.isActive) {
      throw new UnauthorizedError('Account is deactivated. Please contact administrator.');
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate tokens
    const { accessToken, refreshToken } = this.generateTokens(user);

    // Save refresh token
    user.refreshToken = refreshToken;
    await user.save();

    return {
      user: this.sanitizeUser(user),
      accessToken,
      refreshToken,
    };
  }

  async refreshToken(refreshToken) {
    // Verify refresh token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, config.jwt.secret);
    } catch (error) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    // Find user
    const user = await User.findById(decoded.id);
    if (!user || user.refreshToken !== refreshToken) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    // Generate new tokens
    const tokens = this.generateTokens(user);

    // Update refresh token
    user.refreshToken = tokens.refreshToken;
    await user.save();

    return tokens;
  }

  async logout(userId) {
    const user = await User.findById(userId);
    if (user) {
      user.refreshToken = null;
      await user.save();
    }
    return true;
  }

  async forgotPassword(email) {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Don't reveal if user exists
      return { message: 'If user exists, password reset email will be sent' };
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    // Send email
    await emailService.sendPasswordResetEmail(user, resetToken);

    return { message: 'Password reset email sent' };
  }

  async resetPassword(token, newPassword) {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      throw new AppError('Invalid or expired reset token', 400);
    }

    user.password = newPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    user.passwordChangedAt = Date.now();
    await user.save();

    return { message: 'Password reset successful' };
  }

  async changePassword(userId, currentPassword, newPassword) {
    const user = await User.findById(userId).select('+password');
    if (!user) {
      throw new NotFoundError('User');
    }

    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Current password is incorrect');
    }

    user.password = newPassword;
    user.passwordChangedAt = Date.now();
    await user.save();

    return { message: 'Password changed successfully' };
  }

  async getProfile(userId) {
    const user = await User.findById(userId).populate('companyId', 'name email');
    if (!user) {
      throw new NotFoundError('User');
    }
    return this.sanitizeUser(user);
  }

  async updateProfile(userId, updateData) {
    const allowedUpdates = ['name', 'phone', 'preferences'];
    const updates = {};

    Object.keys(updateData).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        updates[key] = updateData[key];
      }
    });

    const user = await User.findByIdAndUpdate(userId, updates, {
      new: true,
      runValidators: true,
    }).populate('companyId', 'name email');

    if (!user) {
      throw new NotFoundError('User');
    }

    return this.sanitizeUser(user);
  }

  async createSuperAdmin() {
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@simmanagement.com';
    const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@123';
    const superAdminName = process.env.SUPER_ADMIN_NAME || 'Super Admin';

    const existingSuperAdmin = await User.findOne({ role: 'super_admin' });
    if (existingSuperAdmin) {
      return { message: 'Super admin already exists', user: this.sanitizeUser(existingSuperAdmin) };
    }

    const user = new User({
      email: superAdminEmail,
      password: superAdminPassword,
      name: superAdminName,
      role: 'super_admin',
      companyId: null,
      isActive: true,
      emailVerified: true,
    });

    await user.save();
    return { message: 'Super admin created', user: this.sanitizeUser(user) };
  }

  generateTokens(user) {
    const accessToken = jwt.sign(
      { id: user._id, role: user.role, companyId: user.companyId },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    const refreshToken = jwt.sign(
      { id: user._id },
      config.jwt.secret,
      { expiresIn: config.jwt.refreshExpiresIn }
    );

    return { accessToken, refreshToken };
  }

  sanitizeUser(user) {
    const userObj = user.toObject ? user.toObject() : user;
    delete userObj.password;
    delete userObj.refreshToken;
    delete userObj.resetPasswordToken;
    delete userObj.resetPasswordExpires;
    delete userObj.__v;
    return userObj;
  }
}

module.exports = new AuthService();