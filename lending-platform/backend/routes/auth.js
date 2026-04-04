const express = require('express');
const jwt     = require('jsonwebtoken');
const crypto  = require('crypto');
const { ethers } = require('ethers');
const User    = require('../models/User');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

/** Shared message builder — MUST be identical in /nonce and /verify */
function buildMessage(walletAddress, nonce) {
  return `Welcome to Go Secure!\n\nSign this message to authenticate.\n\nNonce: ${nonce}\nWallet: ${walletAddress}`;
}

/** Create a JWT containing walletAddress + role */
function signToken(user) {
  return jwt.sign(
    { userId: user._id, walletAddress: user.walletAddress, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// ─────────────────────────────────────────────────────────────
// GET /api/auth/nonce/:walletAddress
// Returns a unique nonce message the frontend must sign.
// ─────────────────────────────────────────────────────────────
router.get('/nonce/:walletAddress', async (req, res, next) => {
  try {
    const raw = req.params.walletAddress.toLowerCase();

    if (!/^0x[0-9a-f]{40}$/.test(raw)) {
      return res.status(400).json({ success: false, message: 'Invalid Ethereum address' });
    }

    // Generate a fresh nonce for this challenge
    const freshNonce = crypto.randomBytes(16).toString('hex');

    // Upsert: create user on first visit, refresh nonce on every nonce request
    const user = await User.findOneAndUpdate(
      { walletAddress: raw },
      {
        $set:       { nonce: freshNonce },
        $setOnInsert: { walletAddress: raw, role: null, createdAt: new Date() },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const message = buildMessage(raw, user.nonce);
    res.json({ success: true, message });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/auth/verify
// Verifies the signed nonce, returns JWT + isNewUser flag.
// ─────────────────────────────────────────────────────────────
router.post('/verify', async (req, res, next) => {
  try {
    const { walletAddress, signature } = req.body;

    if (!walletAddress || !signature) {
      return res.status(400).json({ success: false, message: 'walletAddress and signature are required' });
    }

    const raw = walletAddress.toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(raw)) {
      return res.status(400).json({ success: false, message: 'Invalid Ethereum address' });
    }

    const user = await User.findOne({ walletAddress: raw });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Wallet not found. Please refresh and try again.' });
    }

    // Reconstruct the EXACT same message using stored nonce
    const message = buildMessage(raw, user.nonce);

    // Recover signer from signature
    let recovered;
    try {
      recovered = ethers.verifyMessage(message, signature);
    } catch {
      return res.status(400).json({ success: false, message: 'Could not parse signature' });
    }

    if (recovered.toLowerCase() !== raw) {
      // Debug: log to server console (remove after confirming fix)
      console.error(`[verify] Mismatch: recovered=${recovered.toLowerCase()} expected=${raw}`);
      console.error(`[verify] Message used:\n${message}`);
      return res.status(401).json({ success: false, message: 'Signature mismatch — wallet verification failed' });
    }

    // Rotate nonce (replay-attack protection) and update lastLogin atomically
    const freshNonce = crypto.randomBytes(16).toString('hex');
    user.nonce     = freshNonce;
    user.lastLogin = new Date();
    await user.save();

    const isNewUser = !user.role;
    const token     = signToken(user);

    res.json({
      success:   true,
      isNewUser,
      token,
      role:          user.role,
      walletAddress: user.walletAddress,
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/auth/select-role
// Sets the role on the user document (only once).
// ─────────────────────────────────────────────────────────────
router.post('/select-role', verifyToken, async (req, res, next) => {
  try {
    const { role } = req.body;

    if (!['borrower', 'lender'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Role must be borrower or lender' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.role) {
      return res.status(409).json({ success: false, message: 'Role already set and cannot be changed' });
    }

    user.role = role;
    await user.save();

    // Issue a fresh token that now includes role
    const token = signToken(user);

    res.json({
      success:       true,
      token,
      role:          user.role,
      walletAddress: user.walletAddress,
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/auth/me  (protected)
// ─────────────────────────────────────────────────────────────
router.get('/me', verifyToken, async (req, res) => {
  const u = req.user;
  res.json({
    success: true,
    user: {
      id:            u._id,
      walletAddress: u.walletAddress,
      role:          u.role,
      createdAt:     u.createdAt,
      lastLogin:     u.lastLogin,
    },
  });
});

module.exports = router;
