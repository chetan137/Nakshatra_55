import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Wallet, TrendingUp, Shield, Clock, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { useWallet } from '../hooks/useWallet';
import { getAvailable, fundLoan as fundLoanAPI } from '../api/loanApi';
import { useAuth } from '../context/AuthContext';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');

const STATUS_COLORS = {
  safe: { bg: '#e6f0ef', color: '#00373f', label: '✅ Safe' },
  warn: { bg: '#fef2f0', color: '#815249', label: '⚠️ Medium' },
  risk: { bg: '#fde8e8', color: '#ba1a1a', label: '❌ Risky' },
};

function getRiskLevel(riskScore) {
  if (riskScore >= 75) return STATUS_COLORS.safe;
  if (riskScore >= 50) return STATUS_COLORS.warn;
  return STATUS_COLORS.risk;
}

function usd(eth, price) {
  if (!price || !eth) return null;
  return (eth * price).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
}

function LoanCard({ loan, onFund, ethPrice }) {
  const riskLevel = getRiskLevel(loan.riskScore);
  const interestPct = (loan.interestRateBps / 100).toFixed(1);
  const ratio = loan.collateralRatio || ((loan.collateral / loan.principal) * 100).toFixed(0);
  const profit = loan.principal * loan.interestRateBps / 10000 * loan.durationDays / 365;

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
          width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #60180b, #815249)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700,
          flexShrink: 0,
        }}>
          {loan.borrower?.name?.charAt(0).toUpperCase() || 'B'}
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 700, fontSize: 15, margin: 0 }}>
            {loan.borrower?.name || 'Borrower'}
            <span style={{ fontSize: 10, color: '#8a7e80', background: '#f5e8e5', padding: '2px 6px', borderRadius: 4, marginLeft: 6 }}>Borrower</span>
          </p>
          <p style={{ fontSize: 12, color: '#8a7e80', margin: '2px 0 0', fontFamily: 'monospace' }}>
            {loan.borrowerAddress?.slice(0, 6)}…{loan.borrowerAddress?.slice(-4)}
          </p>
        </div>
      </div>

      {/* Guarantor Info (if non-collateral) */}
      {loan.guarantorRequest && (
        <div style={{ background: 'rgba(0,55,63,0.04)', borderRadius: 12, padding: '12px', marginBottom: 16, border: '1px solid rgba(0,55,63,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Shield size={14} color="#00373f" />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#00373f' }}>Guarantor Backed ({loan.guarantorRequest.status})</span>
            </div>
            <span style={{ fontSize: 11, color: '#8a7e80', fontFamily: 'monospace' }}>
              {loan.guarantorAddress?.slice(0, 6)}…{loan.guarantorAddress?.slice(-4)}
            </span>
          </div>

          {loan.guarantorRequest.documentUrl ? (
            <a href={loan.guarantorRequest.documentUrl} target="_blank" rel="noreferrer" style={{
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#60180b', fontWeight: 600,
              textDecoration: 'none', background: 'white', padding: '6px 10px', borderRadius: 6, width: 'fit-content',
              border: '1px solid rgba(96,24,11,0.2)', transition: 'border 0.2s',
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#60180b'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(96,24,11,0.2)'}
            >
              📄 View Verifiable Document
            </a>
          ) : (
            <span style={{ fontSize: 11, color: '#ba1a1a', fontStyle: 'italic', background: 'white', padding: '2px 6px', borderRadius: 4 }}>
              No document uploaded
            </span>
          )}
        </div>
      )}

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <Stat icon={<TrendingUp size={14} color="#60180b" />} label="Loan Amount"
          value={`${loan.principal} ETH`}
          sub={usd(loan.principal, ethPrice)}
          accent />
        <Stat icon={<Shield size={14} color="#00373f" />} label="Collateral"
          value={`${loan.collateral} ETH`}
          sub={usd(loan.collateral, ethPrice)} />
        <Stat icon={<Clock size={14} color="#c4803a" />} label="Duration"
          value={`${loan.durationDays} days`} />
      </div>

      {/* Interest + profit */}
      <div style={{
        background: 'linear-gradient(135deg, #fef2f0, #f5e8e5)',
        borderRadius: 12, padding: '12px 14px', marginBottom: 16,
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
      }}>
        <div>
          <p style={{ fontSize: 11, color: '#8a7e80' }}>Annual Rate</p>
          <p style={{ fontWeight: 700, color: '#60180b', fontSize: 16 }}>{interestPct}%</p>
        </div>
        <div>
          <p style={{ fontSize: 11, color: '#8a7e80' }}>You earn ~</p>
          <p style={{ fontWeight: 700, color: '#00373f', fontSize: 16 }}>{profit.toFixed(6)} ETH</p>
          {ethPrice && (
            <p style={{ fontSize: 11, color: '#8a7e80' }}>{usd(profit, ethPrice)}</p>
          )}
        </div>
      </div>

      {/* Risk score bar */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
          <span style={{ color: '#8a7e80' }}>Borrower Risk Score</span>
          <span style={{ fontWeight: 700, color: riskLevel.color }}>{loan.riskScore}/100</span>
        </div>
        <div style={{ height: 6, background: '#E5E7EB', borderRadius: 99 }}>
          <div style={{
            height: '100%', width: `${loan.riskScore}%`,
            background: `linear-gradient(90deg, #ba1a1a, #c4803a, #00373f)`,
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

function Stat({ icon, label, value, sub, accent, color }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
        {icon}
        <span style={{ fontSize: 11, color: '#8a7e80' }}>{label}</span>
      </div>
      <p style={{ fontWeight: 700, fontSize: 15, color: color || (accent ? '#60180b' : '#342f30'), margin: 0 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: '#8a7e80', margin: 0 }}>{sub}</p>}
    </div>
  );
}

// ── Funding confirmation modal ─────────────────────────
function FundModal({ loan, wallet, onClose, onSuccess, ethPrice }) {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const interestPct = (loan.interestRateBps / 100).toFixed(1);
  const profit = loan.principal * loan.interestRateBps / 10000 * loan.durationDays / 365;
  const totalReturn = Number(loan.principal) + profit;

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

  const rows = [
    ['You send', `${loan.principal} ETH`, usd(loan.principal, ethPrice), '#60180b'],
    ['Borrower gets', `${loan.principal} ETH`, usd(loan.principal, ethPrice), '#342f30'],
    [`Interest (${interestPct}%/yr)`, `~${profit.toFixed(6)} ETH`, usd(profit, ethPrice), '#00373f'],
    ['You receive back', `~${totalReturn.toFixed(6)} ETH`, usd(totalReturn, ethPrice), '#00373f'],
  ];

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 999, padding: 24,
    }}>
      <div className="auth-card" style={{ maxWidth: 440, margin: 0 }}>
        <h2 className="auth-title" style={{ marginBottom: 8 }}>Confirm Lending</h2>
        <p className="auth-subtitle" style={{ marginBottom: 24 }}>
          You're about to send <strong>{loan.principal} ETH</strong>
          {ethPrice && <> ({usd(loan.principal, ethPrice)})</>} to the smart contract.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
          {rows.map(([label, val, valUsd, color]) => (
            <div key={label} style={{ background: '#fef2f0', borderRadius: 12, padding: '12px 14px' }}>
              <p style={{ fontSize: 11, color: '#8a7e80', marginBottom: 4 }}>{label}</p>
              <p style={{ fontWeight: 700, color, fontSize: 15, margin: 0 }}>{val}</p>
              {valUsd && <p style={{ fontSize: 11, color: '#8a7e80', margin: 0 }}>{valUsd}</p>}
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
  const navigate = useNavigate();
  const { user } = useAuth();
  const wallet = useWallet();
  const [loans, setLoans] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ethPrice, setEthPrice] = useState(null);

  useEffect(() => {
    if (user?.role === 'borrower') {
      toast.error('Borrowers cannot fund loans.');
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    fetch(`${API_BASE}/api/eth-price`)
      .then(r => r.json())
      .then(d => { if (d.success) setEthPrice(d.usd); })
      .catch(() => { });
  }, []);

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
    <div className="page-dashboard" style={{ background: '#342f30' }}>
      {/* Simple topbar */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 64,
        background: 'rgba(52,47,48,0.9)', backdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 32px', zIndex: 100, borderBottom: '1px solid rgba(129,82,73,0.2)',
      }}>
        <button onClick={() => navigate('/dashboard')} className="btn btn-ghost" style={{ padding: '8px 12px', fontSize: 14, color: 'white' }}>
          <ArrowLeft size={16} /> Dashboard
        </button>
        <h1 style={{ color: 'white', fontWeight: 800, fontSize: 18 }}>Loan Marketplace</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {ethPrice && (
            <span style={{ fontSize: 12, color: '#FF8C69', fontWeight: 700 }}>
              ETH ${ethPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
          )}
          <button onClick={fetchLoans} className="btn btn-ghost" style={{ padding: '8px 12px', color: 'white' }}>
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      <div style={{ paddingTop: 80, padding: '96px 32px 32px' }}>
        <p style={{ color: '#d4b8b3', marginBottom: 32, fontSize: 15 }}>
          Browse borrower requests. All collateral is locked on-chain — your funds are protected.
        </p>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24 }}>
            {[1, 2, 3].map(i => (
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
              <LoanCard key={loan._id} loan={loan} onFund={setSelected} ethPrice={ethPrice} />
            ))}
          </div>
        )}
      </div>

      {selected && (
        <FundModal
          loan={selected}
          wallet={wallet}
          ethPrice={ethPrice}
          onClose={() => setSelected(null)}
          onSuccess={() => { setSelected(null); fetchLoans(); }}
        />
      )}
    </div>
  );
}
