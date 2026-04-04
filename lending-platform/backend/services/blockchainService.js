const { ethers } = require('ethers');
const path = require('path');
const fs   = require('fs');

let provider    = null;
let contract    = null;
let initialized = false;

function init() {
  if (initialized) return;

  const rpc = process.env.SEPOLIA_RPC_URL || process.env.LOCAL_RPC_URL;
  const addr = process.env.CONTRACT_ADDRESS;

  if (!rpc || !addr) {
    console.warn('[Blockchain] Missing SEPOLIA_RPC_URL or CONTRACT_ADDRESS — blockchain reads disabled');
    initialized = true;
    return;
  }

  // Load ABI (copied here by blockchain/scripts/extractABI.js)
  const abiPath = path.join(__dirname, '..', 'abi', 'LendingPlatform.json');
  if (!fs.existsSync(abiPath)) {
    console.warn('[Blockchain] ABI not found at', abiPath, '— run: cd blockchain && npm run extract-abi');
    initialized = true;
    return;
  }

  try {
    const artifact = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
    provider = new ethers.JsonRpcProvider(rpc);
    // Read-only contract instance (no signer needed — users sign from MetaMask)
    contract = new ethers.Contract(addr, artifact.abi, provider);
    initialized = true;
    console.log('[Blockchain] ✅ Connected — contract:', addr);
  } catch (err) {
    console.warn('[Blockchain] Init failed:', err.message);
    initialized = true;
  }
}

/**
 * Verify a transaction hash exists on-chain and was sent to our contract.
 * Returns true if valid, false if not found or wrong target.
 */
async function verifyTx(txHash) {
  init();
  if (!provider || !contract) return true; // Skip if not configured (dev mode)

  try {
    const tx = await provider.getTransaction(txHash);
    if (!tx) return false;
    const contractAddress = process.env.CONTRACT_ADDRESS;
    // Allow to=null for contract creation tx
    if (tx.to && tx.to.toLowerCase() !== contractAddress.toLowerCase()) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Read on-chain loan data by loanId.
 * Returns null if blockchain not configured.
 */
async function getLoanOnChain(onChainId) {
  init();
  if (!contract) return null;
  try {
    const l = await contract.getLoan(onChainId);
    return {
      id:              Number(l[0]),
      borrower:        l[1],
      lender:          l[2],
      principal:       ethers.formatEther(l[3]),
      collateral:      ethers.formatEther(l[4]),
      interestRateBps: Number(l[5]),
      durationDays:    Number(l[6]),
      startTime:       Number(l[7]),
      dueDate:         Number(l[8]),
      status:          Number(l[9]),
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
  if (!contract) return 80; // Default score if not connected
  try {
    const score = await contract.riskScore(walletAddress);
    return Number(score);
  } catch {
    return 80;
  }
}

/**
 * Get total owed (principal + interest) for an active loan.
 */
async function getTotalOwed(onChainId) {
  init();
  if (!contract) return null;
  try {
    const owed = await contract.totalOwed(onChainId);
    return ethers.formatEther(owed);
  } catch {
    return null;
  }
}

/**
 * Get current collateral ratio for a loan.
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

module.exports = { verifyTx, getLoanOnChain, getRiskScore, getTotalOwed, getCollateralRatio };
