const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
  },
  walletAddress: {
    type: String,
    default: null,
  },
  isEmailVerified: {
    type: Boolean,
    default: false,
  },
  emailOTP: {
    type: String,
    default: null,
  },
  emailOTPExpiry: {
    type: Date,
    default: null,
  },
  passwordResetOTP: {
    type: String,
    default: null,
  },
  passwordResetOTPExpiry: {
    type: Date,
    default: null,
  },
  role: {
    type: String,
    enum: ['borrower', 'lender', 'admin'],
    default: 'borrower',
  },
  avatar: {
    type: String,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastLogin: {
    type: Date,
    default: null,
  },
  lastOTPSentAt: {
    type: Date,
    default: null,
  },
});

module.exports = mongoose.model('User', userSchema);
