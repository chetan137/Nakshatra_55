import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, CheckCircle, AlertTriangle, XCircle, RefreshCw, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { getMyLoans, repayLoan as repayAPI, liquidateLoan as liquidateAPI, getLoanOwed } from '../api/loanApi';
import { useWallet } from '../hooks/useWallet';

const STATUS_CONFIG = {
  pending:   { icon: <Clock size={14} />,          color: '#E65100', bg: '#FFF3E0', label: 'Pending' },
  active:    { icon: <CheckCircle size={14} />,     color: '#00A878', bg: '#E6FFF7', label: 'Active' },
  repaid:    { icon: <CheckCircle size={14} />,     color: '#6B4EFF', bg: '#F5F3FF', label: 'Repaid' },
  defaulted: { icon: <AlertTriangle size={14} />,   color: '#C62828', bg: '#FFEBEE', label: 'Defaulted' },
  cancelled: { icon: <XCircle size={14} />,         color: '#6B7280', bg: '#F3F4F6', label: 'Cancelled' },
};

function LoanRow({ loan, onRepay, onLiquidate, currentUserId }) {
  const cfg = STATUS_CONFIG[loan.status] || STATUS_CONFIG.pending;
  const isBorrower = String(loan.borrower?._id || loan.borrower) === currentUserId;
  const isActive   = loan.status === 'active';
  const isOverdue  = isActive && loan.dueDate && new Date() > new Date(loan.dueDate);

  const interestPct = (loan.interestRateBps / 100).toFixed(1);
  const daysLeft    = loan.dueDate
    ? Math.max(0, Math.ceil((new Date(loan.dueDate) - Date.now()) / 86400000))
    : null;

  const sepolia = `https://sepolia.etherscan.io/tx/`;

  return (
    <div className="card" style={{ marginBottom: 16, borderLeft: `4px solid ${cfg.color}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        {/* Left info */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{
              background: cfg.bg, color: cfg.color,
              borderRadius: 50, padding: '3px 10px', fontSize: 12, fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}>
              {cfg.icon} {cfg.label}
            </span>
            <span style={{ fontSize: 12, color: '#6B7280' }}>
              {isBorrower ? '📤 You borrowed' : '📥 You lent'}
            </span>
            {isOverdue && (
              <span style={{ background: '#FFEBEE', color: '#C62828', borderRadius: 50, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>
                ⚠️ Overdue
              </span>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '4px 24px', fontSize: 14 }}>
            <Info label="Principal"    value={`${loan.principal} ETH`} bold accent />
            <Info label="Collateral"   value={`${loan.collateral} ETH`} />
            <Info label="Rate"         value={`${interestPct}%/yr`} />
            <Info label="Duration"     value={`${loan.durationDays} days`} />
            {daysLeft !== null && isActive && (
              <Info label="Days left" value={isOverdue ? '⚠️ OVERDUE' : `${daysLeft}d`} color={isOverdue ? '#C62828' : '#00A878'} />
            )}
            {loan.counterparty && (
              <Info label={isBorrower ? 'Lender' : 'Borrower'} value={loan.counterparty} />
            )}
          </div>

          {/* Tx hashes */}
          <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
            {loan.createTxHash && (
              <a href={`${sepolia}${loan.createTxHash}`} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 11, color: '#6B4EFF', display: 'flex', alignItems: 'center', gap: 4 }}>
                <ExternalLink size={10} /> Create Tx
              </a>
            )}
            {loan.fundTxHash && (
              <a href={`${sepolia}${loan.fundTxHash}`} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 11, color: '#6B4EFF', display: 'flex', alignItems: 'center', gap: 4 }}>
                <ExternalLink size={10} /> Fund Tx
              </a>
            )}
            {loan.repayTxHash && (
              <a href={`${sepolia}${loan.repayTxHash}`} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 11, color: '#00A878', display: 'flex', alignItems: 'center', gap: 4 }}>
                <ExternalLink size={10} /> Repay Tx
              </a>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 140 }}>
          {isBorrower && isActive && (
            <button className="btn btn-accent" style={{ fontSize: 13, padding: '10px 16px' }} onClick={() => onRepay(loan)}>
              ↩️ Repay Loan
            </button>
          )}
          {isOverdue && !isBorrower && (
            <button className="btn btn-danger" style={{ fontSize: 13, padding: '10px 16px' }} onClick={() => onLiquidate(loan)}>
              ⚡ Liquidate
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
      <span style={{ fontSize: 11, color: '#9CA3AF', display: 'block' }}>{label}</span>
      <span style={{ fontWeight: bold ? 700 : 500, color: color || (accent ? '#6B4EFF' : '#1A1040'), fontSize: 14 }}>{value}</span>
    </div>
  );
}

export default function LoanHistory() {
  const navigate = useNavigate();
  const wallet   = useWallet();
  const [loans,   setLoans]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState('all');

  // We stash the current userId from localStorage via token decode
  const [userId, setUserId] = useState(null);

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
      setLoans(res.data.loans || []);
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
      const addr = wallet.account || await wallet.connect();
      if (!addr) return;

      // Fetch live repayment amount from backend (which reads from chain)
      toast('Fetching exact repayment amount…', { icon: '🔗' });
      let totalOwedETH;
      try {
        const owedRes = await getLoanOwed(loan._id);
        totalOwedETH  = owedRes.data.totalOwedEth;
      } catch {
        // Fallback: calculate with elapsed time (less accurate)
        const elapsedDays = loan.startDate
          ? (Date.now() - new Date(loan.startDate).getTime()) / 86400000
          : loan.durationDays;
        totalOwedETH = (loan.principal * (1 + (loan.interestRateBps / 10000 * elapsedDays / 365))).toFixed(8);
        toast('Using estimated repayment amount (chain unavailable)', { icon: '⚠️' });
      }

      toast(`Confirm repayment of ${Number(totalOwedETH).toFixed(6)} ETH in MetaMask`, { icon: '⛓️', duration: 6000 });
      const { txHash } = await wallet.callRepayLoan(loan.onChainId, totalOwedETH);

      toast('Updating records…', { icon: '💾' });
      await repayAPI(loan._id, { repayTxHash: txHash });

      toast.success('Loan repaid! Collateral returned to your wallet.');
      fetchLoans();
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || 'Repayment failed');
    }
  }

  // ── Liquidate ──────────────────────────────────────────
  async function handleLiquidate(loan) {
    // Use toast confirmation instead of window.confirm
    const confirmed = await new Promise((resolve) => {
      toast(
        (t) => (
          <span>
            Liquidate this loan? Collateral goes to you.{' '}
            <button onClick={() => { toast.dismiss(t.id); resolve(true); }}
              style={{ marginLeft: 8, background: '#C62828', color: 'white', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontWeight: 700 }}>
              Confirm
            </button>
            <button onClick={() => { toast.dismiss(t.id); resolve(false); }}
              style={{ marginLeft: 4, background: '#E5E7EB', color: '#374151', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>
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

      toast.success('Loan liquidated! Collateral sent to your wallet.');
      fetchLoans();
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || 'Liquidation failed');
    }
  }

  return (
    <div className="page-dashboard" style={{ background: '#F5F3FF' }}>
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 64,
        background: 'white', boxShadow: '0 2px 16px rgba(45,27,105,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 32px', zIndex: 100,
      }}>
        <button onClick={() => navigate('/dashboard')} className="btn btn-ghost" style={{ padding: '8px 12px', fontSize: 14 }}>
          <ArrowLeft size={16} /> Dashboard
        </button>
        <h1 style={{ fontWeight: 800, fontSize: 18, color: '#1A1040' }}>My Loan History</h1>
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
                background: filter === f ? '#6B4EFF' : 'white',
                color: filter === f ? 'white' : '#6B7280',
                border: `1px solid ${filter === f ? '#6B4EFF' : '#E5E7EB'}`,
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
              currentUserId={userId}
            />
          ))
        )}
      </div>
    </div>
  );
}
