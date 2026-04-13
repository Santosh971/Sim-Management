const authService = require('../../services/auth/auth.service');
const auditLogService = require('../../services/auditLog/auditLog.service');
const { successResponse, errorResponse } = require('../../utils/response');
const crypto = require('crypto');

class AuthController {
  // async register(req, res, next) {
  //   try {
  //     const result = await authService.register(req.body);
  //     return successResponse(res, result, 'User registered successfully', 201);
  //   } catch (error) {
  //     next(error);
  //   }
  // }



  async register(userData) {
    let { email, password, name, role, companyId, phone } = userData;

    // Check if user exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      throw new ConflictError('User with this email already exists');
    }

    // ❗ Prevent creating super admin
    if (role === 'super_admin') {
      throw new AppError('Cannot create super admin through registration', 403);
    }

    // ❗ Admin must have company
    if (role === 'admin' && !companyId) {
      throw new AppError('Company ID is required for admin role', 400);
    }

    // ✅ NEW LOGIC
    if (role === 'user') {
      // Option 1: No login system → no password
      password = undefined;

      // Option 2 (better): auto-generate password
      // password = crypto.randomBytes(8).toString('hex');
    }

    // ❗ Admin must have password
    if (role === 'admin' && !password) {
      throw new AppError('Password is required for admin', 400);
    }

    const user = new User({
      email: email.toLowerCase(),
      password,
      name,
      role: role || 'user',
      companyId: companyId || null,
      phone,
    });

    await user.save();

    // ❗ Only generate tokens for login users
    let tokens = null;
    if (role !== 'user') {
      tokens = this.generateTokens(user);
      user.refreshToken = tokens.refreshToken;
      await user.save();
    }

    return {
      user: this.sanitizeUser(user),
      accessToken: tokens?.accessToken || null,
      refreshToken: tokens?.refreshToken || null,
    };
  }

  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const result = await authService.login(email, password);

      // Audit log: USER_LOGIN
      await auditLogService.logAction({
        action: 'USER_LOGIN',
        module: 'AUTH',
        description: `User ${result.user.name} (${result.user.email}) logged in successfully`,
        performedBy: result.user._id,
        role: result.user.role,
        companyId: result.user.companyId,
        req,
      });

      return successResponse(res, result, 'Login successful');
    } catch (error) {
      next(error);
    }
  }

  async refreshToken(req, res, next) {
    try {
      const { refreshToken } = req.body;
      const result = await authService.refreshToken(refreshToken);
      return successResponse(res, result, 'Token refreshed successfully');
    } catch (error) {
      next(error);
    }
  }

  async logout(req, res, next) {
    try {
      await authService.logout(req.user.id);

      // Audit log: USER_LOGOUT
      await auditLogService.logAction({
        action: 'USER_LOGOUT',
        module: 'AUTH',
        description: `User ${req.user.name} (${req.user.email}) logged out`,
        performedBy: req.user.id,
        role: req.user.role,
        companyId: req.user.companyId,
        req,
      });

      return successResponse(res, null, 'Logged out successfully');
    } catch (error) {
      next(error);
    }
  }

  async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;
      const result = await authService.forgotPassword(email);
      return successResponse(res, result, 'Password reset initiated');
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req, res, next) {
    try {
      const { token } = req.params;
      const { password } = req.body;
      const result = await authService.resetPassword(token, password);
      return successResponse(res, result, 'Password reset successful');
    } catch (error) {
      next(error);
    }
  }

  async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;
      const result = await authService.changePassword(req.user.id, currentPassword, newPassword);
      return successResponse(res, result, 'Password changed successfully');
    } catch (error) {
      next(error);
    }
  }

  async getProfile(req, res, next) {
    try {
      const user = await authService.getProfile(req.user.id);
      return successResponse(res, user, 'Profile fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req, res, next) {
    try {
      const user = await authService.updateProfile(req.user.id, req.body);
      return successResponse(res, user, 'Profile updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async initSuperAdmin(req, res, next) {
    try {
      const result = await authService.createSuperAdmin();
      return successResponse(res, result, 'Super admin initialized');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();