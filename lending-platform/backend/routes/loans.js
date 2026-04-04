const express = require('express');
const Loan    = require('../models/Loan');
const User    = require('../models/User');
const { verifyToken } = require('../middleware/auth');
const blockchain = require('../services/blockchainService');

const router = express.Router();

// Verify a tx hash if provided; throw with 400 status if invalid.
// In production, hash is always required.
async function requireTxHash(txHash, label) {
  if (txHash) {
    const valid = await blockchain.verifyTx(txHash);
    if (!valid) {
      const err = new Error(`${label} not found or failed on-chain`);
      err.status = 400;
      throw err;
    }
  } else if (process.env.NODE_ENV === 'production') {
    const err = new Error(`${label} is required`);
    err.status = 400;
    throw err;
  }
}

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

    if (!principal || !collateral || !interestRateBps || !durationDays || !borrowerAddress) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Validate collateral ratio (values are ETH floats from frontend)
    const ratio = Number(collateral) / Number(principal);
    if (ratio < 1.5) {
      return res.status(400).json({
        success: false,
        message: `Collateral ratio is ${(ratio * 100).toFixed(0)}% — must be ≥ 150%`,
      });
    }

    await requireTxHash(createTxHash, 'createTxHash');

    const [riskScoreVal] = await Promise.all([
      blockchain.getRiskScore(borrowerAddress),
      User.findByIdAndUpdate(req.user._id, { walletAddress: borrowerAddress }),
    ]);

    const loan = await Loan.create({
      onChainId:       onChainId ?? null,
      createTxHash:    createTxHash || null,
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
// Public — all pending loans for lender browsing (paginated)
// Query: ?page=1&limit=20
// ─────────────────────────────────────────────────────────
router.get('/available', async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip  = (page - 1) * limit;

    const [loans, total] = await Promise.all([
      Loan.find({ status: 'pending' })
        .populate('borrower', 'name loansCompleted loansDefaulted walletAddress')
        .sort({ riskScore: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean({ virtuals: true }),
      Loan.countDocuments({ status: 'pending' }),
    ]);

    res.json({ success: true, loans, page, limit, total, pages: Math.ceil(total / limit) });
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
      Loan.find({ lender:   uid }),
    ]);

    const totalBorrowed  = borrowedLoans.reduce((s, l) => s + (l.principal || 0), 0);
    const totalLent      = lentLoans.reduce((s, l) => s + (l.principal || 0), 0);
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
// GET /api/loans/:id/owed
// Auth (borrower only) — live repayment amount from chain.
// Returns exact ETH the borrower must send right now.
// ─────────────────────────────────────────────────────────
router.get('/:id/owed', verifyToken, async (req, res, next) => {
  try {
    const loan = await Loan.findById(req.params.id);
    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });
    if (loan.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Loan is not active' });
    }
    if (String(loan.borrower) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Only borrower can query owed amount' });
    }

    if (loan.onChainId === null) {
      // Fallback: calculate off-chain (less accurate — no real-time price)
      const elapsed = (Date.now() - new Date(loan.startDate).getTime()) / 1000;
      const interest = (loan.principal * loan.interestRateBps * elapsed) / (10000 * 365 * 24 * 3600);
      return res.json({ success: true, totalOwedEth: (loan.principal + interest).toFixed(8), source: 'offchain' });
    }

    // Fetch live from chain (accounts for exact elapsed seconds)
    const totalOwedEth = await blockchain.getLiveTotalOwed(loan.onChainId);
    if (!totalOwedEth) {
      return res.status(503).json({ success: false, message: 'Could not fetch live repayment amount from chain' });
    }

    res.json({ success: true, totalOwedEth, source: 'onchain' });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────
// GET /api/loans/:id
// Public — single loan details (with live on-chain data)
// ─────────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const loan = await Loan.findById(req.params.id)
      .populate('borrower', 'name walletAddress')
      .populate('lender',   'name walletAddress')
      .lean({ virtuals: true });

    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });

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
    if (!lenderAddress) {
      return res.status(400).json({ success: false, message: 'lenderAddress is required' });
    }

    const loan = await Loan.findById(req.params.id);
    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });
    if (loan.status !== 'pending') return res.status(400).json({ success: false, message: 'Loan not pending' });
    if (String(loan.borrower) === String(req.user._id)) {
      return res.status(400).json({ success: false, message: 'Borrower cannot fund own loan' });
    }

    await requireTxHash(fundTxHash, 'fundTxHash');
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

    await requireTxHash(repayTxHash, 'repayTxHash');

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
// Auth — anyone records liquidation AFTER calling liquidateLoanIfNeeded() on chain
// Allows both time-overdue AND price-triggered liquidations
// Body: { liquidateTxHash }
// ─────────────────────────────────────────────────────────
router.put('/:id/liquidate', verifyToken, async (req, res, next) => {
  try {
    const { liquidateTxHash } = req.body;
    const loan = await Loan.findById(req.params.id);

    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });
    if (loan.status !== 'active') return res.status(400).json({ success: false, message: 'Loan not active' });

    const isOverdue = loan.dueDate && new Date() > loan.dueDate;

    // Check price-triggered liquidation via on-chain ratio
    let isPriceTriggered = false;
    if (!isOverdue && loan.onChainId !== null) {
      const ratio = await blockchain.getCollateralRatioWithPrice(loan.onChainId);
      isPriceTriggered = ratio !== null && ratio < 120;
    }

    if (!isOverdue && !isPriceTriggered) {
      return res.status(400).json({
        success: false,
        message: 'Loan is not liquidatable: not overdue and collateral ratio is above 120%',
      });
    }

    await requireTxHash(liquidateTxHash, 'liquidateTxHash');

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
