const mongoose = require('mongoose');

const loanSchema = new mongoose.Schema({
  // ── On-chain identifiers ────────────────────────────
  onChainId: {
    type: Number,
    default: null,          // loanCounter value from smart contract
  },
  createTxHash: { type: String, default: null },
  fundTxHash:   { type: String, default: null },
  repayTxHash:  { type: String, default: null },
  liquidateTxHash: { type: String, default: null },

  // ── Parties ────────────────────────────────────────
  borrower: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  borrowerAddress: { type: String, required: true },   // wallet address

  lender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  lenderAddress: { type: String, default: null },

  // ── Loan terms ─────────────────────────────────────
  principal: {
    type: Number,   // ETH amount (human-readable, e.g. 0.5)
    required: true,
  },
  collateral: {
    type: Number,   // ETH amount locked
    required: true,
  },
  interestRateBps: {
    type: Number,   // e.g. 1200 = 12%
    required: true,
  },
  durationDays: {
    type: Number,
    required: true,
  },

  // ── Status ─────────────────────────────────────────
  status: {
    type: String,
    enum: ['pending', 'active', 'repaid', 'defaulted', 'cancelled'],
    default: 'pending',
  },

  // ── Timestamps ─────────────────────────────────────
  startDate:     { type: Date, default: null },
  dueDate:       { type: Date, default: null },
  repaidAt:      { type: Date, default: null },
  liquidatedAt:  { type: Date, default: null },

  // ── Risk ───────────────────────────────────────────
  riskScore: { type: Number, default: 80 },

  createdAt: { type: Date, default: Date.now },
});

// ── Computed helpers ────────────────────────────────
loanSchema.virtual('collateralRatio').get(function () {
  return this.principal > 0
    ? ((this.collateral / this.principal) * 100).toFixed(1)
    : '0';
});

loanSchema.virtual('interestRatePercent').get(function () {
  return (this.interestRateBps / 100).toFixed(2);
});

loanSchema.set('toJSON',   { virtuals: true });
loanSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Loan', loanSchema);
