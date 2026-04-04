const express = require('express');
const Loan    = require('../models/Loan');
const User    = require('../models/User');
const { verifyToken } = require('../middleware/auth');
const blockchain = require('../services/blockchainService');

const router = express.Router();

// ─────────────────────────────────────────────────────────
// POST /api/loans
// Borrower registers a new loan AFTER calling createLoan()
// on the smart contract from the frontend.
// Body: { onChainId, principal, collateral, interestRateBps,
//         durationDays, borrowerAddress, createTxHash }
// ─────────────────────────────────────────────────────────
router.post('/', verifyToken, async (req, res, next) => {
  try {
    const {
      onChainId, principal, collateral,
      interestRateBps, durationDays,
      borrowerAddress, createTxHash,
    } = req.body;

    // Basic validation
    if (!principal || !collateral || !interestRateBps || !durationDays || !borrowerAddress) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    if (collateral / principal < 1.5) {
      return res.status(400).json({
        success: false,
        message: `Collateral ratio is ${(collateral / principal * 100).toFixed(0)}% — must be ≥ 150%`,
      });
    }

    // Calculate risk score from on-chain history
    const riskScoreVal = await blockchain.getRiskScore(borrowerAddress);

    // Update user's wallet address if changed
    await User.findByIdAndUpdate(req.user._id, { walletAddress: borrowerAddress });

    const loan = await Loan.create({
      onChainId: onChainId ?? null,
      createTxHash: createTxHash || null,
      borrower:        req.user._id,
      borrowerAddress,
      principal:       Number(principal),
      collateral:      Number(collateral),
      interestRateBps: Number(interestRateBps),
      durationDays:    Number(durationDays),
      riskScore:       riskScoreVal,
      status:          'pending',
    });

    res.status(201).json({ success: true, loan });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────
// GET /api/loans/available
// Public — all pending loans for lender browsing
// ─────────────────────────────────────────────────────────
router.get('/available', async (req, res, next) => {
  try {
    const loans = await Loan.find({ status: 'pending' })
      .populate('borrower', 'name loansCompleted loansDefaulted walletAddress')
      .sort({ riskScore: -1, createdAt: -1 })
      .lean({ virtuals: true });

    res.json({ success: true, loans });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────
// GET /api/loans/my
// Auth — current user's loans (as borrower or lender)
// ─────────────────────────────────────────────────────────
router.get('/my', verifyToken, async (req, res, next) => {
  try {
    const loans = await Loan.find({
      $or: [{ borrower: req.user._id }, { lender: req.user._id }],
    })
      .populate('borrower', 'name email walletAddress')
      .populate('lender',   'name email walletAddress')
      .sort({ createdAt: -1 })
      .lean({ virtuals: true });

    res.json({ success: true, loans });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────
// GET /api/loans/stats
// Auth — dashboard stats for current user
// ─────────────────────────────────────────────────────────
router.get('/stats', verifyToken, async (req, res, next) => {
  try {
    const uid = req.user._id;

    const [borrowedLoans, lentLoans] = await Promise.all([
      Loan.find({ borrower: uid }),
      Loan.find({ lender: uid }),
    ]);

    const totalBorrowed = borrowedLoans.reduce((s, l) => s + (l.principal || 0), 0);
    const totalLent     = lentLoans.reduce((s, l) => s + (l.principal || 0), 0);
    const activeBorrowed = borrowedLoans.filter(l => l.status === 'active').length;
    const activeLent     = lentLoans.filter(l => l.status === 'active').length;
    const repaid         = borrowedLoans.filter(l => l.status === 'repaid').length;
    const defaulted      = borrowedLoans.filter(l => l.status === 'defaulted').length;

    res.json({
      success: true,
      stats: {
        totalBorrowed, totalLent,
        activeBorrowed, activeLent,
        repaid, defaulted,
        loansAsBorrower: borrowedLoans.length,
        loansAsLender:   lentLoans.length,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────
// GET /api/loans/:id
// Public — single loan details
// ─────────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const loan = await Loan.findById(req.params.id)
      .populate('borrower', 'name walletAddress')
      .populate('lender',   'name walletAddress')
      .lean({ virtuals: true });

    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });

    // Optionally fetch live on-chain data
    if (loan.onChainId !== null) {
      const onChain = await blockchain.getLoanOnChain(loan.onChainId);
      if (onChain) loan.onChain = onChain;
    }

    res.json({ success: true, loan });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────
// PUT /api/loans/:id/fund
// Auth — lender records funding AFTER calling fundLoan() on chain
// Body: { lenderAddress, fundTxHash, onChainId? }
// ─────────────────────────────────────────────────────────
router.put('/:id/fund', verifyToken, async (req, res, next) => {
  try {
    const { lenderAddress, fundTxHash } = req.body;
    const loan = await Loan.findById(req.params.id);

    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });
    if (loan.status !== 'pending') return res.status(400).json({ success: false, message: 'Loan not pending' });
    if (String(loan.borrower) === String(req.user._id)) {
      return res.status(400).json({ success: false, message: 'Borrower cannot fund own loan' });
    }

    // Optional: verify tx on blockchain
    if (fundTxHash) {
      const valid = await blockchain.verifyTx(fundTxHash);
      if (!valid) return res.status(400).json({ success: false, message: 'Transaction not found on chain' });
    }

    // Update user wallet
    await User.findByIdAndUpdate(req.user._id, { walletAddress: lenderAddress });

    const startDate = new Date();
    const dueDate   = new Date(startDate.getTime() + loan.durationDays * 24 * 60 * 60 * 1000);

    loan.lender        = req.user._id;
    loan.lenderAddress = lenderAddress;
    loan.fundTxHash    = fundTxHash || null;
    loan.status        = 'active';
    loan.startDate     = startDate;
    loan.dueDate       = dueDate;
    await loan.save();

    await loan.populate(['borrower', 'lender']);
    res.json({ success: true, loan });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────
// PUT /api/loans/:id/repay
// Auth — borrower records repayment AFTER calling repayLoan() on chain
// Body: { repayTxHash }
// ─────────────────────────────────────────────────────────
router.put('/:id/repay', verifyToken, async (req, res, next) => {
  try {
    const { repayTxHash } = req.body;
    const loan = await Loan.findById(req.params.id);

    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });
    if (loan.status !== 'active') return res.status(400).json({ success: false, message: 'Loan not active' });
    if (String(loan.borrower) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Only borrower can repay' });
    }

    loan.repayTxHash = repayTxHash || null;
    loan.status      = 'repaid';
    loan.repaidAt    = new Date();
    await loan.save();

    res.json({ success: true, loan });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────
// PUT /api/loans/:id/liquidate
// Auth — anyone records liquidation AFTER calling liquidate() on chain
// Body: { liquidateTxHash }
// ─────────────────────────────────────────────────────────
router.put('/:id/liquidate', verifyToken, async (req, res, next) => {
  try {
    const { liquidateTxHash } = req.body;
    const loan = await Loan.findById(req.params.id);

    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });
    if (loan.status !== 'active') return res.status(400).json({ success: false, message: 'Loan not active' });
    if (!loan.dueDate || new Date() < loan.dueDate) {
      return res.status(400).json({ success: false, message: 'Loan not yet overdue' });
    }

    loan.liquidateTxHash = liquidateTxHash || null;
    loan.status          = 'defaulted';
    loan.liquidatedAt    = new Date();
    await loan.save();

    res.json({ success: true, loan });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────
// DELETE /api/loans/:id
// Auth — borrower cancels pending loan
// ─────────────────────────────────────────────────────────
router.delete('/:id', verifyToken, async (req, res, next) => {
  try {
    const loan = await Loan.findById(req.params.id);

    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });
    if (loan.status !== 'pending') return res.status(400).json({ success: false, message: 'Can only cancel pending loans' });
    if (String(loan.borrower) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Only borrower can cancel' });
    }

    loan.status = 'cancelled';
    await loan.save();

    res.json({ success: true, message: 'Loan cancelled' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
