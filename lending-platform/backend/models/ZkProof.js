const mongoose = require('mongoose');

/**
 * ZkProof — stores the ZK verification record for a user.
 *
 * Flow:
 *  1. User initiates verification → status: pending
 *  2. Reclaim/zkPass proof submitted → status: verified, proofHash stored
 *  3. On loan default → encryptedData revealed to lender (Lit Protocol gate)
 *
 * encryptedData: AES-GCM encrypted JSON of { name, idHash, incomeProof }
 *   encrypted with a symmetric key that Lit Protocol will release ONLY
 *   when the smart contract confirms defaultStatus == true for that loanId.
 *
 * The actual PII never touches our server in plaintext — it is encrypted
 * client-side before submission (see zkProofService.js for the flow).
 */
const zkProofSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,          // one ZK record per user
  },
  walletAddress: {
    type: String,
    required: true,
    lowercase: true,
  },

  // ── Proof metadata (from Reclaim / zkPass) ──────────────────
  proofType: {
    type: String,
    enum: ['reclaim', 'zkpass', 'anon_aadhaar', 'simulated'],
    default: 'simulated',
  },
  // The cryptographic proof identifier / hash from the ZK oracle
  proofHash: {
    type: String,
    default: null,
  },
  // What the proof attests to (no PII — just attestation metadata)
  attestation: {
    hasValidId:     { type: Boolean, default: false },
    hasIncome:      { type: Boolean, default: false },
    incomeAbove:    { type: Number,  default: 0 },     // USD threshold met
    countryCode:    { type: String,  default: null },  // 'IN', 'US', etc.
  },

  // ── Lit Protocol conditional encryption ─────────────────────
  // encryptedData: client-encrypted blob; decryptable only on default event
  encryptedData:     { type: String, default: null }, // base64 ciphertext
  encryptedKey:      { type: String, default: null }, // Lit-encrypted symmetric key
  litConditionHash:  { type: String, default: null }, // hash of Lit access conditions

  // ── On-chain anchor ─────────────────────────────────────────
  onChainTxHash: { type: String, default: null }, // tx that stored proofHash on-chain
  onChainBlock:  { type: Number, default: null },

  // ── Status machine ───────────────────────────────────────────
  status: {
    type: String,
    enum: ['pending', 'verified', 'rejected', 'revealed'],
    default: 'pending',
  },

  // ── Reveal tracking ─────────────────────────────────────────
  revealedTo:   { type: String, default: null }, // lender wallet address
  revealedAt:   { type: Date,   default: null },
  revealReason: { type: String, default: null }, // 'default' | 'mediator_request'
  revealTxHash: { type: String, default: null }, // smart contract event tx

  verifiedAt: { type: Date, default: null },
  expiresAt:  { type: Date, default: null },      // proofs expire after 1 year
  createdAt:  { type: Date, default: Date.now },
});

zkProofSchema.index({ walletAddress: 1 });
zkProofSchema.index({ status: 1 });

module.exports = mongoose.model('ZkProof', zkProofSchema);
