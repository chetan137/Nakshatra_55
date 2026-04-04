import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Wallet, DollarSign, Clock, Percent, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import { useWallet } from '../hooks/useWallet';
import { createLoan } from '../api/loanApi';
import { useAuth } from '../context/AuthContext';

export default function Borrow() {
  const navigate   = useNavigate();
  const { user }   = useAuth();
  const wallet     = useWallet();

  const [form, setForm] = useState({
    principal:       '',
    collateral:      '',
    durationDays:    '30',
    interestRateBps: '1200',
  });
  const [loading, setLoading] = useState(false);
  const [step, setStep]       = useState('form'); // form | chain | backend | done

  const interestPercent = (Number(form.interestRateBps) / 100).toFixed(1);
  const collateralRatio = form.principal && form.collateral
    ? ((Number(form.collateral) / Number(form.principal)) * 100).toFixed(0)
    : null;
  const ratioSafe = collateralRatio ? Number(collateralRatio) >= 150 : null;
  const estimatedInterest = form.principal && form.durationDays
    ? (Number(form.principal) * (Number(form.interestRateBps) / 10000) * (Number(form.durationDays) / 365)).toFixed(6)
    : null;
  const totalRepay = estimatedInterest
    ? (Number(form.principal) + Number(estimatedInterest)).toFixed(6)
    : null;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.principal || !form.collateral || !form.durationDays) {
      return toast.error('Fill in all fields');
    }
    if (!ratioSafe) {
      return toast.error('Collateral must be ≥ 150% of principal');
    }

    setLoading(true);
    try {
      // Step 1: Connect wallet
      toast('Step 1/3 — Connecting wallet…', { icon: '🦊' });
      const addr = wallet.account || await wallet.connect();
      if (!addr) { setLoading(false); return; }

      // Step 2: Send tx to blockchain
      setStep('chain');
      toast('Step 2/3 — Sending to blockchain (MetaMask will open)…', { icon: '⛓️' });
      const { onChainId, txHash } = await wallet.callCreateLoan(
        form.principal,
        form.collateral,
        form.durationDays,
        form.interestRateBps
      );

      // Step 3: Register in backend
      setStep('backend');
      toast('Step 3/3 — Saving to database…', { icon: '💾' });
      await createLoan({
        onChainId,
        createTxHash:    txHash,
        borrowerAddress: addr,
        principal:       Number(form.principal),
        collateral:      Number(form.collateral),
        interestRateBps: Number(form.interestRateBps),
        durationDays:    Number(form.durationDays),
      });

      setStep('done');
      toast.success('Loan request created! Waiting for a lender.', { duration: 5000 });
      setTimeout(() => navigate('/dashboard'), 2000);
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || err.message || 'Transaction failed');
      setStep('form');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-auth" style={{ background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)' }}>
      <div className="auth-card" style={{ maxWidth: 520 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <button
            onClick={() => navigate('/dashboard')}
            className="btn btn-ghost"
            style={{ padding: '8px 12px', fontSize: 14, borderRadius: 10 }}
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="auth-title" style={{ textAlign: 'left', marginBottom: 2 }}>Request a Loan</h1>
            <p className="auth-subtitle" style={{ textAlign: 'left' }}>Deposit collateral → get ETH instantly</p>
          </div>
        </div>

        {/* Wallet pill */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: wallet.account ? '#E6FFF7' : '#FFF3E0',
          border: `1px solid ${wallet.account ? '#00C896' : '#FFB547'}`,
          borderRadius: 12, padding: '10px 14px', marginBottom: 24,
        }}>
          <Wallet size={16} color={wallet.account ? '#00A878' : '#E65100'} />
          <span style={{ fontSize: 13, fontWeight: 600, color: wallet.account ? '#00A878' : '#E65100' }}>
            {wallet.account
              ? `${wallet.account.slice(0, 6)}…${wallet.account.slice(-4)}`
              : 'Wallet not connected'}
          </span>
          {!wallet.account && (
            <button
              onClick={wallet.connect}
              disabled={wallet.connecting}
              style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, background: '#FF8C69', color: 'white', border: 'none', borderRadius: 8, padding: '4px 12px', cursor: 'pointer' }}
            >
              Connect
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {/* Principal */}
          <div className="form-group">
            <label><DollarSign size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Loan Amount (ETH)</label>
            <input
              type="number" step="0.001" min="0.001" placeholder="e.g. 0.5"
              value={form.principal}
              onChange={e => setForm(f => ({ ...f, principal: e.target.value }))}
              disabled={loading}
            />
          </div>

          {/* Collateral */}
          <div className="form-group">
            <label>
              <AlertTriangle size={14} style={{ marginRight: 6, verticalAlign: 'middle', color: ratioSafe === false ? '#FF4D4D' : ratioSafe === true ? '#00C896' : undefined }} />
              Collateral (ETH) — minimum 150% of loan
            </label>
            <input
              type="number" step="0.001" min="0" placeholder="e.g. 0.8"
              value={form.collateral}
              onChange={e => setForm(f => ({ ...f, collateral: e.target.value }))}
              disabled={loading}
              style={{ borderColor: ratioSafe === false ? '#FF4D4D' : ratioSafe === true ? '#00C896' : undefined }}
            />
            {collateralRatio && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600,
                color: ratioSafe ? '#00A878' : '#FF4D4D',
              }}>
                {ratioSafe ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                Collateral ratio: {collateralRatio}% {ratioSafe ? '✓ Safe' : '✗ Too low'}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Duration */}
            <div className="form-group">
              <label><Clock size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Duration (days)</label>
              <select value={form.durationDays} onChange={e => setForm(f => ({ ...f, durationDays: e.target.value }))} disabled={loading}>
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
                <option value="60">60 days</option>
                <option value="90">90 days</option>
                <option value="180">180 days</option>
                <option value="365">1 year</option>
              </select>
            </div>

            {/* Interest Rate */}
            <div className="form-group">
              <label><Percent size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Annual Rate</label>
              <select value={form.interestRateBps} onChange={e => setForm(f => ({ ...f, interestRateBps: e.target.value }))} disabled={loading}>
                <option value="500">5%</option>
                <option value="800">8%</option>
                <option value="1000">10%</option>
                <option value="1200">12%</option>
                <option value="1500">15%</option>
                <option value="2000">20%</option>
              </select>
            </div>
          </div>

          {/* Summary box */}
          {totalRepay && (
            <div style={{
              background: 'linear-gradient(135deg, #F5F3FF, #EEE6FF)',
              border: '1px solid rgba(107,78,255,0.2)',
              borderRadius: 14, padding: '16px 18px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontWeight: 700, color: '#2D1B69', fontSize: 14 }}>
                <Info size={14} /> Loan Summary
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 13 }}>
                <span style={{ color: '#6B7280' }}>You receive:</span>       <span style={{ fontWeight: 700 }}>{form.principal} ETH</span>
                <span style={{ color: '#6B7280' }}>Collateral locked:</span> <span style={{ fontWeight: 700 }}>{form.collateral} ETH</span>
                <span style={{ color: '#6B7280' }}>Interest ({interestPercent}% for {form.durationDays}d):</span>
                <span style={{ fontWeight: 700 }}>~{estimatedInterest} ETH</span>
                <span style={{ color: '#6B7280' }}>Total to repay:</span>    <span style={{ fontWeight: 700, color: '#6B4EFF' }}>{totalRepay} ETH</span>
              </div>
            </div>
          )}

          {/* Step indicator */}
          {step !== 'form' && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              {['chain', 'backend', 'done'].map((s, i) => (
                <div key={s} style={{
                  width: 28, height: 28, borderRadius: '50%', fontSize: 13, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: ['chain', 'backend', 'done'].indexOf(step) >= i ? '#6B4EFF' : '#E5E7EB',
                  color: ['chain', 'backend', 'done'].indexOf(step) >= i ? 'white' : '#9CA3AF',
                  transition: 'all 0.3s',
                }}>{i + 1}</div>
              ))}
            </div>
          )}

          <button type="submit" className="btn btn-primary auth-submit" disabled={loading || !ratioSafe}>
            {loading
              ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'white', borderColor: 'rgba(255,255,255,0.3)' }} /> Processing…</>
              : <><Wallet size={18} /> Request Loan via MetaMask</>
            }
          </button>
        </form>
      </div>
    </div>
  );
}
