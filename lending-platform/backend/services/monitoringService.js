/**
 * monitoringService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Runs on the backend every hour.
 * For every ACTIVE loan it:
 *   1. Fetches current ETH/USD price from CoinGecko (free, no API key needed).
 *   2. Calculates collateral ratio = (collateral * ethPrice) / (principal * ethPrice) * 100
 *      (Since both are in ETH, the price cancels — ratio = collateral/principal * 100)
 *   3. If ratio < 150% → issue margin call email (once per loan, resets on ratio recovery)
 *   4. If ratio < 120% AND margin call deadline passed → trigger on-chain liquidation
 *      via the contract, then update DB + send liquidation alert email.
 *
 * Start this by calling startMonitoring() once in server.js.
 */

'use strict';

const { ethers }                              = require('ethers');
const path                                    = require('path');
const fs                                      = require('fs');
const Loan                                    = require('../models/Loan');
const User                                    = require('../models/User');
const { sendMarginCallAlert, sendLiquidationAlert } = require('./emailService');

// ── Config ────────────────────────────────────────────────────
const CHECK_INTERVAL_MS    = 60 * 60 * 1000; // 1 hour
const MARGIN_CALL_RATIO    = 150;             // below this → margin call
const LIQUIDATION_RATIO    = 120;             // below this → liquidate
const MARGIN_CALL_DEADLINE = 48 * 60 * 60 * 1000; // 48 hours

let contract  = null;
let wallet    = null;
let provider  = null;

// ── Initialise blockchain writer ──────────────────────────────
function initBlockchain() {
  const rpc        = process.env.SEPOLIA_RPC_URL || process.env.LOCAL_RPC_URL;
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY; // separate monitoring key (optional)
  const addr       = process.env.CONTRACT_ADDRESS;

  if (!rpc || !addr) {
    console.warn('[Monitor] SEPOLIA_RPC_URL or CONTRACT_ADDRESS missing — liquidation trigger disabled');
    return false;
  }

  if (!privateKey) {
    console.warn('[Monitor] DEPLOYER_PRIVATE_KEY not set — will log liquidation intent but NOT call contract');
    // Still run price monitoring + emails even if we can't auto-liquidate
  }

  const abiPath = path.join(__dirname, '..', 'abi', 'LendingPlatform.json');
  if (!fs.existsSync(abiPath)) {
    console.warn('[Monitor] ABI not found at', abiPath);
    return false;
  }

  const artifact = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
  provider = new ethers.JsonRpcProvider(rpc);

  if (privateKey) {
    wallet   = new ethers.Wallet(privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`, provider);
    contract = new ethers.Contract(addr, artifact.abi, wallet);
    console.log('[Monitor] ✅ Blockchain writer ready. Wallet:', wallet.address);
  } else {
    // Read-only — can't auto-liquidate but can still check prices
    contract = new ethers.Contract(addr, artifact.abi, provider);
    console.log('[Monitor] ℹ️ Read-only mode (no DEPLOYER_PRIVATE_KEY)');
  }

  return true;
}

// ── Fetch ETH price from multiple sources, return median ─────
async function fetchFromSource(name, url, extract) {
  try {
    const res  = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal:  AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const price = extract(data);
    if (!price || typeof price !== 'number' || price <= 0) throw new Error('Invalid price value');
    return price;
  } catch (err) {
    console.warn(`[Monitor] ${name} price fetch failed: ${err.message}`);
    return null;
  }
}

async function getEthPriceUSD() {
  const [coingecko, cryptocompare, binance] = await Promise.all([
    fetchFromSource(
      'CoinGecko',
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
      d => d?.ethereum?.usd
    ),
    fetchFromSource(
      'CryptoCompare',
      'https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=USD',
      d => d?.USD
    ),
    fetchFromSource(
      'Binance',
      'https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT',
      d => d?.price ? parseFloat(d.price) : null
    ),
  ]);

  const prices = [coingecko, cryptocompare, binance].filter(p => p !== null);
  console.log(`[Monitor] Price sources — CoinGecko: ${coingecko}, CryptoCompare: ${cryptocompare}, Binance: ${binance}`);

  if (prices.length < 2) {
    console.error('[Monitor] ❌ Fewer than 2 price sources responded — skipping round');
    return null;
  }

  prices.sort((a, b) => a - b);
  const median = prices.length === 3
    ? prices[1]
    : (prices[0] + prices[1]) / 2;

  // Sanity check: if any source deviates more than 5% from median, warn
  [coingecko, cryptocompare, binance].forEach((p, i) => {
    if (p !== null && Math.abs(p - median) / median > 0.05) {
      const names = ['CoinGecko', 'CryptoCompare', 'Binance'];
      console.warn(`[Monitor] ⚠️ ${names[i]} price $${p} deviates >5% from median $${median.toFixed(2)}`);
    }
  });

  console.log(`[Monitor] Median ETH/USD = $${median.toFixed(2)} (from ${prices.length} sources)`);
  return median;
}

// ── Trigger on-chain liquidation ──────────────────────────────
async function triggerOnChainLiquidation(loan) {
  if (!wallet || !contract) {
    console.warn(`[Monitor] Cannot auto-liquidate loan ${loan._id} — no signer`);
    return null;
  }
  try {
    console.log(`[Monitor] Calling liquidateLoanIfNeeded(${loan.onChainId}) on-chain…`);
    const tx      = await contract.liquidateLoanIfNeeded(loan.onChainId);
    const receipt = await tx.wait();
    if (receipt.status === 0) {
      console.error(`[Monitor] liquidateLoanIfNeeded reverted for loan ${loan._id}`);
      return null;
    }
    console.log(`[Monitor] ✅ Liquidated loan ${loan._id} — txHash: ${receipt.hash}`);
    return receipt.hash;
  } catch (err) {
    console.error(`[Monitor] Auto-liquidation failed for loan ${loan._id}:`, err.message);
    return null;
  }
}

// ── Load borrower + lender user objects ───────────────────────
async function loadParties(loan) {
  const [borrower, lender] = await Promise.all([
    loan.borrower ? User.findById(loan.borrower).select('name email').lean() : null,
    loan.lender   ? User.findById(loan.lender).select('name email').lean()   : null,
  ]);
  return { borrower, lender };
}

// ── Main check loop ───────────────────────────────────────────
async function runPriceCheck() {
  console.log(`[Monitor] 🔍 Price check — ${new Date().toISOString()}`);

  // 1. Get ETH price
  const ethPrice = await getEthPriceUSD();
  if (!ethPrice) {
    console.warn('[Monitor] Could not get ETH price — skipping this round');
    return;
  }
  console.log(`[Monitor] ETH/USD = $${ethPrice}`);

  // 2. Load all active loans
  let activeLoans;
  try {
    activeLoans = await Loan.find({ status: 'active' }).lean();
  } catch (err) {
    console.error('[Monitor] DB query failed:', err.message);
    return;
  }

  console.log(`[Monitor] Checking ${activeLoans.length} active loan(s)…`);

  for (const loan of activeLoans) {
    try {
      // Ratio = collateral/principal * 100  (both in ETH, price cancels)
      const ratio = loan.principal > 0
        ? Math.floor((loan.collateral / loan.principal) * 100)
        : 999;

      console.log(`[Monitor] Loan ${loan._id}: ratio=${ratio}% | collateral=${loan.collateral} ETH | principal=${loan.principal} ETH`);

      // ── SAFE ─────────────────────────────────────────────
      if (ratio >= MARGIN_CALL_RATIO) {
        // If we had issued a margin call before and ratio recovered, clear it
        if (loan.marginCallIssuedAt) {
          await Loan.findByIdAndUpdate(loan._id, {
            $unset: { marginCallIssuedAt: '', marginCallDeadline: '' },
          });
          console.log(`[Monitor] ✅ Loan ${loan._id} ratio recovered — margin call cleared`);
        }
        continue;
      }

      // ── BELOW LIQUIDATION THRESHOLD → AUTO-LIQUIDATE ─────
      if (ratio < LIQUIDATION_RATIO) {
        const deadline     = loan.marginCallDeadline ? new Date(loan.marginCallDeadline) : null;
        const deadlinePast = deadline ? new Date() > deadline : true; // no deadline = overdue already

        if (deadlinePast) {
          console.log(`[Monitor] 🚨 Loan ${loan._id}: ratio ${ratio}% < ${LIQUIDATION_RATIO}% — AUTO LIQUIDATING`);

          const txHash = await triggerOnChainLiquidation(loan);

          if (txHash) {
            // Only update DB when we have a confirmed on-chain tx
            await Loan.findByIdAndUpdate(loan._id, {
              status:          'defaulted',
              liquidatedAt:    new Date(),
              liquidateTxHash: txHash,
            });
            const { borrower, lender } = await loadParties(loan);
            await sendLiquidationAlert(lender, borrower, loan, ratio, 'price_drop');
            console.log(`[Monitor] ✅ Loan ${loan._id} marked defaulted. Emails sent.`);
          } else {
            // No signer or tx failed — log for manual review, do NOT mutate DB
            console.error(`[Monitor] ❌ Loan ${loan._id} liquidation failed on-chain — DB NOT updated. Manual review needed.`);
          }
        } else {
          console.log(`[Monitor] ⚠️ Loan ${loan._id}: ratio ${ratio}% — below threshold but deadline not passed yet`);
        }
        continue;
      }

      // ── BETWEEN 120% AND 150% → MARGIN CALL ───────────────
      if (ratio < MARGIN_CALL_RATIO && ratio >= LIQUIDATION_RATIO) {
        // Only send once (until ratio recovers)
        if (loan.marginCallIssuedAt) {
          console.log(`[Monitor] ℹ️ Loan ${loan._id}: margin call already issued — skipping`);
          continue;
        }

        const deadline = new Date(Date.now() + MARGIN_CALL_DEADLINE);

        await Loan.findByIdAndUpdate(loan._id, {
          marginCallIssuedAt: new Date(),
          marginCallDeadline: deadline,
          status:             'active',  // stays active — user has time to act
        });

        const { borrower, lender } = await loadParties(loan);
        await sendMarginCallAlert(borrower, lender, loan, ratio, deadline);

        console.log(`[Monitor] ⚠️ Margin call issued for loan ${loan._id} — deadline: ${deadline.toISOString()}`);
      }

    } catch (loanErr) {
      console.error(`[Monitor] Error processing loan ${loan._id}:`, loanErr.message);
    }
  }

  console.log(`[Monitor] ✅ Price check complete`);
}

// ── Public: start the monitoring loop ─────────────────────────
function startMonitoring() {
  initBlockchain();

  // Run immediately on startup, then every hour
  runPriceCheck().catch(err => console.error('[Monitor] First run failed:', err.message));
  const timer = setInterval(() => {
    runPriceCheck().catch(err => console.error('[Monitor] Interval run failed:', err.message));
  }, CHECK_INTERVAL_MS);

  // Allow clean shutdown
  process.on('SIGTERM', () => clearInterval(timer));
  process.on('SIGINT',  () => clearInterval(timer));

  console.log(`[Monitor] 🕐 Price monitoring started (every ${CHECK_INTERVAL_MS / 60000} min)`);
}

module.exports = { startMonitoring };
