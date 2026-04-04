/**
 * routes/zk.js — ZK Anonymous Verification endpoints
 *
 * POST /api/zk/submit-proof      Submit ZK proof from Reclaim/zkPass oracle
 * GET  /api/zk/status            Get current user's ZK verification status
 * POST /api/zk/reveal            Trigger Lit Protocol reveal (internal/monitoring)
 * GET  /api/zk/verify/:wallet    Check if a wallet address is ZK-verified (public)
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { verifyToken } = require('../middleware/auth');
const {
  submitZkProof,
  getZkStatus,
  triggerReveal,
  verifyProofOnChain,
} = require('../services/zkProofService');
const ZkProof = require('../models/ZkProof');

const router = express.Router();

// ── POST /api/zk/submit-proof ────────────────────────────────────────────────
// Called after user completes the Reclaim Protocol / zkPass flow on frontend.
// Body: { claimData: { incomeUsd, hasValidId, countryCode }, piiData? }
// piiData is OPTIONAL — user opts in for lender guarantee (will be Lit-encrypted)
router.post(
  '/submit-proof',
  verifyToken,
  [
    body('claimData').isObject().withMessage('claimData is required'),
    body('claimData.hasValidId').isBoolean().withMessage('hasValidId must be boolean'),
    body('claimData.incomeUsd').isNumeric().withMessage('incomeUsd must be a number'),
    body('claimData.countryCode').optional().isLength({ min: 2, max: 3 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const user = req.user;

    if (!user.walletAddress) {
      return res.status(400).json({
        success: false,
        message: 'You must connect and verify your wallet before ZK verification.',
      });
    }

    try {
      const { claimData, piiData = null } = req.body;

      const result = await submitZkProof(
        user._id,
        user.walletAddress,
        claimData,
        piiData
      );

      res.json({
        success: true,
        message: 'ZK proof verified successfully. Your identity is attested without revealing any personal data.',
        proofHash: result.proofHash,
        attestation: result.attestation,
        expiresAt: result.expiresAt,
        hasEncryptedBackup: !!piiData,
      });
    } catch (err) {
      console.error('[ZK] submit-proof error:', err.message);
      res.status(400).json({ success: false, message: err.message });
    }
  }
);

// ── GET /api/zk/status ───────────────────────────────────────────────────────
// Returns the current user's ZK verification status + attestation (no PII).
router.get('/status', verifyToken, async (req, res) => {
  try {
    const status = await getZkStatus(req.user._id);
    res.json({ success: true, ...status });
  } catch (err) {
    console.error('[ZK] status error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch ZK status' });
  }
});

// ── GET /api/zk/verify/:wallet ───────────────────────────────────────────────
// Public endpoint — lets lenders check if a borrower wallet is ZK-verified.
// Returns only boolean + attestation summary. NO PII.
router.get('/verify/:wallet', async (req, res) => {
  try {
    const wallet = req.params.wallet.toLowerCase();

    if (!/^0x[0-9a-f]{40}$/i.test(wallet)) {
      return res.status(400).json({ success: false, message: 'Invalid wallet address' });
    }

    const record = await ZkProof.findOne({
      walletAddress: wallet,
      status: 'verified',
    }).lean();

    if (!record) {
      return res.json({
        success: true,
        verified: false,
        message: 'This wallet has not completed ZK verification.',
      });
    }

    const expired = record.expiresAt && new Date() > record.expiresAt;
    if (expired) {
      return res.json({ success: true, verified: false, message: 'ZK proof expired.' });
    }

    res.json({
      success: true,
      verified: true,
      attestation: record.attestation,  // { hasValidId, hasIncome, incomeAbove, countryCode }
      verifiedAt: record.verifiedAt,
      proofHash: record.proofHash,       // on-chain verifiable hash (no PII)
      hasEncryptedBackup: !!record.encryptedData,
    });
  } catch (err) {
    console.error('[ZK] verify error:', err.message);
    res.status(500).json({ success: false, message: 'Verification check failed' });
  }
});

// ── POST /api/zk/reveal ──────────────────────────────────────────────────────
// Internal endpoint called by monitoringService when a loan defaults.
// In production this is triggered by a smart contract event listener.
// Body: { borrowerWallet, lenderWallet, loanId, revealTxHash, internalSecret }
router.post('/reveal', async (req, res) => {
  // Basic internal auth — in production use a proper service account / webhook secret
  const secret = req.headers['x-internal-secret'];
  if (!secret || secret !== process.env.INTERNAL_SERVICE_SECRET) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  const { borrowerWallet, lenderWallet, loanId, revealTxHash } = req.body;
  if (!borrowerWallet || !lenderWallet || loanId === undefined) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  try {
    const result = await triggerReveal(borrowerWallet, lenderWallet, loanId, revealTxHash);

    if (!result) {
      return res.json({
        success: true,
        revealed: false,
        message: 'No encrypted backup available for this borrower.',
      });
    }

    res.json({
      success: true,
      revealed: true,
      revealedTo: result.revealedTo,
      attestation: result.attestation,
      // In production: revealedData would be delivered to lender via Lit Protocol
      // NOT via this API response (which could be intercepted)
      message: 'Lit Protocol gate opened. Lender can now decrypt borrower identity.',
    });
  } catch (err) {
    console.error('[ZK] reveal error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/zk/proof/:wallet ────────────────────────────────────────────────
// Fetch proof hash for on-chain submission (authenticated, own wallet only).
router.get('/proof/:wallet', verifyToken, async (req, res) => {
  try {
    const wallet = req.params.wallet.toLowerCase();

    if (req.user.walletAddress?.toLowerCase() !== wallet) {
      return res.status(403).json({ success: false, message: 'Can only fetch your own proof' });
    }

    const record = await ZkProof.findOne({
      walletAddress: wallet,
      status: 'verified',
    }).lean();

    if (!record) {
      return res.status(404).json({ success: false, message: 'No verified proof found' });
    }

    res.json({
      success: true,
      proofHash: record.proofHash,
      attestation: record.attestation,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch proof' });
  }
});

module.exports = router;
