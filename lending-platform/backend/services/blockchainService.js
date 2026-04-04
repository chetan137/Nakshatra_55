const { ethers } = require('ethers');
const path = require('path');
const fs   = require('fs');

let provider    = null;
let contract    = null;
let initialized = false;

// Sepolia chain ID
const SEPOLIA_CHAIN_ID = 11155111;

function init() {
  if (initialized) return;

  const rpc  = process.env.SEPOLIA_RPC_URL || process.env.LOCAL_RPC_URL;
  const addr = process.env.CONTRACT_ADDRESS;

  if (!rpc || !addr) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[Blockchain] SEPOLIA_RPC_URL and CONTRACT_ADDRESS are required in production');
    }
    console.warn('[Blockchain] Missing SEPOLIA_RPC_URL or CONTRACT_ADDRESS — blockchain reads disabled (dev only)');
    initialized = true;
    return;
  }

  const abiPath = path.join(__dirname, '..', 'abi', 'LendingPlatform.json');

  try {
    const artifact = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
    provider = new ethers.JsonRpcProvider(rpc);
    contract = new ethers.Contract(addr, artifact.abi, provider);
    initialized = true;
    console.log('[Blockchain] ✅ Connected — contract:', addr);
  } catch (err) {
    // Distinguish "file not found" from other errors for a clearer message
    const msg = err.code === 'ENOENT'
      ? `[Blockchain] ABI not found at ${abiPath} — run: cd blockchain && npm run extract-abi`
      : `[Blockchain] Init failed: ${err.message}`;
    if (process.env.NODE_ENV === 'production') throw new Error(msg);
    console.warn(msg);
    initialized = true;
  }
}

/**
 * Verify a transaction hash exists on-chain and targets our contract.
 * In production: throws if blockchain is not configured.
 * In dev without config: returns true (allows testing without a node).
 */
async function verifyTx(txHash) {
  init();

  // Production must have blockchain configured
  if (!provider || !contract) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Blockchain not configured — cannot verify transaction');
    }
    // Dev-only bypass
    console.warn('[Blockchain] verifyTx: blockchain not configured, skipping verification (dev only)');
    return true;
  }

  // Infura/Alchemy nodes can be eventually consistent.
  // After frontend tx.wait(), the specific read node we hit might not have indexed it yet.
  // We'll retry up to 3 times before declaring it a failure.
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const tx = await provider.getTransaction(txHash);
      if (!tx) {
        if (attempt < 3) { await new Promise(r => setTimeout(r, 2000)); continue; }
        return false;
      }
      
      const contractAddr = String(process.env.CONTRACT_ADDRESS).trim();
      if (tx.to && tx.to.toLowerCase() !== contractAddr.toLowerCase()) return false;
      
      // Also confirm it was mined (receipt exists)
      const receipt = await provider.getTransactionReceipt(txHash);
      if (!receipt) {
        if (attempt < 3) { await new Promise(r => setTimeout(r, 2000)); continue; }
        return false;
      }
      if (receipt.status === 0) return false;
      
      return true; // Successfully verified on-chain
    } catch (err) {
      if (attempt < 3) { await new Promise(r => setTimeout(r, 2000)); continue; }
      console.warn('[Blockchain] verifyTx error:', err.message);
      return false;
    }
  }
  return false;
}

/**
 * Read on-chain loan data by loanId.
 */
async function getLoanOnChain(onChainId) {
  init();
  if (!contract) return null;
  try {
    const l = await contract.getLoan(onChainId);
    return {
      id:               Number(l.id),
      borrower:         l.borrower,
      lender:           l.lender,
      principal:        ethers.formatEther(l.principal),
      collateralAmount: ethers.formatEther(l.collateralAmount),
      interestRate:     Number(l.interestRate),
      startDate:        Number(l.startDate),
      dueDate:          Number(l.dueDate),
      repaid:           l.repaid,
      completed:        l.completed,
      defaulted:        l.defaulted,
      durationDays:     Number(l.durationDays),
      status:           Number(l.status),
    };
  } catch (err) {
    console.warn('[Blockchain] getLoan failed:', err.message);
    return null;
  }
}

/**
 * Get on-chain risk score for a wallet address.
 */
async function getRiskScore(walletAddress) {
  init();
  if (!contract) return 80;
  try {
    const score = await contract.riskScore(walletAddress);
    return Number(score);
  } catch {
    return 80;
  }
}

/**
 * Get live total owed (principal + accrued interest) directly from chain.
 * Returns ETH as string (e.g. "0.512345"), or null if unavailable.
 */
async function getLiveTotalOwed(onChainId) {
  init();
  if (!contract) return null;
  try {
    const owed = await contract.totalOwed(onChainId);
    return ethers.formatEther(owed);
  } catch (err) {
    console.warn('[Blockchain] totalOwed failed:', err.message);
    return null;
  }
}

/**
 * Get current collateral ratio (without price feed — collateral/principal * 100).
 */
async function getCollateralRatio(onChainId) {
  init();
  if (!contract) return null;
  try {
    const ratio = await contract.collateralRatio(onChainId);
    return Number(ratio);
  } catch {
    return null;
  }
}

/**
 * Get price-adjusted collateral ratio using Chainlink feed.
 */
async function getCollateralRatioWithPrice(onChainId) {
  init();
  if (!contract) return null;
  try {
    const ratio = await contract.collateralRatioWithPrice(onChainId);
    return Number(ratio);
  } catch {
    return null;
  }
}

/**
 * Compute a dynamic risk score (0–100) for a borrower.
 * Combines on-chain contract reputation with MongoDB loan history.
 * Higher = safer borrower.
 */
async function computeRiskScore(walletAddress, userId) {
  init();

  let contractScore = 80; // default
  if (contract) {
    try {
      contractScore = Number(await contract.riskScore(walletAddress));
    } catch { /* keep default */ }
  }

  // Pull MongoDB history for this user
  let dbScore = 80;
  if (userId) {
    try {
      const Loan = require('../models/Loan');
      const loans = await Loan.find({ borrower: userId }).lean();
      if (loans.length > 0) {
        const repaid    = loans.filter(l => l.status === 'repaid').length;
        const defaulted = loans.filter(l => l.status === 'defaulted').length;
        // Base: 80, +2 per repaid, -10 per default, capped 0-100
        dbScore = Math.min(100, Math.max(0, 80 + (repaid * 2) - (defaulted * 10)));
        // Bonus: high collateral ratio average
        const activeOrRepaid = loans.filter(l => l.principal > 0 && l.collateral > 0);
        if (activeOrRepaid.length > 0) {
          const avgRatio = activeOrRepaid.reduce((s, l) => s + (l.collateral / l.principal), 0) / activeOrRepaid.length;
          if (avgRatio >= 2.0) dbScore = Math.min(100, dbScore + 5);  // 200%+ collateral history
          if (avgRatio >= 1.8) dbScore = Math.min(100, dbScore + 3);
        }
      }
    } catch { /* keep default */ }
  }

  // Weighted average: 40% contract (on-chain truth), 60% DB (richer history)
  const final = Math.round(contractScore * 0.4 + dbScore * 0.6);
  return Math.min(100, Math.max(0, final));
}

module.exports = {
  verifyTx,
  getLoanOnChain,
  getRiskScore,
  getLiveTotalOwed,
  getCollateralRatio,
  getCollateralRatioWithPrice,
  computeRiskScore,
};
