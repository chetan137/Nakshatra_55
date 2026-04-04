const mongoose = require('mongoose');

/**
 * Guarantor — tracks a guarantor request for a specific loan.
 *
 * Flow:
 *  1. Borrower searches guarantor by MetaMask wallet address
 *  2. Borrower sends guarantee request → status: pending
 *     → Email notification sent ONLY to that guarantor user
 *  3. Guarantor reviews request, uploads verification document
 *  4. Guarantor approves → status: approved  (loan can proceed)
 *     OR Guarantor rejects → status: rejected (borrower must find another)
 *  5. If loan defaults → guarantor is liable for the principal
 *
 * One active guarantor record per loan (upserted on re-request).
 */
const guarantorSchema = new mongoose.Schema({
  // ── Loan reference ──────────────────────────────────────
  loan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Loan',
    default: null,   // null until borrower creates the actual loan
  },

  // ── Borrower ────────────────────────────────────────────
  borrower: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  borrowerAddress: { type: String, required: true, lowercase: true },

  // ── Guarantor ───────────────────────────────────────────
  guarantor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,   // resolved after wallet lookup
  },
  guarantorAddress: {
    type: String,
    required: true,
    lowercase: true,
  },

  // ── Status machine ───────────────────────────────────────
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled', 'liable'],
    default: 'pending',
  },

  // ── Guarantee terms (set by borrower) ────────────────────
  // Max amount guarantor is liable for on default (ETH)
  guaranteeAmountEth: { type: Number, required: true },
  // Optional message from borrower to guarantor
  borrowerMessage:    { type: String, default: '' },

  // ── Document verification (by guarantor) ─────────────────
  // Guarantor uploads a doc proving their ability to guarantee
  documentHash:      { type: String, default: null }, // SHA-256 hex (integrity check, legacy/manual)
  documentUrl:       { type: String, default: null }, // ✅ Cloudinary HTTPS URL — primary storage
  documentPublicId:  { type: String, default: null }, // Cloudinary public_id (needed for deletion)
  documentFileName:  { type: String, default: null }, // original filename for display
  documentType:    {
    type: String,
    enum: ['bank_statement', 'income_proof', 'government_id', 'property_deed', 'other', null],
    default: null,
  },
  documentVerified: { type: Boolean, default: false }, // set true when hash verified
  guarantorNote:    { type: String, default: '' },      // guarantor's response note

  // ── Timestamps ───────────────────────────────────────────
  requestedAt:  { type: Date, default: Date.now },
  respondedAt:  { type: Date, default: null },
  liableAt:     { type: Date, default: null },  // set when loan defaults

  // ── Notification tracking ────────────────────────────────
  notificationSentAt: { type: Date, default: null },
  reminderSentAt:     { type: Date, default: null },
});

// Sparse unique: only ONE active guarantor record per loan (null loans excluded from uniqueness)
guarantorSchema.index({ loan: 1 }, { unique: true, sparse: true });
// Prevent duplicate pre-approvals between the same borrower+guarantor when no loan is linked
guarantorSchema.index(
  { borrower: 1, guarantorAddress: 1 },
  { unique: true, partialFilterExpression: { loan: null, status: { $in: ['pending', 'approved'] } } }
);
guarantorSchema.index({ guarantorAddress: 1, status: 1 });
guarantorSchema.index({ borrower: 1, status: 1 });

module.exports = mongoose.model('Guarantor', guarantorSchema);
