import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Wallet, TrendingUp, Shield, Clock, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { useWallet } from '../hooks/useWallet';
import { getAvailable, fundLoan as fundLoanAPI } from '../api/loanApi';
import { useAuth } from '../context/AuthContext';

const STATUS_COLORS = {
  safe: { bg: '#E6FFF7', color: '#00A878', label: '✅ Safe' },
  warn: { bg: '#FFF3E0', color: '#E65100', label: '⚠️ Medium' },
  risk: { bg: '#FFEBEE', color: '#C62828', label: '❌ Risky' },
};

function getRiskLevel(riskScore) {
  if (riskScore >= 75) return STATUS_COLORS.safe;
  if (riskScore >= 50) return STATUS_COLORS.warn;
  return STATUS_COLORS.risk;
}

function LoanCard({ loan, onFund }) {
  const riskLevel = getRiskLevel(loan.riskScore);
  const interestPct = (loan.interestRateBps / 100).toFixed(1);
  const ratio = loan.collateralRatio || ((loan.collateral / loan.principal) * 100).toFixed(0);
  const profit = (loan.principal * loan.interestRateBps / 10000 * loan.durationDays / 365).toFixed(6);

  return (
    <div className="card" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Risk badge */}
      <div style={{
        position: 'absolute', top: 16, right: 16,
        background: riskLevel.bg, color: riskLevel.color,
        borderRadius: 50, padding: '4px 12px', fontSize: 12, fontWeight: 700,
      }}>
        {riskLevel.label}
      </div>

      {/* Borrower */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #6B4EFF, #FF8C69)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700,
        }}>
          {loan.borrower?.name?.charAt(0).toUpperCase() || 'B'}
        </div>
        <div>
          <p style={{ fontWeight: 700, fontSize: 15 }}>{loan.borrower?.name || 'Borrower'}</p>
          <p style={{ fontSize: 12, color: '#6B7280' }}>
            {loan.borrowerAddress?.slice(0, 6)}…{loan.borrowerAddress?.slice(-4)}
          </p>
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <Stat icon={<TrendingUp size={14} color="#6B4EFF" />} label="Loan Amount" value={`${loan.principal} ETH`} accent />
        <Stat icon={<Shield size={14} color="#00C896" />}     label="Collateral"  value={`${loan.collateral} ETH`} />
        <Stat icon={<div style={{ fontSize: 12 }}>%</div>}   label="Collateral Ratio" value={`${Number(ratio).toFixed(0)}%`}
          color={Number(ratio) >= 150 ? '#00A878' : '#FF4D4D'} />
        <Stat icon={<Clock size={14} color="#FFB547" />}     label="Duration"    value={`${loan.durationDays} days`} />
      </div>

      {/* Interest + profit */}
      <div style={{
        background: 'linear-gradient(135deg, #F5F3FF, #EEE6FF)',
        borderRadius: 12, padding: '12px 14px', marginBottom: 16,
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
      }}>
        <div>
          <p style={{ fontSize: 11, color: '#6B7280' }}>Annual Rate</p>
          <p style={{ fontWeight: 700, color: '#6B4EFF', fontSize: 16 }}>{interestPct}%</p>
        </div>
        <div>
          <p style={{ fontSize: 11, color: '#6B7280' }}>You earn ~</p>
          <p style={{ fontWeight: 700, color: '#00A878', fontSize: 16 }}>{profit} ETH</p>
        </div>
      </div>

      {/* Risk score bar */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
          <span style={{ color: '#6B7280' }}>Borrower Risk Score</span>
          <span style={{ fontWeight: 700, color: riskLevel.color }}>{loan.riskScore}/100</span>
        </div>
        <div style={{ height: 6, background: '#E5E7EB', borderRadius: 99 }}>
          <div style={{
            height: '100%', width: `${loan.riskScore}%`,
            background: `linear-gradient(90deg, #FF4D4D, #FFB547, #00C896)`,
            backgroundSize: '100px 100%',
            backgroundPosition: `${100 - loan.riskScore}% 0`,
            borderRadius: 99, transition: 'width 1s ease',
          }} />
        </div>
      </div>

      <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => onFund(loan)}>
        <Wallet size={16} /> Fund This Loan
      </button>
    </div>
  );
}

function Stat({ icon, label, value, accent, color }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
        {icon}
        <span style={{ fontSize: 11, color: '#6B7280' }}>{label}</span>
      </div>
      <p style={{ fontWeight: 700, fontSize: 15, color: color || (accent ? '#6B4EFF' : '#1A1040') }}>{value}</p>
    </div>
  );
}

// ── Funding confirmation modal ─────────────────────────
function FundModal({ loan, wallet, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const interestPct = (loan.interestRateBps / 100).toFixed(1);
  const profit      = (loan.principal * loan.interestRateBps / 10000 * loan.durationDays / 365).toFixed(6);
  const totalReturn = (Number(loan.principal) + Number(profit)).toFixed(6);

  async function handleFund() {
    setLoading(true);
    try {
      const addr = wallet.account || await wallet.connect();
      if (!addr) { setLoading(false); return; }

      toast('Sending ETH to smart contract via MetaMask…', { icon: '⛓️' });
      const { txHash } = await wallet.callFundLoan(loan.onChainId, loan.principal);

      toast('Updating database…', { icon: '💾' });
      await fundLoanAPI(loan._id, { lenderAddress: addr, fundTxHash: txHash });

      toast.success('Loan funded! Borrower has received their ETH.', { duration: 5000 });
      onSuccess();
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || err.message || 'Funding failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 999, padding: 24,
    }}>
      <div className="auth-card" style={{ maxWidth: 440, margin: 0 }}>
        <h2 className="auth-title" style={{ marginBottom: 8 }}>Confirm Lending</h2>
        <p className="auth-subtitle" style={{ marginBottom: 24 }}>
          You're about to send <strong>{loan.principal} ETH</strong> to the smart contract.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
          {[
            ['You send', `${loan.principal} ETH`, '#6B4EFF'],
            ['Borrower gets', `${loan.principal} ETH`, '#2D1B69'],
            [`Interest earned (${interestPct}%/yr)`, `~${profit} ETH`, '#00A878'],
            ['You receive back', `~${totalReturn} ETH`, '#00A878'],
          ].map(([label, val, color]) => (
            <div key={label} style={{ background: '#F5F3FF', borderRadius: 12, padding: '12px 14px' }}>
              <p style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>{label}</p>
              <p style={{ fontWeight: 700, color, fontSize: 15 }}>{val}</p>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleFund} disabled={loading}>
            {loading
              ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'white', borderColor: 'rgba(255,255,255,0.3)' }} /> Processing…</>
              : <><Wallet size={16} /> Confirm & Fund</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────
export default function Lend() {
  const navigate   = useNavigate();
  const { user }   = useAuth();
  const wallet     = useWallet();
  const [loans,    setLoans]    = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading,  setLoading]  = useState(true);

  async function fetchLoans() {
    setLoading(true);
    try {
      const res = await getAvailable();
      setLoans(res.data.loans || []);
    } catch {
      toast.error('Failed to load loans');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchLoans(); }, []);

  return (
    <div className="page-dashboard" style={{ background: '#0f0c29' }}>
      {/* Simple topbar */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 64,
        background: 'rgba(26,16,64,0.9)', backdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 32px', zIndex: 100, borderBottom: '1px solid rgba(107,78,255,0.2)',
      }}>
        <button onClick={() => navigate('/dashboard')} className="btn btn-ghost" style={{ padding: '8px 12px', fontSize: 14, color: 'white' }}>
          <ArrowLeft size={16} /> Dashboard
        </button>
        <h1 style={{ color: 'white', fontWeight: 800, fontSize: 18 }}>Loan Marketplace</h1>
        <button onClick={fetchLoans} className="btn btn-ghost" style={{ padding: '8px 12px', color: 'white' }}>
          <RefreshCw size={16} />
        </button>
      </div>

      <div style={{ paddingTop: 80, padding: '96px 32px 32px' }}>
        <p style={{ color: '#C4B5FD', marginBottom: 32, fontSize: 15 }}>
          Browse borrower requests. All collateral is locked on-chain — your funds are protected.
        </p>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24 }}>
            {[1,2,3].map(i => (
              <div key={i} className="skeleton" style={{ height: 380, borderRadius: 20 }} />
            ))}
          </div>
        ) : loans.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#C4B5FD', paddingTop: 80 }}>
            <TrendingUp size={48} style={{ marginBottom: 16, opacity: 0.4 }} />
            <p style={{ fontSize: 18, fontWeight: 600 }}>No pending loan requests right now</p>
            <p style={{ fontSize: 14, marginTop: 8 }}>Check back soon or be the first borrower!</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24 }}>
            {loans.map(loan => (
              <LoanCard key={loan._id} loan={loan} onFund={setSelected} />
            ))}
          </div>
        )}
      </div>

      {selected && (
        <FundModal
          loan={selected}
          wallet={wallet}
          onClose={() => setSelected(null)}
          onSuccess={() => { setSelected(null); fetchLoans(); }}
        />
      )}
    </div>
  );
}
