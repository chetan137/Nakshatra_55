import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, CheckCircle, AlertTriangle, XCircle, RefreshCw, ExternalLink, Zap, Percent } from 'lucide-react';
import toast from 'react-hot-toast';
import { getMyLoans, repayLoan as repayAPI, liquidateLoan as liquidateAPI, getLoanOwed, getLoan, cancelLoan as cancelAPI, respondToCounter } from '../api/loanApi';
import { useWallet } from '../hooks/useWallet';

const STATUS_CONFIG = {
  pending:   { icon: <Clock size={14} />,          color: '#815249', bg: '#fef2f0', label: 'Pending' },
  active:    { icon: <CheckCircle size={14} />,     color: '#00373f', bg: '#e6f0ef', label: 'Active' },
  repaid:    { icon: <CheckCircle size={14} />,     color: '#60180b', bg: '#f5e8e5', label: 'Repaid' },
  defaulted: { icon: <AlertTriangle size={14} />,   color: '#ba1a1a', bg: '#fde8e8', label: 'Defaulted' },
  cancelled: { icon: <XCircle size={14} />,         color: '#8a7e80', bg: '#F3F4F6', label: 'Cancelled' },
};

// ── LoanRow ──────────────────────────────────────────────────
function LoanRow({ loan, onRepay, onLiquidate, onCancel, onCounterRespond, currentUserId, ethPrice }) {
  const cfg        = STATUS_CONFIG[loan.status] || STATUS_CONFIG.pending;
  const isBorrower = String(loan.borrower?._id || loan.borrower) === currentUserId;
  const isActive   = loan.status === 'active';
  const isPending  = loan.status === 'pending';
  const isOverdue  = isActive && loan.dueDate && new Date() > new Date(loan.dueDate);

  // Price-triggered liquidation — from on-chain enriched data
  const onChainRatio        = loan.onChain ? Number(loan.onChain.collateralRatio ?? 0) : null;
  const isPriceLiquidatable = isActive && !isOverdue && onChainRatio !== null && onChainRatio < 120;
  const isLiquidatable      = isOverdue || isPriceLiquidatable;

  // Collateral ratio colour for badge
  const ratioColor = onChainRatio === null ? '#6B7280'
    : onChainRatio >= 150 ? '#00A878'
    : onChainRatio >= 120 ? '#E65100'
    : '#C62828';

  const interestPct = (loan.interestRateBps / 100).toFixed(1);
  const daysLeft    = loan.dueDate
    ? Math.max(0, Math.ceil((new Date(loan.dueDate) - Date.now()) / 86400000))
    : null;

  const sepolia = 'https://sepolia.etherscan.io/tx/';

  const fmtUsd = (eth) => ethPrice
    ? (eth * ethPrice).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
    : null;

  const principalUsd = fmtUsd(loan.principal);
  const totalRepaymentEth = loan.principal * (1 + loan.interestRateBps / 10000);
  const totalRepaymentUsd = fmtUsd(totalRepaymentEth);

  return (
    <div className="card" style={{ marginBottom: 16, borderLeft: `4px solid ${cfg.color}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>

        {/* ── Left: info ── */}
        <div style={{ flex: 1 }}>
          {/* Status row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{
              background: cfg.bg, color: cfg.color,
              borderRadius: 50, padding: '3px 10px', fontSize: 12, fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}>
              {cfg.icon} {cfg.label}
            </span>
            {/* Transaction type based on role and status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', fontSize: 12 }}>
              {isBorrower ? (
                <>
                  <span style={{ color: '#00373f', fontWeight: 600 }}>
                    📥 You received {principalUsd || `${loan.principal} ETH`}
                  </span>
                  {(loan.status === 'repaid' || loan.status === 'active') && (
                    <>
                      <span style={{ color: '#8a7e80' }}>•</span>
                      <span style={{ color: '#815249', fontWeight: 600 }}>
                        📤 You sent {totalRepaymentUsd || `${totalRepaymentEth.toFixed(6)} ETH`}
                      </span>
                    </>
                  )}
                </>
              ) : (
                <>
                  <span style={{ color: '#815249', fontWeight: 600 }}>
                    📤 You sent {principalUsd || `${loan.principal} ETH`}
                  </span>
                  {(loan.status === 'repaid') && (
                    <>
                      <span style={{ color: '#8a7e80' }}>•</span>
                      <span style={{ color: '#00373f', fontWeight: 600 }}>
                        📥 You received {totalRepaymentUsd || `${totalRepaymentEth.toFixed(6)} ETH`}
                      </span>
                    </>
                  )}
                </>
              )}
            </div>
            {isOverdue && (
              <span style={{ background: '#fde8e8', color: '#ba1a1a', borderRadius: 50, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>
                ⚠️ Overdue
              </span>
            )}
            {isPriceLiquidatable && (
              <span style={{ background: '#FFEBEE', color: '#C62828', borderRadius: 50, padding: '3px 10px', fontSize: 12, fontWeight: 700,
                display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Zap size={11} /> Price Drop — Undercollateralised
              </span>
            )}
            {/* Live collateral ratio badge for active loans */}
            {isActive && onChainRatio !== null && (
              <span style={{ background: `${ratioColor}18`, color: ratioColor, borderRadius: 50, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>
                Ratio: {onChainRatio}%
              </span>
            )}
          </div>

          {/* ── Counter-Offer Banner (borrower view) ── */}
          {isBorrower && isPending && loan.counterOffer?.status === 'pending' && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(196,128,58,0.10), rgba(96,24,11,0.06))',
              border: '2px solid rgba(196,128,58,0.5)',
              borderRadius: 14, padding: '16px 18px', marginBottom: 14,
              display: 'flex', flexWrap: 'wrap', alignItems: 'center',
              justifyContent: 'space-between', gap: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1 }}>
                <div style={{
                  background: 'linear-gradient(135deg,#c4803a,#815249)',
                  borderRadius: 8, padding: 7, flexShrink: 0,
                }}>
                  <Percent size={16} color="white" />
                </div>
                <div>
                  <p style={{ fontWeight: 800, fontSize: 14, color: '#342f30', margin: '0 0 2px' }}>
                    💡 Lender Counter-Offer
                  </p>
                  <p style={{ fontSize: 13, color: '#815249', margin: 0, fontWeight: 600 }}>
                    Proposed rate: <strong style={{ fontSize: 16, color: '#60180b' }}>
                      {(loan.counterOffer.rateBps / 100).toFixed(2)}%
                    </strong>
                    <span style={{ fontSize: 12, color: '#8a7e80', marginLeft: 6 }}>
                      (your ask: {(loan.interestRateBps / 100).toFixed(2)}%)
                    </span>
                  </p>
                  {loan.counterOffer.message && (
                    <p style={{ fontSize: 12, color: '#8a7e80', marginTop: 4, fontStyle: 'italic' }}>
                      “{loan.counterOffer.message}”
                    </p>
                  )}
                  <p style={{ fontSize: 11, color: '#8a7e80', marginTop: 4 }}>
                    From {loan.counterOffer.byAddress
                      ? `${loan.counterOffer.byAddress.slice(0,6)}…${loan.counterOffer.byAddress.slice(-4)}`
                      : 'a lender'}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button
                  className="btn"
                  style={{ background: '#00373f', color: 'white', fontSize: 13, padding: '9px 18px' }}
                  onClick={() => onCounterRespond(loan, 'accept')}
                >
                  ✔ Accept
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: 13, padding: '9px 18px', color: '#ba1a1a', borderColor: '#ba1a1a' }}
                  onClick={() => onCounterRespond(loan, 'reject')}
                >
                  ✕ Reject
                </button>
              </div>
            </div>
          )}

          {/* Data grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '4px 24px', fontSize: 14 }}>
            <Info label="Principal"  value={principalUsd || `${loan.principal} ETH`} sub={`${loan.principal} ETH`} bold accent />
            <Info label="Rate"       value={`${interestPct}%`} />
            <Info label="Duration"   value={`${loan.durationDays} days`} />
            {daysLeft !== null && isActive && (
              <Info label="Days left" value={isOverdue ? '⚠️ OVERDUE' : `${daysLeft}d`}
                color={isOverdue ? '#C62828' : '#00A878'} />
            )}
            {loan.borrower?.name && !isBorrower && (
              <Info label="Borrower" value={loan.borrower.name} />
            )}
            {loan.lender?.name && isBorrower && loan.lender && (
              <Info label="Lender" value={loan.lender.name} />
            )}
          </div>

          {/* Tx hashes */}
          <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
            {loan.createTxHash && (
              <a href={`${sepolia}${loan.createTxHash}`} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 11, color: '#60180b', display: 'flex', alignItems: 'center', gap: 4 }}>
                <ExternalLink size={10} /> Create Tx
              </a>
            )}
            {loan.fundTxHash && (
              <a href={`${sepolia}${loan.fundTxHash}`} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 11, color: '#60180b', display: 'flex', alignItems: 'center', gap: 4 }}>
                <ExternalLink size={10} /> Fund Tx
              </a>
            )}
            {loan.repayTxHash && (
              <a href={`${sepolia}${loan.repayTxHash}`} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 11, color: '#00373f', display: 'flex', alignItems: 'center', gap: 4 }}>
                <ExternalLink size={10} /> Repay Tx
              </a>
            )}
            {loan.liquidateTxHash && (
              <a href={`${sepolia}${loan.liquidateTxHash}`} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 11, color: '#C62828', display: 'flex', alignItems: 'center', gap: 4 }}>
                <ExternalLink size={10} /> Liquidate Tx
              </a>
            )}
          </div>
        </div>

        {/* ── Right: actions ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 150 }}>
          {/* Repay — borrower on active loan */}
          {isBorrower && isActive && (
            <button className="btn btn-accent" style={{ fontSize: 13, padding: '10px 16px' }} onClick={() => onRepay(loan)}>
              ↩️ Repay Loan
            </button>
          )}

          {/* Liquidate — lender (or anyone) when overdue OR price-triggered */}
          {isLiquidatable && !isBorrower && (
            <button className="btn btn-danger" style={{ fontSize: 13, padding: '10px 16px' }} onClick={() => onLiquidate(loan)}>
              <Zap size={14} /> {isPriceLiquidatable ? 'Liquidate (Price)' : 'Liquidate (Overdue)'}
            </button>
          )}
          {/* Borrower can also trigger liquidation on overdue/price-drop */}
          {isLiquidatable && isBorrower && (
            <button className="btn btn-danger" style={{ fontSize: 13, padding: '10px 16px', opacity: 0.8 }} onClick={() => onLiquidate(loan)}>
              <Zap size={14} /> Trigger Liquidation
            </button>
          )}

          {/* Cancel — borrower on pending loan (not yet funded) */}
          {isPending && isBorrower && (
            <button className="btn btn-secondary" style={{ fontSize: 13, padding: '10px 16px', borderColor: '#C62828', color: '#C62828' }}
              onClick={() => onCancel(loan)}>
              ✕ Cancel & Recover
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value, sub, bold, accent, color }) {
  return (
    <div>
      <span style={{ fontSize: 11, color: '#8a7e80', display: 'block' }}>{label}</span>
      <span style={{ fontWeight: bold ? 700 : 500, color: color || (accent ? '#60180b' : '#342f30'), fontSize: 14 }}>{value}</span>
      {sub && <span style={{ fontSize: 11, color: '#8a7e80', display: 'block' }}>{sub}</span>}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────
export default function LoanHistory() {
  const navigate  = useNavigate();
  const wallet    = useWallet();
  const [loans,   setLoans]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState('all');
  const [userId,  setUserId]  = useState(null);
  const [ethPrice, setEthPrice] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('lendchain_token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUserId(payload.userId);
      } catch { /* ignore */ }
    }
    fetchLoans();

    // Fetch ETH price
    const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');
    fetch(`${API_BASE}/api/eth-price`)
      .then(r => r.json())
      .then(d => { if (d.success) setEthPrice(d.usd); })
      .catch(() => {});
  }, []);

  async function fetchLoans() {
    setLoading(true);
    try {
      const res = await getMyLoans();
      // For each active loan that has an onChainId, fetch single loan to get enriched on-chain ratio
      const rawLoans = res.data.loans || [];
      const enriched = await Promise.all(
        rawLoans.map(async (loan) => {
          if (loan.status === 'active' && loan.onChainId !== null) {
            try {
              const detail = await getLoan(loan._id);
              return detail.data.loan; // already has .onChain attached
            } catch {
              return loan;
            }
          }
          return loan;
        })
      );
      setLoans(enriched);
    } catch {
      toast.error('Failed to load your loans');
    } finally {
      setLoading(false);
    }
  }

  const filterBtns = ['all', 'pending', 'active', 'repaid', 'defaulted'];

  const displayed = useMemo(
    () => filter === 'all' ? loans : loans.filter(l => l.status === filter),
    [loans, filter]
  );

  const statusCounts = useMemo(() => {
    const c = {};
    filterBtns.forEach(f => { c[f] = f === 'all' ? loans.length : loans.filter(l => l.status === f).length; });
    return c;
  }, [loans]);

  // ── Repay ──────────────────────────────────────────────
  async function handleRepay(loan) {
    try {
      const hasOnChainId = loan.onChainId !== null && loan.onChainId !== undefined;

      if (hasOnChainId) {
        // ── On-chain collateral loan: call smart contract ──────────
        const addr = wallet.account || await wallet.connect();
        if (!addr) return;

        toast('Fetching exact repayment amount…', { icon: '🔗' });
        let totalOwedETH;
        try {
          const owedRes = await getLoanOwed(loan._id);
          totalOwedETH  = owedRes.data.totalOwedEth;
        } catch {
          const elapsedDays = loan.startDate
            ? (Date.now() - new Date(loan.startDate).getTime()) / 86400000
            : loan.durationDays;
          totalOwedETH = (loan.principal * (1 + (loan.interestRateBps / 10000 * elapsedDays / 365))).toFixed(8);
          toast('Using estimated repayment (chain unavailable)', { icon: '⚠️' });
        }

        toast(`Confirm repayment of ${Number(totalOwedETH).toFixed(6)} ETH in MetaMask`, { icon: '⛓️', duration: 6000 });
        const { txHash } = await wallet.callRepayLoan(loan.onChainId, totalOwedETH);

        toast('Updating records…', { icon: '💾' });
        await repayAPI(loan._id, { repayTxHash: txHash });
        toast.success('Loan repaid! Collateral returned to your wallet.');

      } else {
        // ── Guarantor loan: send ETH directly to lender's wallet ──
        const lenderAddr = loan.lenderAddress;
        if (!lenderAddr) {
          return toast.error('Lender wallet address not found — cannot send repayment.');
        }

        const addr = wallet.account || await wallet.connect();
        if (!addr) return;

        // Charge interest for the FULL agreed duration (not just elapsed time).
        // Borrower agreed to the loan term upfront — they owe the full term's interest.
        const principal      = Number(loan.principal);
        const rateBps        = Number(loan.interestRateBps);
        const fullTermSecs   = Number(loan.durationDays) * 86400;
        const interest       = (principal * rateBps * fullTermSecs) / (10000 * 365 * 86400);
        const totalOwed      = principal + interest;

        // Also track actual elapsed for display only
        const elapsedSecs    = loan.startDate
          ? (Date.now() - new Date(loan.startDate).getTime()) / 1000
          : fullTermSecs;
        const maxInterest    = interest; // same — full term IS the max

        // Fetch ETH price for USD display
        let ethPrice = null;
        try {
          const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');
          const r = await fetch(`${API_BASE}/api/eth-price`);
          const d = await r.json();
          if (d.success) ethPrice = d.usd;
        } catch { /* non-fatal */ }

        const fmt = (eth) => {
          if (eth === 0) return '0 ETH';
          if (eth < 0.000001) return `${(eth * 1e8).toFixed(4)} × 10⁻⁸ ETH`;
          if (eth < 0.0001)   return `${eth.toFixed(8)} ETH`;
          return `${eth.toFixed(6)} ETH`;
        };
        const usdFmt = (eth) => ethPrice
          ? ` (~$${(eth * ethPrice).toFixed(4)})`
          : '';

        const totalOwedETH = totalOwed.toFixed(18).replace(/\.?0+$/, '') || String(totalOwed);

        // Show proper modal instead of toast
        const confirmed = await new Promise((resolve) => {
          const overlay = document.createElement('div');
          overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);display:flex;align-items:center;justify-content:center;z-index:9999;padding:24px';
          overlay.innerHTML = `
            <div style="background:white;border-radius:20px;padding:28px;max-width:400px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.3)">
              <h2 style="margin:0 0 6px;font-size:20px;font-weight:800;color:#342f30">Confirm Repayment</h2>
              <p style="margin:0 0 20px;font-size:13px;color:#8a7e80">Sending ETH directly to lender's wallet</p>

              <div style="display:grid;gap:10px;margin-bottom:20px">
                <div style="background:#fef2f0;border-radius:12px;padding:14px">
                  <div style="font-size:11px;color:#8a7e80;margin-bottom:4px">Principal</div>
                  <div style="font-weight:700;color:#60180b;font-size:16px">${fmt(principal)}</div>
                  <div style="font-size:11px;color:#8a7e80">${usdFmt(principal)}</div>
                </div>
                <div style="background:#fef2f0;border-radius:12px;padding:14px">
                  <div style="font-size:11px;color:#8a7e80;margin-bottom:4px">
                    Interest (${(rateBps / 100).toFixed(1)}%/yr × ${loan.durationDays} days agreed term)
                  </div>
                  <div style="font-weight:700;color:#815249;font-size:15px">${fmt(interest)}</div>
                  <div style="font-size:11px;color:#8a7e80">${usdFmt(interest)}</div>
                </div>
                <div style="background:#e6f0ef;border-radius:12px;padding:14px;border:2px solid #00373f">
                  <div style="font-size:11px;color:#00373f;margin-bottom:4px;font-weight:600">TOTAL YOU SEND</div>
                  <div style="font-weight:800;color:#00373f;font-size:18px">${fmt(totalOwed)}</div>
                  <div style="font-size:11px;color:#8a7e80">${usdFmt(totalOwed)} → ${lenderAddr.slice(0,6)}…${lenderAddr.slice(-4)}</div>
                </div>
              </div>

              <div style="display:flex;gap:10px">
                <button id="lc-cancel-repay" style="flex:1;padding:12px;border-radius:50px;border:1px solid #E5E7EB;background:white;color:#342f30;font-weight:600;cursor:pointer;font-size:14px">Cancel</button>
                <button id="lc-confirm-repay" style="flex:1;padding:12px;border-radius:50px;border:none;background:#60180b;color:white;font-weight:700;cursor:pointer;font-size:14px">Confirm & Send</button>
              </div>
            </div>`;
          document.body.appendChild(overlay);
          document.getElementById('lc-confirm-repay').onclick = () => { document.body.removeChild(overlay); resolve(true); };
          document.getElementById('lc-cancel-repay').onclick  = () => { document.body.removeChild(overlay); resolve(false); };
        });
        if (!confirmed) return;

        toast(`Sending ${Number(totalOwedETH).toFixed(6)} ETH to lender via MetaMask…`, { icon: '💸', duration: 8000 });
        const txHash = await wallet.sendEthDirect(lenderAddr, totalOwedETH);

        toast('Updating records…', { icon: '💾' });
        await repayAPI(loan._id, { repayTxHash: txHash });
        toast.success('Repayment sent to lender! Loan marked as repaid.');
      }

      fetchLoans();
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || 'Repayment failed');
    }
  }

  // ── Liquidate ──────────────────────────────────────────
  async function handleLiquidate(loan) {
    const confirmed = await new Promise((resolve) => {
      toast(
        (t) => (
          <span>
            Liquidate this loan? Collateral goes to lender.{' '}
            <button onClick={() => { toast.dismiss(t.id); resolve(true); }}
              style={{ marginLeft: 8, background: '#ba1a1a', color: 'white', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontWeight: 700 }}>
              Confirm
            </button>
            <button onClick={() => { toast.dismiss(t.id); resolve(false); }}
              style={{ marginLeft: 4, background: '#E5E7EB', color: '#342f30', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>
              Cancel
            </button>
          </span>
        ),
        { duration: 10000 }
      );
    });
    if (!confirmed) return;

    try {
      const addr = wallet.account || await wallet.connect();
      if (!addr) return;

      toast('Triggering liquidation via MetaMask…', { icon: '⛓️', duration: 6000 });
      const { txHash } = await wallet.callLiquidateLoanIfNeeded(loan.onChainId);

      toast('Updating records…', { icon: '💾' });
      await liquidateAPI(loan._id, { liquidateTxHash: txHash });

      toast.success('Loan liquidated! Collateral sent to lender.');
      fetchLoans();
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || 'Liquidation failed');
    }
  }

  // ── Counter-Offer Respond (Accept / Reject) ──────────────────────
  async function handleCounterRespond(loan, action) {
    const isAccept = action === 'accept';
    const counterPct = (loan.counterOffer.rateBps / 100).toFixed(2);
    const originalPct = (loan.interestRateBps / 100).toFixed(2);

    const confirmed = await new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);display:flex;align-items:center;justify-content:center;z-index:9999;padding:24px';
      overlay.innerHTML = `
        <div style="background:white;border-radius:20px;padding:28px;max-width:400px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.3)">
          <h2 style="margin:0 0 8px;font-size:20px;font-weight:800;color:#342f30">
            ${
              isAccept
                ? '✔ Accept Counter-Offer?'
                : '✕ Reject Counter-Offer?'
            }
          </h2>
          <p style="font-size:13px;color:#8a7e80;margin:0 0 20px">
            ${isAccept
              ? `Your loan rate will change from <strong>${originalPct}%</strong> to <strong style="color:#00373f">${counterPct}%</strong>. The lender can then fund at this rate.`
              : `The counter-offer of ${counterPct}% will be dismissed. Your original rate of ${originalPct}% remains.`
            }
          </p>
          <div style="display:flex;gap:10px">
            <button id="lc-dismiss" style="flex:1;padding:12px;border-radius:50px;border:1px solid #E5E7EB;background:white;color:#342f30;font-weight:600;cursor:pointer;font-size:14px">Cancel</button>
            <button id="lc-confirm" style="flex:1;padding:12px;border-radius:50px;border:none;background:${isAccept ? '#00373f' : '#ba1a1a'};color:white;font-weight:700;cursor:pointer;font-size:14px">
              ${isAccept ? 'Yes, Accept' : 'Yes, Reject'}
            </button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      document.getElementById('lc-confirm').onclick = () => { document.body.removeChild(overlay); resolve(true); };
      document.getElementById('lc-dismiss').onclick  = () => { document.body.removeChild(overlay); resolve(false); };
    });
    if (!confirmed) return;

    try {
      const res = await respondToCounter(loan._id, { action });
      toast.success(res.data.message || (isAccept ? 'Counter-offer accepted!' : 'Counter-offer rejected.'), { duration: 5000 });
      fetchLoans();
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || 'Failed to respond');
    }
  }

  // ── Cancel ─────────────────────────────────────────────
  async function handleCancel(loan) {
    const confirmed = await new Promise((resolve) => {
      toast(
        (t) => (
          <span>
            Cancel loan and recover your collateral?{' '}
            <button onClick={() => { toast.dismiss(t.id); resolve(true); }}
              style={{ marginLeft: 8, background: '#6B4EFF', color: 'white', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontWeight: 700 }}>
              Confirm
            </button>
            <button onClick={() => { toast.dismiss(t.id); resolve(false); }}
              style={{ marginLeft: 4, background: '#E5E7EB', color: '#374151', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>
              Keep
            </button>
          </span>
        ),
        { duration: 10000 }
      );
    });
    if (!confirmed) return;

    try {
      const addr = wallet.account || await wallet.connect();
      if (!addr) return;

      // onChainId of 0 is valid (first loan) — use explicit null/undefined check
      const hasOnChainId = loan.onChainId !== null && loan.onChainId !== undefined;

      if (hasOnChainId) {
        toast('Cancelling on-chain via MetaMask…', { icon: '⛓️', duration: 6000 });
        try {
          await wallet.callCancelLoan(loan.onChainId);
          toast('Updating records…', { icon: '💾' });
          await cancelAPI(loan._id);
          toast.success('Loan cancelled! Collateral returned to your wallet.');
        } catch (chainErr) {
          // If the contract says "not pending" the loan was already cancelled on-chain
          // (e.g. double-click, or prior partial success). Sync DB and move on.
          const msg = chainErr?.message || '';
          const alreadyDone = msg.includes('Can only cancel pending') ||
                              msg.includes('Loan does not exist') ||
                              msg.includes('CALL_EXCEPTION');
          if (alreadyDone) {
            toast('Loan already cancelled on-chain — syncing records…', { icon: '🔄' });
            try { await cancelAPI(loan._id); } catch { /* DB may already be cancelled */ }
            toast.success('Loan cancelled.');
          } else {
            throw chainErr; // re-throw unexpected errors
          }
        }
      } else {
        // No on-chain ID — loan never mined, only in DB
        await cancelAPI(loan._id);
        toast.success('Loan request cancelled.');
      }
      fetchLoans();
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || 'Cancel failed');
    }
  }

  return (
    <div className="page-dashboard" style={{ background: '#F5F3FF' }}>
      {/* Topbar */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 64,
        background: 'white', boxShadow: '0 2px 16px rgba(45,27,105,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 32px', zIndex: 100,
      }}>
        <button onClick={() => navigate('/dashboard')} className="btn btn-ghost" style={{ padding: '8px 12px', fontSize: 14 }}>
          <ArrowLeft size={16} /> Dashboard
        </button>
        <h1 style={{ fontWeight: 800, fontSize: 18, color: '#342f30' }}>My Loan History</h1>
        <button onClick={fetchLoans} className="btn btn-ghost" style={{ padding: '8px 12px' }}>
          <RefreshCw size={16} />
        </button>
      </div>

      <div style={{ paddingTop: 80, padding: '96px 32px 32px', maxWidth: 900, margin: '0 auto' }}>
        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          {filterBtns.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '8px 16px', borderRadius: 50, fontSize: 13, fontWeight: 600,
                background: filter === f ? '#60180b' : 'white',
                color: filter === f ? 'white' : '#8a7e80',
                border: `1px solid ${filter === f ? '#60180b' : '#E5E7EB'}`,
                cursor: 'pointer', transition: 'all 0.2s',
                textTransform: 'capitalize',
              }}
            >
              {f === 'all' ? `All (${loans.length})` : `${f} (${statusCounts[f]})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div>{[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 160, borderRadius: 20, marginBottom: 16 }} />)}</div>
        ) : displayed.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#9CA3AF', paddingTop: 60 }}>
            <Clock size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
            <p style={{ fontSize: 18, fontWeight: 600 }}>No loans found</p>
            <p style={{ fontSize: 14, marginTop: 8 }}>
              {filter === 'all' ? 'Go borrow or lend to get started!' : `No ${filter} loans`}
            </p>
          </div>
        ) : (
          displayed.map(loan => (
            <LoanRow
              key={loan._id}
              loan={loan}
              onRepay={handleRepay}
              onLiquidate={handleLiquidate}
              onCancel={handleCancel}
              onCounterRespond={handleCounterRespond}
              currentUserId={userId}
              ethPrice={ethPrice}
            />
          ))
        )}
      </div>
    </div>
  );
}
