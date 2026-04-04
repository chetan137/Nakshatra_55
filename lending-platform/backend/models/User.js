const mongoose = require('mongoose');
const crypto   = require('crypto');

const userSchema = new mongoose.Schema({
  walletAddress: {
    type:      String,
    required:  [true, 'Wallet address is required'],
    unique:    true,
    lowercase: true,
    trim:      true,
    match:     [/^0x[0-9a-f]{40}$/, 'Invalid Ethereum address'],
  },
  nonce: {
    type:    String,
    default: () => crypto.randomBytes(16).toString('hex'),
  },
  role: {
    type:    String,
    enum:    ['borrower', 'lender'],
    default: null,  // null until user explicitly picks
  },
  createdAt: {
    type:    Date,
    default: Date.now,
  },
  lastLogin: {
    type:    Date,
    default: null,
  },

  // ── ZK Anonymous Verification ─────────────────────────────
  // True once user completes Reclaim/zkPass proof flow.
  // PII never stored here — see ZkProof model for encrypted backup.
  zkVerified: {
    type:    Boolean,
    default: false,
  },
  zkVerifiedAt: {
    type:    Date,
    default: null,
  },
  // The on-chain proof hash — publicly verifiable, no PII
  zkProofHash: {
    type:    String,
    default: null,
  },
});

// Regenerate nonce after every login (replay-attack protection)
userSchema.methods.refreshNonce = function () {
  this.nonce = crypto.randomBytes(16).toString('hex');
  return this.save();
};

module.exports = mongoose.model('User', userSchema);
