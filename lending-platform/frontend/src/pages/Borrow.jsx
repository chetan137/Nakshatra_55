import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Wallet, DollarSign, Clock, Percent, AlertTriangle, CheckCircle, Info, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { useWallet } from '../hooks/useWallet';
import { createLoan } from '../api/loanApi';
import { useAuth } from '../context/AuthContext';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');

export default function Borrow() {
  const navigate   = useNavigate();
  const { user }   = useAuth();
  const wallet     = useWallet();

  useEffect(() => {
    if (user?.role === 'lender') {
      toast.error('Lenders cannot borrow funds.');
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const [ethPrice,    setEthPrice]    = useState(null);
  const [priceLoading, setPriceLoading] = useState(true);
  const priceRef = useRef(null);

  const [form, setForm] = useState({
    principalUsd:    '',
    durationDays:    '30',
    interestRateBps: '1200',
  });
  const [loading, setLoading] = useState(false);
  const [step, setStep]       = useState('form'); // form | chain | backend | done

  // Fetch ETH/USD price
  async function fetchEthPrice() {
    setPriceLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/api/eth-price`);
      const data = await res.json();
      if (data.success) {
        setEthPrice(data.usd);
        priceRef.current = data.usd;
      }
    } catch {
      toast.error('Could not fetch ETH price');
    } finally {
      setPriceLoading(false);
    }
  }

  useEffect(() => { fetchEthPrice(); }, []);

  // Derived values
  const principalUsd   = Number(form.principalUsd) || 0;
  const principalEth   = ethPrice && principalUsd ? (principalUsd / ethPrice) : null;
  // Collateral must be worth 150% of principal in USD → 1.5× the ETH amount
  const collateralEth  = principalEth ? principalEth * 1.5 : null;
  const collateralUsd  = collateralEth && ethPrice ? collateralEth * ethPrice : null;

  const interestPercent      = (Number(form.interestRateBps) / 100).toFixed(1);
  const estimatedInterestEth = principalEth && form.durationDays
    ? principalEth * (Number(form.interestRateBps) / 10000) * (Number(form.durationDays) / 365)
    : null;
  const totalRepayEth = estimatedInterestEth !== null
    ? principalEth + estimatedInterestEth
    : null;
  const totalRepayUsd = totalRepayEth && ethPrice ? totalRepayEth * ethPrice : null;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.principalUsd || !ethPrice) {
      return toast.error('Enter the loan amount and wait for ETH price to load');
    }
    if (principalUsd <= 0) return toast.error('Loan amount must be greater than 0');

    setLoading(true);
    try {
      // Step 1: Connect wallet
      toast('Step 1/3 — Connecting wallet…', { icon: '🦊' });
      const addr = wallet.account || await wallet.connect();
      if (!addr) { setLoading(false); return; }

      const pEth = principalEth.toFixed(8);
      const cEth = collateralEth.toFixed(8);

      // Step 2: Send tx to blockchain
      setStep('chain');
      toast('Step 2/3 — Sending to blockchain (MetaMask will open)…', { icon: '⛓️' });
      const { onChainId, txHash } = await wallet.callCreateLoan(
        pEth,
        cEth,
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
        principal:       Number(pEth),
        collateral:      Number(cEth),
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
    <div className="page-auth" style={{ background: 'linear-gradient(135deg, #342f30 0%, #60180b 50%, #342f30 100%)' }}>
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
            <p className="auth-subtitle" style={{ textAlign: 'left' }}>Enter USD amount — collateral auto-calculated at 150%</p>
          </div>
        </div>

        {/* ETH price banner */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 12, padding: '10px 14px', marginBottom: 16,
        }}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
            ETH/USD rate:
          </span>
          {priceLoading ? (
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Loading…</span>
          ) : ethPrice ? (
            <span style={{ fontSize: 14, fontWeight: 700, color: '#FF8C69' }}>
              1 ETH = ${ethPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          ) : (
            <span style={{ fontSize: 13, color: '#ba1a1a' }}>Unavailable</span>
          )}
          <button
            onClick={fetchEthPrice}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', padding: 4 }}
            title="Refresh price"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Wallet pill */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: wallet.account ? '#e6f0ef' : '#fef2f0',
          border: `1px solid ${wallet.account ? '#00373f' : '#c4803a'}`,
          borderRadius: 12, padding: '10px 14px', marginBottom: 24,
        }}>
          <Wallet size={16} color={wallet.account ? '#00373f' : '#815249'} />
          <span style={{ fontSize: 13, fontWeight: 600, color: wallet.account ? '#00373f' : '#815249' }}>
            {wallet.account
              ? `${wallet.account.slice(0, 6)}…${wallet.account.slice(-4)}`
              : 'Wallet not connected'}
          </span>
          {!wallet.account && (
            <button
              onClick={wallet.connect}
              disabled={wallet.connecting}
              style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, background: '#60180b', color: 'white', border: 'none', borderRadius: 8, padding: '4px 12px', cursor: 'pointer' }}
            >
              Connect
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {/* Principal in USD */}
          <div className="form-group">
            <label>
              <DollarSign size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
              Loan Amount (USD)
            </label>
            <input
              type="number" step="1" min="1" placeholder="e.g. 500"
              value={form.principalUsd}
              onChange={e => setForm(f => ({ ...f, principalUsd: e.target.value }))}
              disabled={loading}
            />
            {principalEth !== null && (
              <span style={{ fontSize: 12, color: '#8a7e80', marginTop: 4, display: 'block' }}>
                ≈ {principalEth.toFixed(6)} ETH at current rate
              </span>
            )}
          </div>

          {/* Collateral — auto-calculated, read-only */}
          <div className="form-group">
            <label>
              <AlertTriangle size={14} style={{ marginRight: 6, verticalAlign: 'middle', color: '#00373f' }} />
              Required Collateral (auto — 150% of loan)
            </label>
            <input
              type="text"
              readOnly
              value={
                collateralEth !== null
                  ? `${collateralEth.toFixed(6)} ETH  ≈  $${collateralUsd.toFixed(2)}`
                  : '—'
              }
              style={{ background: 'rgba(0,55,63,0.06)', cursor: 'default', color: '#00373f', fontWeight: 600 }}
            />
            {collateralEth !== null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#00373f', marginTop: 4 }}>
                <CheckCircle size={14} /> Collateral ratio: 150% — Safe
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
          {totalRepayEth !== null && (
            <div style={{
              background: 'linear-gradient(135deg, #fef2f0, #f5e8e5)',
              border: '1px solid rgba(96,24,11,0.2)',
              borderRadius: 14, padding: '16px 18px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontWeight: 700, color: '#60180b', fontSize: 14 }}>
                <Info size={14} /> Loan Summary
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 13 }}>
                <span style={{ color: '#8a7e80' }}>You receive:</span>
                <span style={{ fontWeight: 700 }}>${principalUsd.toFixed(2)} ({principalEth.toFixed(6)} ETH)</span>

                <span style={{ color: '#8a7e80' }}>Collateral locked:</span>
                <span style={{ fontWeight: 700 }}>${collateralUsd.toFixed(2)} ({collateralEth.toFixed(6)} ETH)</span>

                <span style={{ color: '#8a7e80' }}>Interest ({interestPercent}% for {form.durationDays}d):</span>
                <span style={{ fontWeight: 700 }}>~{estimatedInterestEth.toFixed(6)} ETH</span>

                <span style={{ color: '#8a7e80' }}>Total to repay:</span>
                <span style={{ fontWeight: 700, color: '#60180b' }}>
                  ~${totalRepayUsd.toFixed(2)} ({totalRepayEth.toFixed(6)} ETH)
                </span>
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
                  background: ['chain', 'backend', 'done'].indexOf(step) >= i ? '#60180b' : '#E5E7EB',
                  color: ['chain', 'backend', 'done'].indexOf(step) >= i ? 'white' : '#8a7e80',
                  transition: 'all 0.3s',
                }}>{i + 1}</div>
              ))}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary auth-submit"
            disabled={loading || !principalEth || priceLoading}
          >
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
