const mongoose = require('mongoose');
const { Schema } = mongoose;
const bcrypt = require('bcryptjs');

const UserSchema = new Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
  },
  password: {
    type: String,
    select: false, // Don't return password by default
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [50, 'Name cannot exceed 50 characters'],
  },
  role: {
    type: String,
    enum: ['super_admin', 'admin', 'user'],
    required: [true, 'Role is required'],
    default: 'user',
  },
  companyId: {
    type: Schema.Types.ObjectId,
    ref: 'Company',
    default: null,
  },
  phone: {
    type: String,
    trim: true,
    validate: {
      validator: function (v) {
        return !v || /^\+?[\d\s-]{10,}$/.test(v);
      },
      message: 'Invalid phone number',
    },
  },
  // Mobile number for OTP authentication (unique identifier)
  mobileNumber: {
    type: String,
    unique: true,
    sparse: true, // Allow null/undefined values
    trim: true,
    validate: {
      validator: function (v) {
        return !v || /^\d{10}$/.test(v);
      },
      message: 'Mobile number must be 10 digits',
    },
  },
  // OTP authentication fields
  otp: {
    type: String,
    select: false, // Don't return OTP by default
  },
  otpExpires: {
    type: Date,
    default: null,
  },
  otpAttempts: {
    type: Number,
    default: 0,
  },
  mobileVerified: {
    type: Boolean,
    default: false,
  },
  avatar: {
    type: String,
    default: null,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  emailVerified: {
    type: Boolean,
    default: false,
  },
  lastLogin: {
    type: Date,
    default: null,
  },
  passwordChangedAt: {
    type: Date,
    default: null,
  },
  resetPasswordToken: {
    type: String,
    default: null,
  },
  resetPasswordExpires: {
    type: Date,
    default: null,
  },
  refreshToken: {
    type: String,
    default: null,
  },
  preferences: {
    notifications: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      inApp: { type: Boolean, default: true },
    },
    timezone: {
      type: String,
      default: 'Asia/Kolkata',
    },
    language: {
      type: String,
      default: 'en',
    },
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Indexes
// email index is already created by unique: true in schema definition
UserSchema.index({ mobileNumber: 1 }, { unique: true, sparse: true });
UserSchema.index({ companyId: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ isActive: 1 });

// Hash password before saving
UserSchema.pre('save', async function (next) {
  // Only hash if password is modified and exists
  if (!this.isModified('password') || !this.password) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
UserSchema.methods.comparePassword = async function (candidatePassword) {
  // Safety check: if password is not set, comparison fails
  if (!this.password) {
    return false;
  }
  return await bcrypt.compare(candidatePassword, this.password);
};

// Update passwordChangedAt when password is changed
UserSchema.pre('save', function (next) {
  if (!this.isModified('password') || this.isNew) {
    return next();
  }
  this.passwordChangedAt = Date.now() - 1000; // 1 second buffer
  next();
});

// Check if password was changed after token was issued
UserSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

// Static method to find by company
UserSchema.statics.findByCompany = function (companyId) {
  return this.find({ companyId, isActive: true });
};

// Static method to find admins
UserSchema.statics.findAdmins = function (companyId) {
  return this.find({ companyId, role: 'admin', isActive: true });
};

// Virtual for full info
UserSchema.virtual('fullInfo').get(function () {
  return `${this.name} (${this.email}) - ${this.role}`;
});

// Ensure super_admin has no companyId
UserSchema.pre('save', function (next) {
  if (this.role === 'super_admin') {
    this.companyId = null;
  }
  next();
});

module.exports = mongoose.model('User', UserSchema);