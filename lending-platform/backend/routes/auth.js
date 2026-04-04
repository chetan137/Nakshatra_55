const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../models/User');
const { sendOTPEmail } = require('../services/emailService');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Helper: generate 6-digit OTP
function generateOTP() {
  return crypto.randomInt(100000, 999999).toString();
}

// Helper: create JWT
function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

// Helper: format validation errors
function formatErrors(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    if (!res.headersSent) {
      res.status(400).json({
        success: false,
        message: errors.array()[0].msg,
        errors: errors.array(),
      });
    }
    return true;
  }
  return false;
}

// Helper: validate MongoDB ObjectId
function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// ─────────────────────────────────────────────
// POST /api/auth/register
// ─────────────────────────────────────────────
router.post(
  '/register',
  [
    body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
    body('email').isEmail().withMessage('Please enter a valid email').normalizeEmail(),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters')
      .matches(/\d/)
      .withMessage('Password must contain at least 1 number'),
    body('role')
      .optional()
      .isIn(['borrower', 'lender'])
      .withMessage('Role must be either borrower or lender'),
  ],
  async (req, res, next) => {
    try {
      const errResponse = formatErrors(req, res);
      if (errResponse) return;

      const { name, email, password, role } = req.body;

      // Check duplicate
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'Email already registered',
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Generate OTP
      const otp = generateOTP();
      const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min

      // Create user
      const user = await User.create({
        name,
        email,
        password: hashedPassword,
        role: role || 'borrower',
        emailOTP: otp,
        emailOTPExpiry: otpExpiry,
        isEmailVerified: false,
        lastOTPSentAt: new Date(),
      });

      // Send OTP email
      await sendOTPEmail(email, name, otp, 'verify');

      res.status(201).json({
        success: true,
        message: 'OTP sent to your email',
        userId: user._id,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ─────────────────────────────────────────────
// POST /api/auth/verify-email
// ─────────────────────────────────────────────
router.post('/verify-email', async (req, res, next) => {
  try {
    const { userId, otp } = req.body;

    if (!userId || !otp) {
      return res.status(400).json({ success: false, message: 'userId and otp are required' });
    }

    if (!isValidObjectId(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid userId' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({ success: false, message: 'Email already verified' });
    }

    // Check if OTP expired
    if (!user.emailOTPExpiry || new Date() > user.emailOTPExpiry) {
      // Regenerate OTP and resend
      const newOtp = generateOTP();
      user.emailOTP = newOtp;
      user.emailOTPExpiry = new Date(Date.now() + 10 * 60 * 1000);
      user.lastOTPSentAt = new Date();
      await user.save();
      await sendOTPEmail(user.email, user.name, newOtp, 'verify');

      return res.status(400).json({
        success: false,
        message: 'OTP expired. New OTP sent to your email.',
      });
    }

    // Check if OTP matches
    if (user.emailOTP !== otp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    // Verify user
    user.isEmailVerified = true;
    user.emailOTP = null;
    user.emailOTPExpiry = null;
    await user.save();

    // Generate token
    const token = signToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────
// POST /api/auth/resend-otp
// ─────────────────────────────────────────────
router.post('/resend-otp', async (req, res, next) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' });
    }

    if (!isValidObjectId(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid userId' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({ success: false, message: 'Email already verified' });
    }

    // Rate limit: 60 seconds
    if (user.lastOTPSentAt) {
      const elapsed = Date.now() - user.lastOTPSentAt.getTime();
      const remaining = Math.ceil((60000 - elapsed) / 1000);
      if (remaining > 0) {
        return res.status(429).json({
          success: false,
          message: `Please wait ${remaining} seconds before resending`,
          secondsRemaining: remaining,
        });
      }
    }

    const otp = generateOTP();
    user.emailOTP = otp;
    user.emailOTPExpiry = new Date(Date.now() + 10 * 60 * 1000);
    user.lastOTPSentAt = new Date();
    await user.save();

    await sendOTPEmail(user.email, user.name, otp, 'verify');

    res.json({ success: true, message: 'OTP resent to your email' });
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Please enter a valid email').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res, next) => {
    try {
      const errResponse = formatErrors(req, res);
      if (errResponse) return;

      const { email, password } = req.body;

      const user = await User.findOne({ email });
      if (!user) {
        return res.status(401).json({ success: false, message: 'Invalid email or password' });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ success: false, message: 'Invalid email or password' });
      }

      // Check email verification
      if (!user.isEmailVerified) {
        // Resend OTP so user can verify from the redirect
        const otp = generateOTP();
        user.emailOTP = otp;
        user.emailOTPExpiry = new Date(Date.now() + 10 * 60 * 1000);
        user.lastOTPSentAt = new Date();
        await user.save();
        try { await sendOTPEmail(user.email, user.name, otp, 'verify'); } catch { /* best-effort */ }

        return res.status(403).json({
          success: false,
          needsVerification: true,
          userId: user._id,
          message: 'Please verify your email first. A new OTP has been sent.',
        });
      }

      // Update lastLogin
      user.lastLogin = new Date();
      await user.save();

      const token = signToken(user._id);

      res.json({
        success: true,
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          walletAddress: user.walletAddress,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// ─────────────────────────────────────────────
// POST /api/auth/forgot-password
// ─────────────────────────────────────────────
router.post(
  '/forgot-password',
  [body('email').isEmail().withMessage('Please enter a valid email').normalizeEmail()],
  async (req, res, next) => {
    try {
      const errResponse = formatErrors(req, res);
      if (errResponse) return;

      const { email } = req.body;

      // Always return same message for security
      const genericMessage = 'If this email exists, OTP has been sent';

      const user = await User.findOne({ email });
      if (!user) {
        return res.json({ success: true, message: genericMessage });
      }

      const otp = generateOTP();
      user.passwordResetOTP = otp;
      user.passwordResetOTPExpiry = new Date(Date.now() + 10 * 60 * 1000);
      await user.save();

      await sendOTPEmail(email, user.name, otp, 'reset');

      res.json({ success: true, message: genericMessage });
    } catch (error) {
      next(error);
    }
  }
);

// ─────────────────────────────────────────────
// POST /api/auth/verify-reset-otp
// ─────────────────────────────────────────────
router.post('/verify-reset-otp', async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    if (!user.passwordResetOTPExpiry || new Date() > user.passwordResetOTPExpiry) {
      return res.status(400).json({ success: false, message: 'OTP expired. Please request a new one.' });
    }

    if (user.passwordResetOTP !== otp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    // Generate short-lived reset token (15 min)
    const resetToken = jwt.sign({ email: user.email, purpose: 'reset' }, process.env.JWT_SECRET, {
      expiresIn: '15m',
    });

    // Clear OTP fields
    user.passwordResetOTP = null;
    user.passwordResetOTPExpiry = null;
    await user.save();

    res.json({ success: true, resetToken });
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────
// POST /api/auth/reset-password
// ─────────────────────────────────────────────
router.post(
  '/reset-password',
  [
    body('newPassword')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters')
      .matches(/\d/)
      .withMessage('Password must contain at least 1 number'),
  ],
  async (req, res, next) => {
    try {
      const errResponse = formatErrors(req, res);
      if (errResponse) return;

      const { resetToken, newPassword } = req.body;

      if (!resetToken) {
        return res.status(400).json({ success: false, message: 'Reset token is required' });
      }

      let decoded;
      try {
        decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
      } catch {
        return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
      }

      if (decoded.purpose !== 'reset') {
        return res.status(400).json({ success: false, message: 'Invalid reset token' });
      }

      const user = await User.findOne({ email: decoded.email });
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      user.password = await bcrypt.hash(newPassword, 12);
      user.passwordResetOTP = null;
      user.passwordResetOTPExpiry = null;
      await user.save();

      res.json({ success: true, message: 'Password reset successful' });
    } catch (error) {
      next(error);
    }
  }
);

// ─────────────────────────────────────────────
// GET /api/auth/me
// ─────────────────────────────────────────────
router.get('/me', verifyToken, async (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      walletAddress: req.user.walletAddress,
      isEmailVerified: req.user.isEmailVerified,
      avatar: req.user.avatar,
      createdAt: req.user.createdAt,
      lastLogin: req.user.lastLogin,
    },
  });
});

module.exports = router;
