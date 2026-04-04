import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Wallet, DollarSign, Clock, Percent, Info,
  RefreshCw, UserCheck, AlertTriangle, CheckCircle, XCircle, ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useWallet } from '../hooks/useWallet';
import { useZkProof } from '../hooks/useZkProof';
import { createLoan, getSettlement } from '../api/loanApi';
import { useAuth } from '../context/AuthContext';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');

export default function Borrow() {
  const navigate        = useNavigate();
  const { user, token } = useAuth();
  const wallet          = useWallet();
  const { checkStatus } = useZkProof();

  useEffect(() => {
    if (user?.role === 'lender') {
      toast.error('Lenders cannot borrow funds.');
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    if (token) checkStatus(token).catch(() => {});
  }, [token]);

  const [ethPrice,     setEthPrice]     = useState(null);
  const [priceLoading, setPriceLoading] = useState(true);

  // ── Settlement gate — max 2 active/pending loans ──────────
  const [settlement,     setSettlement]     = useState(null);
  const [settlementLoad, setSettlementLoad] = useState(true);

  useEffect(() => {
    getSettlement()
      .then(r => setSettlement(r.data.settlement))
      .catch(() => {})
      .finally(() => setSettlementLoad(false));
  }, []);

  const [form, setForm] = useState({
    principalUsd:     '',
    durationDays:     '30',
    interestRateBps:  '1200',
    guarantorAddress: '',
  });
  const [loading, setLoading] = useState(false);
  const [step,    setStep]    = useState('form');

  async function fetchEthPrice() {
    setPriceLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/api/eth-price`);
      const data = await res.json();
      if (data.success) setEthPrice(data.usd);
    } catch {
      toast.error('Could not fetch ETH price');
    } finally {
      setPriceLoading(false);
    }
  }
  useEffect(() => { fetchEthPrice(); }, []);

  // Derived
  const principalUsd         = Number(form.principalUsd) || 0;
  const principalEth         = ethPrice && principalUsd ? principalUsd / ethPrice : null;
  const interestPercent      = (Number(form.interestRateBps) / 100).toFixed(1);
  const estimatedInterestEth = principalEth && form.durationDays
    ? principalEth * (Number(form.interestRateBps) / 10000) * (Number(form.durationDays) / 365)
    : null;
  const totalRepayEth = estimatedInterestEth !== null ? principalEth + estimatedInterestEth : null;
  const totalRepayUsd = totalRepayEth && ethPrice ? totalRepayEth * ethPrice : null;
  const isValidAddress = /^0x[0-9a-fA-F]{40}$/.test(form.guarantorAddress.trim());

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.principalUsd || !ethPrice) return toast.error('Enter the loan amount and wait for ETH price to load');
    if (principalUsd <= 0)               return toast.error('Loan amount must be greater than 0');
    if (!form.guarantorAddress.trim())   return toast.error('Guarantor wallet address is required');
    if (!isValidAddress)                 return toast.error('Please enter a valid Ethereum address (0x…)');

    setLoading(true);
    try {
      toast('Connecting wallet…', { icon: '🦊' });
      const addr = wallet.account || await wallet.connect();
      if (!addr) { setLoading(false); return; }

      if (!user?.walletAddress || user.walletAddress.toLowerCase() !== addr.toLowerCase()) {
        toast('Sign the message in MetaMask to verify ownership…', { icon: '🔐' });
        try {
          await wallet.verifyWalletOwnership(addr);
          toast.success('Wallet verified!');
        } catch (verifyErr) {
          setLoading(false);
          return toast.error('Wallet verification failed: ' + (verifyErr?.response?.data?.message || verifyErr.message));
        }
      }

      setStep('backend');
      toast('Saving your loan request…', { icon: '💾' });
      await createLoan({
        borrowerAddress:  addr,
        principal:        Number(principalEth.toFixed(8)),
        collateral:       0,
        interestRateBps:  Number(form.interestRateBps),
        durationDays:     Number(form.durationDays),
        guarantorAddress: form.guarantorAddress.trim().toLowerCase(),
        loanType:         'guarantor',
      });

      setStep('done');
      toast.success('Loan request created! Guarantor has been notified.', { duration: 5000 });
      setTimeout(() => navigate('/dashboard'), 2000);
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || err.message || 'Submission failed');
      setStep('form');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-auth" style={{ background: 'linear-gradient(135deg, #342f30 0%, #60180b 50%, #342f30 100%)' }}>
      <div className="auth-card" style={{ maxWidth: 540 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <button onClick={() => navigate('/dashboard')} className="btn btn-ghost"
            style={{ padding: '8px 12px', fontSize: 14, borderRadius: 10 }}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="auth-title" style={{ textAlign: 'left', marginBottom: 2 }}>Request a Loan</h1>
            <p className="auth-subtitle" style={{ textAlign: 'left' }}>
              Non-collateral · guaranteed by a trusted user
            </p>
          </div>
        </div>

        {/* ── Settlement Block — shown when at limit ── */}
        {!settlementLoad && settlement && !settlement.canRequestNewLoan ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Red alert */}
            <div style={{
              background: 'rgba(186,26,26,0.15)',
              border: '1.5px solid rgba(186,26,26,0.5)',
              borderRadius: 16, padding: '20px 22px',
              display: 'flex', alignItems: 'flex-start', gap: 14,
            }}>
              <XCircle size={28} color="#ff6b6b" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <p style={{ fontWeight: 800, fontSize: 17, color: '#fff', marginBottom: 6 }}>
                  Loan Limit Reached
                </p>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6 }}>
                  You already have <strong style={{ color: '#ff6b6b' }}>{settlement.activeLoanCount} active / pending loans</strong>.
                  The maximum is <strong style={{ color: '#fff' }}>2</strong>. Repay at least one loan before requesting a new one.
                </p>
              </div>
            </div>

            {/* Active loans list */}
            {settlement.activeLoans?.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1 }}>
                  Your Current Loans
                </p>
                {settlement.activeLoans.map((loan, i) => (
                  <div key={loan._id} style={{
                    background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 13, padding: '14px 16px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                  }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                          background: loan.status === 'active' ? 'rgba(0,183,127,0.2)' : 'rgba(196,128,58,0.2)',
                          color: loan.status === 'active' ? '#00b47e' : '#c4803a',
                        }}>
                          {loan.status.toUpperCase()}
                        </span>
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>Loan #{i + 1}</span>
                      </div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 2 }}>
                        {loan.principal?.toFixed(6)} ETH
                      </p>
                      {loan.dueDate && (
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                          Due: {new Date(loan.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      )}
                    </div>
                    {loan.status === 'active' && (
                      <button
                        className="btn"
                        style={{ background: '#ba1a1a', color: '#fff', fontSize: 12, whiteSpace: 'nowrap', flexShrink: 0 }}
                        onClick={() => navigate(`/history?repay=${loan._id}`)}
                      >
                        Repay <ChevronRight size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <button
              className="btn btn-secondary"
              style={{ fontSize: 14, marginTop: 4 }}
              onClick={() => navigate('/history')}
            >
              Go to Loan History
            </button>
          </div>
        ) : (
          <>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 12, padding: '10px 14px', marginBottom: 16,
        }}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>ETH/USD rate:</span>
          {priceLoading
            ? <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Loading…</span>
            : ethPrice
              ? <span style={{ fontSize: 14, fontWeight: 700, color: '#FF8C69' }}>
                  1 ETH = ${ethPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              : <span style={{ fontSize: 13, color: '#ba1a1a' }}>Unavailable</span>}
          <button onClick={fetchEthPrice}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', padding: 4 }}
            title="Refresh">
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
            <button onClick={wallet.connect} disabled={wallet.connecting}
              style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, background: '#60180b', color: 'white', border: 'none', borderRadius: 8, padding: '4px 12px', cursor: 'pointer' }}>
              Connect
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="auth-form">

          {/* Loan Amount */}
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

          {/* Duration + Rate */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
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

          {/* ── Guarantor Wallet Address — required ── */}
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <UserCheck size={14} />
              Guarantor Wallet Address
              <span style={{ color: '#ba1a1a', fontWeight: 900, fontSize: 16, lineHeight: 1 }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="guarantorAddress"
                type="text"
                placeholder="0x… enter your guarantor's wallet address"
                value={form.guarantorAddress}
                onChange={e => setForm(f => ({ ...f, guarantorAddress: e.target.value }))}
                disabled={loading}
                required
                style={{
                  paddingRight: 42,
                  border: form.guarantorAddress
                    ? `1.5px solid ${isValidAddress ? '#00b47e' : '#ba1a1a'}`
                    : undefined,
                  transition: 'border-color 0.2s',
                }}
              />
              {form.guarantorAddress && (
                <span style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)' }}>
                  {isValidAddress
                    ? <CheckCircle size={17} color="#00b47e" />
                    : <AlertTriangle size={17} color="#ba1a1a" />}
                </span>
              )}
            </div>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 5, display: 'block', lineHeight: 1.55 }}>
              A guarantee request will be sent to this wallet. The guarantor must approve before a lender can fund your loan.
            </span>
          </div>

          {/* Loan Summary */}
          {totalRepayEth !== null && isValidAddress && (
            <div style={{
              background: 'rgba(0,0,0,0.35)',
              border: '1px solid rgba(255,140,105,0.3)', borderRadius: 14, padding: '16px 18px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, fontWeight: 700, color: '#FF8C69', fontSize: 14 }}>
                <Info size={14} /> Loan Summary
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px', fontSize: 13 }}>
                <span style={{ color: 'rgba(255,255,255,0.6)' }}>You receive:</span>
                <span style={{ fontWeight: 700, color: '#ffffff' }}>
                  ${principalUsd.toFixed(2)} ({principalEth.toFixed(6)} ETH)
                </span>

                <span style={{ color: 'rgba(255,255,255,0.6)' }}>Collateral locked:</span>
                <span style={{ fontWeight: 700, color: '#00b47e' }}>None — Guarantor-backed</span>

                <span style={{ color: 'rgba(255,255,255,0.6)' }}>Guarantor:</span>
                <span style={{ fontWeight: 700, color: '#ffffff', fontFamily: 'monospace', fontSize: 11 }}>
                  {form.guarantorAddress.slice(0, 10)}…{form.guarantorAddress.slice(-6)}
                </span>

                <span style={{ color: 'rgba(255,255,255,0.6)' }}>Interest ({interestPercent}% for {form.durationDays}d):</span>
                <span style={{ fontWeight: 700, color: '#ffffff' }}>~{estimatedInterestEth.toFixed(6)} ETH</span>

                <span style={{ color: 'rgba(255,255,255,0.6)' }}>Total to repay:</span>
                <span style={{ fontWeight: 700, color: '#FF8C69' }}>
                  ~${totalRepayUsd.toFixed(2)} ({totalRepayEth.toFixed(6)} ETH)
                </span>
              </div>
            </div>
          )}

          {/* Step indicator */}
          {step !== 'form' && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              {['backend', 'done'].map((s, i) => (
                <div key={s} style={{
                  width: 28, height: 28, borderRadius: '50%', fontSize: 13, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: ['backend', 'done'].indexOf(step) >= i ? '#00373f' : 'rgba(255,255,255,0.15)',
                  color: ['backend', 'done'].indexOf(step) >= i ? 'white' : 'rgba(255,255,255,0.4)',
                  transition: 'all 0.3s',
                }}>{i + 1}</div>
              ))}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary auth-submit"
            disabled={loading || !principalEth || priceLoading || !isValidAddress}
          >
            {loading
              ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'white', borderColor: 'rgba(255,255,255,0.3)' }} />Processing…</>
              : <><Wallet size={18} /> Submit Loan Request</>}
          </button>
        </form>
          </>
        )}
      </div>
    </div>
  );
}
