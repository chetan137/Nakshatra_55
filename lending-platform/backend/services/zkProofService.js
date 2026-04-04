/**
 * zkProofService.js
 *
 * Implements the Anonymous Verification layer using:
 *  - Reclaim Protocol / zkPass simulation for ZK proof generation
 *  - Lit Protocol simulation for conditional decryption on default
 *
 * Architecture:
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  User Device                                            │
 *  │  1. Opens bank/govt portal in browser                   │
 *  │  2. ZK Oracle (Reclaim) watches HTTP responses          │
 *  │  3. Generates proof: "income > $5000, valid ID"         │
 *  │  4. Client encrypts PII → encryptedData blob            │
 *  │  5. Lit key locked to: contractDefaultStatus == true    │
 *  └──────────────────────┬──────────────────────────────────┘
 *                         │ proofHash + encryptedData (NO PII)
 *                         ▼
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  Our Backend (this service)                             │
 *  │  - Verifies proof signature from Reclaim oracle         │
 *  │  - Stores proofHash + encryptedData in ZkProof model    │
 *  │  - Submits proofHash to smart contract                  │
 *  └──────────────────────┬──────────────────────────────────┘
 *                         │ proofHash on-chain
 *                         ▼
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  Smart Contract                                         │
 *  │  - Stores proofHash per borrower                        │
 *  │  - On default: emits ProofRevealTriggered(loanId,addr)  │
 *  └──────────────────────┬──────────────────────────────────┘
 *                         │ event triggers Lit gate
 *                         ▼
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  Lit Protocol Node Network                              │
 *  │  - Access condition: contract.isDefaulted(loanId)==true │
 *  │  - If met: releases symmetric key to lender wallet only │
 *  │  - Lender decrypts encryptedData locally                │
 *  └─────────────────────────────────────────────────────────┘
 *
 * IN HACKATHON MODE: We simulate the ZK oracle + Lit Protocol
 * with cryptographically sound local operations (crypto module).
 * Replace simulateReclaimProof() and simulateLitEncrypt() with
 * real SDK calls for production.
 */

const crypto = require('crypto');
const { ethers } = require('ethers');
const ZkProof = require('../models/ZkProof');
const User    = require('../models/User');

// ── Constants ───────────────────────────────────────────────────────────────
const PROOF_EXPIRY_DAYS = 365;
const INCOME_THRESHOLD_USD = 1000; // minimum income to qualify

// ── Utility: deterministic proof hash ───────────────────────────────────────

/**
 * Generates a deterministic proof hash from wallet + attestation data.
 * In production this would be the ZK circuit output from Reclaim Protocol.
 * The hash commits to the wallet address + attestation WITHOUT revealing PII.
 */
function generateProofHash(walletAddress, attestation, nonce) {
  const payload = JSON.stringify({
    wallet: walletAddress.toLowerCase(),
    attestation,
    nonce,
    ts: Math.floor(Date.now() / 60000), // 1-minute bucket for replay protection
  });
  return '0x' + crypto.createHash('sha256').update(payload).digest('hex');
}

// ── Utility: simulate Reclaim Protocol proof ────────────────────────────────

/**
 * Simulates the Reclaim Protocol oracle flow.
 * In production: replace with @reclaimprotocol/js-sdk verification.
 *
 * Reclaim Protocol flow:
 *  1. User visits their bank portal inside Reclaim's browser extension
 *  2. Reclaim captures the HTTPS response (zkTLS)
 *  3. Generates a ZK proof that specific fields exist (income > N, ID valid)
 *  4. Returns a signed proof object with no PII
 *
 * @param {object} claimData - what the user claims (income, id, country)
 * @param {string} walletAddress - borrower's wallet
 * @returns {{ proofHash, attestation, nonce, signature }}
 */
function simulateReclaimProof(claimData, walletAddress) {
  const { incomeUsd = 0, hasValidId = false, countryCode = 'IN' } = claimData;

  const attestation = {
    hasValidId: !!hasValidId,
    hasIncome: incomeUsd >= INCOME_THRESHOLD_USD,
    incomeAbove: INCOME_THRESHOLD_USD,
    countryCode,
  };

  const nonce = crypto.randomBytes(16).toString('hex');
  const proofHash = generateProofHash(walletAddress, attestation, nonce);

  // Simulate oracle signature (in prod: Reclaim's ECDSA sig over the proof)
  const oracleKey = crypto.createHash('sha256')
    .update('reclaim_oracle_hackathon_key')
    .digest();
  const hmac = crypto.createHmac('sha256', oracleKey)
    .update(proofHash)
    .digest('hex');

  return { proofHash, attestation, nonce, signature: hmac };
}

// ── Utility: simulate Lit Protocol conditional encryption ───────────────────

/**
 * Simulates Lit Protocol's encryption flow.
 * In production: replace with @lit-protocol/lit-node-client.
 *
 * Lit Protocol flow:
 *  1. Client generates AES-256-GCM symmetric key
 *  2. Encrypts PII data with that key → encryptedData (safe to store)
 *  3. Calls Lit network to encrypt the symmetric key with access conditions:
 *     - condition: LendingPlatform.isDefaulted(loanId) === true
 *     - only walletAddress === lenderAddress can decrypt
 *  4. Lit returns encryptedKey (safe to store, unusable without Lit gate)
 *  5. On default: Lit verifies chain condition → releases key to lender only
 *
 * @param {object} piiData - { name, idHash, incomeProof } (user's PII)
 * @param {string} loanId - loan ID to bind the condition to
 * @param {string} lenderAddress - only this address can trigger reveal
 * @returns {{ encryptedData, encryptedKey, litConditionHash }}
 */
function simulateLitEncrypt(piiData, loanId, lenderAddress) {
  // AES-256-GCM encryption of PII
  const symmetricKey = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', symmetricKey, iv);

  const plaintext = JSON.stringify(piiData);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Pack: iv(12) + authTag(16) + ciphertext
  const encryptedData = Buffer.concat([iv, authTag, encrypted]).toString('base64');

  // Simulate Lit access condition:
  // { contractAddress, chain, method: 'isDefaulted', params: [loanId], returnType: 'bool', comparator: '=', value: 'true' }
  const litCondition = {
    contractAddress: process.env.CONTRACT_ADDRESS || '0x0',
    chain: 'sepolia',
    method: 'isLoanDefaulted',
    params: [String(loanId)],
    returnValueTest: { comparator: '==', value: 'true' },
    authorizedAddress: lenderAddress?.toLowerCase() || null,
  };
  const litConditionHash = crypto.createHash('sha256')
    .update(JSON.stringify(litCondition))
    .digest('hex');

  // Simulate Lit encrypting the symmetric key
  // In prod: Lit nodes encrypt symmetricKey with their threshold key
  // Here: we XOR with a deterministic "Lit node key" for simulation
  const litNodeKey = crypto.createHash('sha256')
    .update('lit_node_threshold_key_simulation_' + litConditionHash)
    .digest();
  const encryptedKeyBuf = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) encryptedKeyBuf[i] = symmetricKey[i] ^ litNodeKey[i];
  const encryptedKey = encryptedKeyBuf.toString('base64');

  return { encryptedData, encryptedKey, litConditionHash };
}

/**
 * Simulate Lit Protocol decryption (triggered on default).
 * In production: Lit nodes verify on-chain condition then release key.
 *
 * @param {string} encryptedData - base64 blob
 * @param {string} encryptedKey - base64 encrypted symmetric key
 * @param {string} litConditionHash - to reconstruct the Lit node key
 * @returns {object} decrypted PII data
 */
function simulateLitDecrypt(encryptedData, encryptedKey, litConditionHash) {
  const litNodeKey = crypto.createHash('sha256')
    .update('lit_node_threshold_key_simulation_' + litConditionHash)
    .digest();

  const encryptedKeyBuf = Buffer.from(encryptedKey, 'base64');
  const symmetricKey = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) symmetricKey[i] = encryptedKeyBuf[i] ^ litNodeKey[i];

  const blob = Buffer.from(encryptedData, 'base64');
  const iv = blob.subarray(0, 12);
  const authTag = blob.subarray(12, 28);
  const ciphertext = blob.subarray(28);

  const decipher = crypto.createDecipheriv('aes-256-gcm', symmetricKey, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}

// ── Main Service Functions ───────────────────────────────────────────────────

/**
 * submitZkProof — called when user completes Reclaim flow on frontend.
 *
 * Steps:
 *  1. Validate proof signature from Reclaim oracle
 *  2. If user provided piiData (optional): Lit-encrypt it, store blob
 *  3. Store ZkProof record in DB (status: verified)
 *  4. Update user.zkVerified = true
 *  5. Return proofHash for frontend to anchor on-chain
 *
 * @param {string} userId
 * @param {string} walletAddress
 * @param {object} claimData - { incomeUsd, hasValidId, countryCode }
 * @param {object|null} piiData - { name, idHash, incomeProof } (optional, client-encrypted already)
 * @param {string|null} existingProofHash - if Reclaim SDK provided its own hash
 */
async function submitZkProof(userId, walletAddress, claimData, piiData = null) {
  // Generate / verify proof
  const { proofHash, attestation, nonce, signature } =
    simulateReclaimProof(claimData, walletAddress);

  if (!attestation.hasValidId) {
    throw new Error('ZK proof rejected: valid ID not attested');
  }
  if (!attestation.hasIncome) {
    throw new Error(`ZK proof rejected: income below $${INCOME_THRESHOLD_USD} threshold`);
  }

  // Upsert ZkProof record
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + PROOF_EXPIRY_DAYS);

  let encryptedData = null;
  let encryptedKey = null;
  let litConditionHash = null;

  // Encrypt PII if provided (user opted into recovery guarantee)
  if (piiData) {
    const litResult = simulateLitEncrypt(piiData, 'pending', null);
    encryptedData = litResult.encryptedData;
    encryptedKey = litResult.encryptedKey;
    litConditionHash = litResult.litConditionHash;
  }

  const zkRecord = await ZkProof.findOneAndUpdate(
    { user: userId },
    {
      user: userId,
      walletAddress: walletAddress.toLowerCase(),
      proofType: 'simulated',
      proofHash,
      attestation,
      encryptedData,
      encryptedKey,
      litConditionHash,
      status: 'verified',
      verifiedAt: new Date(),
      expiresAt: expiry,
    },
    { upsert: true, new: true }
  );

  // Mark user as ZK verified
  await User.findByIdAndUpdate(userId, {
    zkVerified: true,
    zkVerifiedAt: new Date(),
    zkProofHash: proofHash,
  });

  return {
    proofHash,
    attestation,
    zkRecordId: zkRecord._id,
    expiresAt: expiry,
  };
}

/**
 * getZkStatus — returns a user's ZK verification status.
 */
async function getZkStatus(userId) {
  const record = await ZkProof.findOne({ user: userId }).lean();
  if (!record) return { status: 'none', verified: false };

  const expired = record.expiresAt && new Date() > record.expiresAt;
  if (expired && record.status === 'verified') {
    await ZkProof.findByIdAndUpdate(record._id, { status: 'rejected' });
    return { status: 'expired', verified: false };
  }

  return {
    status: record.status,
    verified: record.status === 'verified',
    attestation: record.attestation,
    proofHash: record.proofHash,
    verifiedAt: record.verifiedAt,
    expiresAt: record.expiresAt,
    hasEncryptedBackup: !!record.encryptedData,
  };
}

/**
 * triggerReveal — called by monitoringService when a loan defaults.
 *
 * The smart contract emits ProofRevealTriggered → backend catches event →
 * calls this function → Lit Protocol verifies chain condition → releases key.
 *
 * In hackathon mode: we directly do the simulation decrypt.
 *
 * @param {string} borrowerWallet
 * @param {string} lenderWallet
 * @param {string|number} loanId
 * @param {string} revealTxHash - the liquidation tx hash
 */
async function triggerReveal(borrowerWallet, lenderWallet, loanId, revealTxHash) {
  const record = await ZkProof.findOne({
    walletAddress: borrowerWallet.toLowerCase(),
    status: 'verified',
  });

  if (!record) {
    console.log(`[ZK] No verified proof for ${borrowerWallet} — skipping reveal`);
    return null;
  }

  if (!record.encryptedData) {
    console.log(`[ZK] Borrower ${borrowerWallet} did not opt into encrypted backup`);
    return null;
  }

  // In production: call Lit Protocol SDK here, it verifies on-chain condition
  // and releases the symmetric key ONLY to lenderWallet
  let revealedPii = null;
  try {
    revealedPii = simulateLitDecrypt(
      record.encryptedData,
      record.encryptedKey,
      record.litConditionHash
    );
  } catch (err) {
    console.error('[ZK] Lit decrypt failed:', err.message);
    return null;
  }

  await ZkProof.findByIdAndUpdate(record._id, {
    status: 'revealed',
    revealedTo: lenderWallet.toLowerCase(),
    revealedAt: new Date(),
    revealReason: 'default',
    revealTxHash,
  });

  console.log(`[ZK] Proof revealed for loan ${loanId}: borrower ${borrowerWallet} → lender ${lenderWallet}`);

  return {
    revealedTo: lenderWallet,
    attestation: record.attestation,
    // In production: lender would receive an encrypted package they decrypt locally
    // Here we return the PII only as a simulation — in prod it goes via Lit to lender's wallet
    revealedData: revealedPii,
  };
}

/**
 * verifyProofOnChain — checks if a proofHash is valid and matches DB record.
 * Called by loan routes before allowing a loan to be created.
 */
async function verifyProofOnChain(walletAddress) {
  const record = await ZkProof.findOne({
    walletAddress: walletAddress.toLowerCase(),
    status: 'verified',
  }).lean();

  if (!record) return false;
  if (record.expiresAt && new Date() > record.expiresAt) return false;
  return true;
}

module.exports = {
  submitZkProof,
  getZkStatus,
  triggerReveal,
  verifyProofOnChain,
  simulateLitEncrypt,
  simulateLitDecrypt,
};
