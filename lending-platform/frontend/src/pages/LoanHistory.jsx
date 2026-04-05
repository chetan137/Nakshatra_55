import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, CheckCircle, AlertTriangle, XCircle, RefreshCw, ExternalLink, Zap, Percent } from 'lucide-react';
import toast from 'react-hot-toast';
import { getMyLoans, repayLoan as repayAPI, liquidateLoan as liquidateAPI, getLoanOwed, getLoan, cancelLoan as cancelAPI, respondToCounter } from '../api/loanApi';
import { useWallet } from '../hooks/useWallet';

const STATUS_CONFIG = {
  pending:   { icon: <Clock size={14} />,          color: '#d97706', bg: '#fef3c7', label: 'Pending',   glow: 'rgba(217,119,6,0.3)' },
  active:    { icon: <CheckCircle size={14} />,     color: '#059669', bg: '#d1fae5', label: 'Active',    glow: 'rgba(5,150,105,0.3)' },
  repaid:    { icon: <CheckCircle size={14} />,     color: '#4f46e5', bg: '#e0e7ff', label: 'Repaid',    glow: 'rgba(79,70,229,0.3)' },
  defaulted: { icon: <AlertTriangle size={14} />,   color: '#dc2626', bg: '#fee2e2', label: 'Defaulted', glow: 'rgba(220,38,38,0.3)' },
  cancelled: { icon: <XCircle size={14} />,         color: '#6b7280', bg: '#f3f4f6', label: 'Cancelled', glow: 'rgba(107,114,128,0.2)' },
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

  return (
    <div className="card" style={{
      marginBottom: 20,
      borderLeft: `5px solid ${cfg.color}`,
      borderRadius: '16px',
      padding: '24px',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
      background: 'white'
    }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 14px 28px ${cfg.glow}`; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.03)'; }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20 }}>

        {/* ── Left: info ── */}
        <div style={{ flex: 1 }}>
          {/* Status row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <span style={{
              background: cfg.bg, color: cfg.color,
              borderRadius: 50, padding: '6px 16px', fontSize: 16, fontWeight: 800,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              {cfg.icon} {cfg.label}
            </span>
            <span style={{ fontSize: 16, color: '#8a7e80', fontWeight: 600 }}>
              {isBorrower ? '📤 You borrowed' : '📥 You lent'}
            </span>
            {isOverdue && (
              <span style={{ background: '#fde8e8', color: '#ba1a1a', borderRadius: 50, padding: '6px 16px', fontSize: 15, fontWeight: 800 }}>
                ⚠️ Overdue
              </span>
            )}
            {isPriceLiquidatable && (
              <span style={{ background: '#FFEBEE', color: '#C62828', borderRadius: 50, padding: '6px 16px', fontSize: 15, fontWeight: 800,
                display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Zap size={14} /> Price Drop — Undercollateralised
              </span>
            )}
            {/* Live collateral ratio badge for active loans */}
            {isActive && onChainRatio !== null && (
              <span style={{ background: `${ratioColor}18`, color: ratioColor, borderRadius: 50, padding: '6px 16px', fontSize: 15, fontWeight: 800 }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '16px', fontSize: 14, marginTop: 12 }}>
            <Info label="Principal"  value={ethPrice ? `${(parseFloat(loan.principal) * ethPrice).toLocaleString('en-US', { style: 'currency', currency: 'USD' })} (${loan.principal} ETH)` : `${loan.principal} ETH`} bold accent />
            <Info label="Rate"       value={`${interestPct} %`} />
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 180 }}>
          {/* Repay — borrower on active loan */}
          {isBorrower && isActive && (
            <button className="btn btn-accent" style={{ fontSize: 15, padding: '12px 20px', fontWeight: 700 }} onClick={() => onRepay(loan)}>
              ↩️ Repay Loan
            </button>
          )}

          {/* Liquidate — lender (or anyone) when overdue OR price-triggered */}
          {isLiquidatable && !isBorrower && (
            <button className="btn btn-danger" style={{ fontSize: 15, padding: '12px 20px', fontWeight: 700 }} onClick={() => onLiquidate(loan)}>
              <Zap size={16} /> {isPriceLiquidatable ? 'Liquidate (Price)' : 'Liquidate (Overdue)'}
            </button>
          )}
          {/* Borrower can also trigger liquidation on overdue/price-drop */}
          {isLiquidatable && isBorrower && (
            <button className="btn btn-danger" style={{ fontSize: 15, padding: '12px 20px', opacity: 0.8, fontWeight: 700 }} onClick={() => onLiquidate(loan)}>
              <Zap size={16} /> Trigger Liquidation
            </button>
          )}

          {/* Cancel — borrower on pending loan (not yet funded) */}
          {isPending && isBorrower && (
            <button className="btn btn-secondary" style={{ fontSize: 15, padding: '12px 20px', borderColor: '#C62828', color: '#C62828', fontWeight: 700 }}
              onClick={() => onCancel(loan)}>
              ✕ Cancel & Recover
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value, bold, accent, color }) {
  return (
    <div style={{ background: '#f8fafc', padding: '16px 20px', borderRadius: '14px', border: '1px solid #f1f5f9' }}>
      <span style={{ fontSize: 13, color: '#64748b', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6, fontWeight: 700 }}>{label}</span>
      <span style={{ fontWeight: bold ? 800 : 700, color: color || (accent ? '#0f172a' : '#334155'), fontSize: 20 }}>{value}</span>
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
  const [ethPrice, setEthPrice] = useState(3000);

  useEffect(() => {
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd')
      .then(r => r.json())
      .then(d => { if (d?.ethereum?.usd) setEthPrice(d.ethereum.usd); })
      .catch(() => {});

    const token = localStorage.getItem('lendchain_token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUserId(payload.userId);
      } catch { /* ignore */ }
    }
    fetchLoans();
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
                    Interest (${(rateBps / 100).toFixed(1)}%  × ${loan.durationDays} days agreed term)
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
    <div className="page-dashboard" style={{ background: '#f8fafc', minHeight: '100vh' }}>
      {/* Topbar */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 72,
        background: 'rgba(255, 255, 255, 0.85)', backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(0,0,0,0.05)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 32px', zIndex: 100,
      }}>
        <button onClick={() => navigate('/dashboard')} className="btn btn-ghost" style={{ padding: '12px 20px', fontSize: 16, background: '#f1f5f9', borderRadius: 50, fontWeight: 700 }}>
          <ArrowLeft size={20} /> Dashboard
        </button>
        <h1 style={{ fontWeight: 800, fontSize: 26, color: '#0f172a', letterSpacing: '-0.5px' }}>My Loan History</h1>
        <button onClick={fetchLoans} className="btn btn-ghost" style={{ padding: '12px 16px', background: '#f1f5f9', borderRadius: 50 }}>
          <RefreshCw size={22} color="#0f172a" />
        </button>
      </div>

      <div style={{ paddingTop: 80, padding: '120px 40px 64px', maxWidth: 1100, margin: '0 auto' }}>
        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 40, flexWrap: 'wrap', background: 'white', padding: '8px', borderRadius: '20px', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
          {filterBtns.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                flex: 1, minWidth: '120px',
                padding: '16px 20px', borderRadius: 14, fontSize: 16, fontWeight: 800,
                background: filter === f ? '#0f172a' : 'transparent',
                color: filter === f ? 'white' : '#64748b',
                border: 'none',
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
