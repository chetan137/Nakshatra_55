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

  try {
    const tx = await provider.getTransaction(txHash);
    if (!tx) return false;
    const contractAddr = process.env.CONTRACT_ADDRESS;
    if (tx.to && tx.to.toLowerCase() !== contractAddr.toLowerCase()) return false;
    // Also confirm it was mined (receipt exists)
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt || receipt.status === 0) return false;
    return true;
  } catch (err) {
    console.warn('[Blockchain] verifyTx error:', err.message);
    return false;
  }
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

module.exports = {
  verifyTx,
  getLoanOnChain,
  getRiskScore,
  getLiveTotalOwed,
  getCollateralRatio,
  getCollateralRatioWithPrice,
};
