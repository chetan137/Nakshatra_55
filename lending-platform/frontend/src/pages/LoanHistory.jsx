import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, CheckCircle, AlertTriangle, XCircle, RefreshCw, ExternalLink, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { getMyLoans, repayLoan as repayAPI, liquidateLoan as liquidateAPI, getLoanOwed, getLoan, cancelLoan as cancelAPI } from '../api/loanApi';
import { useWallet } from '../hooks/useWallet';

const STATUS_CONFIG = {
  pending:   { icon: <Clock size={14} />,          color: '#815249', bg: '#fef2f0', label: 'Pending' },
  active:    { icon: <CheckCircle size={14} />,     color: '#00373f', bg: '#e6f0ef', label: 'Active' },
  repaid:    { icon: <CheckCircle size={14} />,     color: '#60180b', bg: '#f5e8e5', label: 'Repaid' },
  defaulted: { icon: <AlertTriangle size={14} />,   color: '#ba1a1a', bg: '#fde8e8', label: 'Defaulted' },
  cancelled: { icon: <XCircle size={14} />,         color: '#8a7e80', bg: '#F3F4F6', label: 'Cancelled' },
};

// ── LoanRow ──────────────────────────────────────────────────
function LoanRow({ loan, onRepay, onLiquidate, onCancel, currentUserId }) {
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
            <span style={{ fontSize: 12, color: '#8a7e80' }}>
              {isBorrower ? '📤 You borrowed' : '📥 You lent'}
            </span>
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

          {/* Data grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '4px 24px', fontSize: 14 }}>
            <Info label="Principal"  value={`${loan.principal} ETH`} bold accent />
            <Info label="Collateral" value={`${loan.collateral} ETH`} />
            <Info label="Rate"       value={`${interestPct}%/yr`} />
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

function Info({ label, value, bold, accent, color }) {
  return (
    <div>
      <span style={{ fontSize: 11, color: '#8a7e80', display: 'block' }}>{label}</span>
      <span style={{ fontWeight: bold ? 700 : 500, color: color || (accent ? '#60180b' : '#342f30'), fontSize: 14 }}>{value}</span>
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

  useEffect(() => {
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

        // Calculate owed: principal + simple interest
        const elapsedDays = loan.startDate
          ? (Date.now() - new Date(loan.startDate).getTime()) / 86400000
          : loan.durationDays;
        const totalOwedETH = (
          loan.principal * (1 + (loan.interestRateBps / 10000) * (elapsedDays / 365))
        ).toFixed(8);

        toast(
          `MetaMask will send ${Number(totalOwedETH).toFixed(6)} ETH directly to lender (${lenderAddr.slice(0,6)}…${lenderAddr.slice(-4)})`,
          { icon: '💸', duration: 6000 }
        );

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
              currentUserId={userId}
            />
          ))
        )}
      </div>
    </div>
  );
}
