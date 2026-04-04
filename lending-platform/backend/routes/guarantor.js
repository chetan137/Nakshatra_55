/**
 * routes/guarantor.js — Non-Collateral Guarantor System
 *
 * POST /api/guarantor/search             Search guarantor by MetaMask wallet address
 * POST /api/guarantor/request            Borrower sends guarantee request for a loan
 * GET  /api/guarantor/inbox              Guarantor sees all pending requests for their wallet
 * GET  /api/guarantor/my-requests        Borrower sees all their sent requests
 * PUT  /api/guarantor/:id/approve        Guarantor approves + optionally uploads doc
 * PUT  /api/guarantor/:id/reject         Guarantor rejects with note
 * GET  /api/guarantor/loan/:loanId       Get guarantor status for a specific loan
 * DELETE /api/guarantor/:id/cancel       Borrower cancels a pending request
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { verifyToken } = require('../middleware/auth');
const Guarantor = require('../models/Guarantor');
const Loan      = require('../models/Loan');
const User      = require('../models/User');
const {
  sendGuarantorRequestEmail,
  sendGuarantorResponseEmail,
} = require('../services/emailService');

const router = express.Router();

// ── POST /api/guarantor/search ───────────────────────────────────────────────
// Borrower types a MetaMask wallet address → returns user info if registered.
// Does NOT reveal email or sensitive data — only name + wallet + zkVerified status.
router.post('/search', verifyToken, [
  body('walletAddress').matches(/^0x[0-9a-fA-F]{40}$/).withMessage('Invalid wallet address'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  try {
    const wallet = req.params.wallet || req.body.walletAddress;
    const user = await User.findOne({
      walletAddress: { $regex: new RegExp(`^${wallet}$`, 'i') },
    }).select('name walletAddress zkVerified role createdAt').lean();

    if (!user) {
      return res.json({
        success: true,
        found: false,
        message: 'No LendChain account found for this wallet address.',
      });
    }

    // Borrower cannot add themselves as guarantor
    if (String(user._id) === String(req.user._id)) {
      return res.status(400).json({ success: false, message: 'You cannot be your own guarantor.' });
    }

    res.json({
      success: true,
      found: true,
      user: {
        name:        user.name,
        walletAddress: user.walletAddress,
        zkVerified:  user.zkVerified || false,
        role:        user.role,
        memberSince: user.createdAt,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/guarantor/request ──────────────────────────────────────────────
// Borrower requests a specific user (by wallet) to guarantee their loan.
// Sends email notification ONLY to that guarantor user.
router.post('/request', verifyToken, [
  body('guarantorWallet').matches(/^0x[0-9a-fA-F]{40}$/).withMessage('Invalid guarantor wallet'),
  body('guaranteeAmountEth').isNumeric({ min: 0 }).withMessage('guaranteeAmountEth must be a number'),
  body('borrowerMessage').optional().isLength({ max: 500 }),
  body('loanId').optional(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  try {
    const { loanId = null, guarantorWallet, guaranteeAmountEth, borrowerMessage = '' } = req.body;

    let loan = null;
    // If loanId provided, validate it belongs to this borrower and is pending
    if (loanId) {
      loan = await Loan.findById(loanId);
      if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });
      if (String(loan.borrower) !== String(req.user._id)) {
        return res.status(403).json({ success: false, message: 'Only the borrower can request a guarantor' });
      }
      if (loan.status !== 'pending') {
        return res.status(400).json({ success: false, message: 'Can only add guarantor to a pending loan' });
      }
    }

    // Cannot be own guarantor
    if (guarantorWallet.toLowerCase() === req.user.walletAddress?.toLowerCase()) {
      return res.status(400).json({ success: false, message: 'You cannot guarantee your own loan' });
    }

    // Look up guarantor user by wallet
    const guarantorUser = await User.findOne({
      walletAddress: { $regex: new RegExp(`^${guarantorWallet}$`, 'i') },
    });
    if (!guarantorUser) {
      return res.status(404).json({
        success: false,
        message: 'No LendChain account found for this wallet. The guarantor must be registered on LendChain.',
      });
    }

    // If loanId provided: one request per loan; if no loanId: one per borrower+guarantor pair
    let existingQuery = loanId
      ? { loan: loanId }
      : { borrower: req.user._id, guarantorAddress: guarantorWallet.toLowerCase(), loan: null };

    const existing = await Guarantor.findOne(existingQuery);
    if (existing && existing.status === 'approved') {
      return res.status(400).json({ success: false, message: loanId
        ? 'This loan already has an approved guarantor.'
        : 'You already have an approved guarantor pre-approval from this user.' });
    }

    const guarantorRecord = await Guarantor.findOneAndUpdate(
      existingQuery,
      {
        loan:               loanId || null,
        borrower:           req.user._id,
        borrowerAddress:    req.user.walletAddress?.toLowerCase() || '',
        guarantor:          guarantorUser._id,
        guarantorAddress:   guarantorWallet.toLowerCase(),
        guaranteeAmountEth: Number(guaranteeAmountEth),
        borrowerMessage:    borrowerMessage.trim(),
        status:             'pending',
        requestedAt:        new Date(),
        respondedAt:        null,
        documentHash:       null,
        documentVerified:   false,
      },
      { upsert: true, new: true }
    );

    // If loanId given, update loan to reference this guarantor request
    if (loanId && loan) {
      await Loan.findByIdAndUpdate(loanId, {
        guarantorRequest:  guarantorRecord._id,
        guarantorStatus:   'pending',
        guarantorAddress:  guarantorWallet.toLowerCase(),
      });
    }

    // Send email notification ONLY to the guarantor user
    try {
      await sendGuarantorRequestEmail(
        { name: guarantorUser.name, email: guarantorUser.email },
        { name: req.user.name, walletAddress: req.user.walletAddress },
        loan || { principal: Number(guaranteeAmountEth), durationDays: 'TBD' },
        Number(guaranteeAmountEth),
        borrowerMessage
      );
      await Guarantor.findByIdAndUpdate(guarantorRecord._id, { notificationSentAt: new Date() });
    } catch (emailErr) {
      console.error('[Guarantor] Email failed (non-fatal):', emailErr.message);
    }

    res.status(201).json({
      success: true,
      message: `Guarantee request sent to ${guarantorUser.name}. They will receive an email notification.`,
      guarantorRequest: {
        _id:              guarantorRecord._id,
        guarantorName:    guarantorUser.name,
        guarantorWallet:  guarantorWallet,
        guaranteeAmount:  guaranteeAmountEth,
        status:           'pending',
      },
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'A guarantor request already exists.' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/guarantor/inbox ─────────────────────────────────────────────────
// Guarantor sees all requests pending for their wallet address.
router.get('/inbox', verifyToken, async (req, res) => {
  try {
    if (!req.user.walletAddress) {
      return res.json({ success: true, requests: [], message: 'Connect your wallet to see guarantor requests.' });
    }

    const requests = await Guarantor.find({
      guarantorAddress: req.user.walletAddress.toLowerCase(),
      status: { $in: ['pending', 'approved', 'rejected'] },
    })
      .populate('borrower', 'name email walletAddress zkVerified')
      .populate('loan',     'principal collateral durationDays interestRateBps status createdAt onChainId')
      .sort({ requestedAt: -1 })
      .lean();

    res.json({ success: true, requests });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/guarantor/my-requests ──────────────────────────────────────────
// Borrower sees all guarantor requests they've sent.
router.get('/my-requests', verifyToken, async (req, res) => {
  try {
    const requests = await Guarantor.find({ borrower: req.user._id })
      .populate('guarantor', 'name walletAddress zkVerified')
      .populate('loan',      'principal collateral durationDays status onChainId')
      .sort({ requestedAt: -1 })
      .lean();

    res.json({ success: true, requests });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/guarantor/loan/:loanId ─────────────────────────────────────────
// Get guarantor status for a specific loan (borrower or guarantor can view).
router.get('/loan/:loanId', verifyToken, async (req, res) => {
  try {
    const record = await Guarantor.findOne({ loan: req.params.loanId })
      .populate('guarantor', 'name walletAddress zkVerified')
      .populate('borrower',  'name walletAddress')
      .lean();

    if (!record) return res.json({ success: true, exists: false });

    // Only borrower or guarantor can view
    const isBorrower   = String(record.borrower?._id) === String(req.user._id);
    const isGuarantor  = String(record.guarantor?._id) === String(req.user._id);
    if (!isBorrower && !isGuarantor) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    res.json({ success: true, exists: true, record });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── PUT /api/guarantor/:id/approve ───────────────────────────────────────────
// Guarantor approves the request + optionally provides document info.
// Body: { documentHash?, documentType?, guarantorNote? }
router.put('/:id/approve', verifyToken, async (req, res) => {
  try {
    const record = await Guarantor.findById(req.params.id)
      .populate('borrower',  'name email walletAddress')
      .populate('guarantor', 'name walletAddress')
      .populate('loan',      'principal _id');

    if (!record) return res.status(404).json({ success: false, message: 'Request not found' });

    // Only the guarantor user can approve
    if (String(record.guarantor?._id) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Only the requested guarantor can approve' });
    }
    if (record.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Request is already ${record.status}` });
    }

    const { documentHash = null, documentType = null, guarantorNote = '' } = req.body;

    record.status          = 'approved';
    record.documentHash    = documentHash;
    record.documentType    = documentType;
    record.guarantorNote   = guarantorNote.trim();
    record.respondedAt     = new Date();
    await record.save();

    // Update loan's guarantor status
    await Loan.findByIdAndUpdate(record.loan._id, { guarantorStatus: 'approved' });

    // Notify borrower via email (only to borrower)
    try {
      await sendGuarantorResponseEmail(
        { name: record.borrower.name, email: record.borrower.email },
        { name: req.user.name, walletAddress: req.user.walletAddress },
        record.loan,
        'approved',
        guarantorNote
      );
    } catch (emailErr) {
      console.error('[Guarantor] Response email failed (non-fatal):', emailErr.message);
    }

    res.json({
      success: true,
      message: 'Guarantee approved. The borrower has been notified.',
      record: {
        status:        'approved',
        documentHash,
        documentType,
        guarantorNote,
        respondedAt:   record.respondedAt,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── PUT /api/guarantor/:id/reject ────────────────────────────────────────────
// Guarantor rejects the request.
// Body: { guarantorNote? }
router.put('/:id/reject', verifyToken, async (req, res) => {
  try {
    const record = await Guarantor.findById(req.params.id)
      .populate('borrower',  'name email')
      .populate('guarantor', 'name walletAddress')
      .populate('loan',      'principal _id');

    if (!record) return res.status(404).json({ success: false, message: 'Request not found' });

    if (String(record.guarantor?._id) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Only the requested guarantor can reject' });
    }
    if (record.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Request is already ${record.status}` });
    }

    const { guarantorNote = '' } = req.body;

    record.status        = 'rejected';
    record.guarantorNote = guarantorNote.trim();
    record.respondedAt   = new Date();
    await record.save();

    // Update loan's guarantor status
    await Loan.findByIdAndUpdate(record.loan._id, { guarantorStatus: 'rejected' });

    // Notify borrower via email (only to borrower)
    try {
      await sendGuarantorResponseEmail(
        { name: record.borrower.name, email: record.borrower.email },
        { name: req.user.name, walletAddress: req.user.walletAddress },
        record.loan,
        'rejected',
        guarantorNote
      );
    } catch (emailErr) {
      console.error('[Guarantor] Response email failed (non-fatal):', emailErr.message);
    }

    res.json({
      success: true,
      message: 'Request rejected. The borrower has been notified.',
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE /api/guarantor/:id/cancel ────────────────────────────────────────
// Borrower cancels a pending guarantor request.
router.delete('/:id/cancel', verifyToken, async (req, res) => {
  try {
    const record = await Guarantor.findById(req.params.id);
    if (!record) return res.status(404).json({ success: false, message: 'Request not found' });

    if (String(record.borrower) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Only the borrower can cancel this request' });
    }
    if (record.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Can only cancel pending requests' });
    }

    record.status = 'cancelled';
    await record.save();

    await Loan.findByIdAndUpdate(record.loan, { guarantorStatus: null, guarantorRequest: null });

    res.json({ success: true, message: 'Guarantor request cancelled.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
