import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Wallet, DollarSign, Clock, Percent, Info,
  RefreshCw, Shield, ShieldCheck, UserCheck, AlertTriangle,
  CheckCircle, ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useWallet } from '../hooks/useWallet';
import { useZkProof } from '../hooks/useZkProof';
import { createLoan, getMyGuarantorRequests } from '../api/loanApi';
import { useAuth } from '../context/AuthContext';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');

export default function Borrow() {
  const navigate           = useNavigate();
  const { user, token }    = useAuth();
  const wallet             = useWallet();
  const { checkStatus, zkStatus } = useZkProof();
  const [zkChecked, setZkChecked] = useState(false);

  useEffect(() => {
    if (user?.role === 'lender') {
      toast.error('Lenders cannot borrow funds.');
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    if (token && !zkChecked) {
      checkStatus(token).finally(() => setZkChecked(true));
    }
  }, [token, zkChecked, checkStatus]);

  // ETH price for display reference
  const [ethPrice,     setEthPrice]     = useState(null);
  const [priceLoading, setPriceLoading] = useState(true);
  const priceRef = useRef(null);

  // Approved guarantors (pre-approvals with no loan yet)
  const [approvedGuarantors, setApprovedGuarantors] = useState([]);
  const [guarantorsLoading,  setGuarantorsLoading]  = useState(true);
  const [selectedGuarantor,  setSelectedGuarantor]  = useState(null);

  const [form, setForm] = useState({
    principalUsd:    '',
    durationDays:    '30',
    interestRateBps: '1200',
  });
  const [loading, setLoading] = useState(false);
  const [step,    setStep]    = useState('form'); // form | backend | done

  // ── Fetch ETH price ────────────────────────────────────
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

  // ── Fetch approved guarantors ──────────────────────────
  useEffect(() => {
    if (!token) return;
    setGuarantorsLoading(true);
    getMyGuarantorRequests()
      .then(r => {
        // Only show approved pre-approvals that are not yet linked to a loan
        const approved = (r.data.requests || []).filter(
          g => g.status === 'approved' && !g.loan
        );
        setApprovedGuarantors(approved);
        if (approved.length === 1) setSelectedGuarantor(approved[0]);
      })
      .catch(() => {})
      .finally(() => setGuarantorsLoading(false));
  }, [token]);

  // ── Derived values ──────────────────────────────────────
  const principalUsd = Number(form.principalUsd) || 0;
  const principalEth = ethPrice && principalUsd ? (principalUsd / ethPrice) : null;

  const interestPercent      = (Number(form.interestRateBps) / 100).toFixed(1);
  const estimatedInterestEth = principalEth && form.durationDays
    ? principalEth * (Number(form.interestRateBps) / 10000) * (Number(form.durationDays) / 365)
    : null;
  const totalRepayEth = estimatedInterestEth !== null ? principalEth + estimatedInterestEth : null;
  const totalRepayUsd = totalRepayEth && ethPrice ? totalRepayEth * ethPrice : null;

  // ── Submit ──────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.principalUsd || !ethPrice) {
      return toast.error('Enter the loan amount and wait for ETH price to load');
    }
    if (principalUsd <= 0) return toast.error('Loan amount must be greater than 0');
    if (!selectedGuarantor) return toast.error('You must select an approved guarantor');

    setLoading(true);
    try {
      // Connect wallet for ownership verification
      toast('Connecting wallet…', { icon: '🦊' });
      const addr = wallet.account || await wallet.connect();
      if (!addr) { setLoading(false); return; }

      if (!user?.walletAddress || user.walletAddress.toLowerCase() !== addr.toLowerCase()) {
        toast('Verifying wallet ownership — sign the message in MetaMask…', { icon: '🔐' });
        try {
          await wallet.verifyWalletOwnership(addr);
          toast.success('Wallet verified!');
        } catch (verifyErr) {
          setLoading(false);
          return toast.error('Wallet verification failed: ' + (verifyErr?.response?.data?.message || verifyErr.message));
        }
      }

      const pEth = principalEth.toFixed(8);

      // Non-collateral loan: save directly to DB (no blockchain tx needed)
      setStep('backend');
      toast('Saving your loan request…', { icon: '💾' });
      await createLoan({
        borrowerAddress:    addr,
        principal:          Number(pEth),
        collateral:         0,
        interestRateBps:    Number(form.interestRateBps),
        durationDays:       Number(form.durationDays),
        guarantorRequestId: selectedGuarantor._id,
        loanType:           'guarantor',
      });

      setStep('done');
      toast.success('Loan request created! Waiting for a lender.', { duration: 5000 });
      setTimeout(() => navigate('/dashboard'), 2000);
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || err.message || 'Submission failed');
      setStep('form');
    } finally {
      setLoading(false);
    }
  }

  const zkVerified = user?.zkVerified || zkStatus?.verified;

  // ── ZK gate ─────────────────────────────────────────────
  if (zkChecked && !zkVerified) {
    return (
      <div className="page-auth" style={{ background: 'linear-gradient(135deg, #342f30 0%, #60180b 50%, #342f30 100%)' }}>
        <div className="auth-card" style={{ maxWidth: 480, textAlign: 'center' }}>
          <Shield size={52} color="#815249" style={{ marginBottom: 16 }} />
          <h2 className="auth-title" style={{ marginBottom: 10 }}>Identity Verification Required</h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 15, marginBottom: 24, lineHeight: 1.6 }}>
            LendChain uses <strong style={{ color: '#FF8C69' }}>Zero-Knowledge Proofs</strong> to verify borrowers
            anonymously. Complete a 30-second ZK check — no documents uploaded, no PII stored.
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-primary auth-submit" style={{ flex: 2 }} onClick={() => navigate('/zk-verify')}>
              <ShieldCheck size={18} /> Verify Anonymously
            </button>
            <button className="btn btn-ghost" style={{ flex: 1, color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.2)' }} onClick={() => navigate('/dashboard')}>
              <ArrowLeft size={16} /> Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-auth" style={{ background: 'linear-gradient(135deg, #342f30 0%, #60180b 50%, #342f30 100%)' }}>
      <div className="auth-card" style={{ maxWidth: 540 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <button onClick={() => navigate('/dashboard')} className="btn btn-ghost" style={{ padding: '8px 12px', fontSize: 14, borderRadius: 10 }}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="auth-title" style={{ textAlign: 'left', marginBottom: 2 }}>Request a Loan</h1>
            <p className="auth-subtitle" style={{ textAlign: 'left' }}>
              Non-collateral · guaranteed by a trusted user
            </p>
          </div>
        </div>

        {/* ETH price banner */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 12, padding: '10px 14px', marginBottom: 16,
        }}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>ETH/USD rate:</span>
          {priceLoading ? (
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Loading…</span>
          ) : ethPrice ? (
            <span style={{ fontSize: 14, fontWeight: 700, color: '#FF8C69' }}>
              1 ETH = ${ethPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          ) : (
            <span style={{ fontSize: 13, color: '#ba1a1a' }}>Unavailable</span>
          )}
          <button onClick={fetchEthPrice} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', padding: 4 }} title="Refresh price">
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
            {wallet.account ? `${wallet.account.slice(0, 6)}…${wallet.account.slice(-4)}` : 'Wallet not connected'}
          </span>
          {!wallet.account && (
            <button onClick={wallet.connect} disabled={wallet.connecting}
              style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, background: '#60180b', color: 'white', border: 'none', borderRadius: 8, padding: '4px 12px', cursor: 'pointer' }}>
              Connect
            </button>
          )}
        </div>

        {/* ── Guarantor Selection ─────────────────────── */}
        <div style={{
          marginBottom: 24, borderRadius: 14, overflow: 'hidden',
          border: selectedGuarantor ? '2px solid #00373f' : '2px solid rgba(196,128,58,0.5)',
          background: selectedGuarantor ? 'rgba(0,55,63,0.05)' : 'rgba(196,128,58,0.05)',
        }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <UserCheck size={16} color={selectedGuarantor ? '#00373f' : '#c4803a'} />
              <span style={{ fontWeight: 700, fontSize: 14, color: selectedGuarantor ? '#00373f' : '#815249' }}>
                Approved Guarantor <span style={{ color: '#ba1a1a' }}>*</span>
              </span>
            </div>
            {!selectedGuarantor && (
              <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 12px', color: '#c4803a', border: '1px solid rgba(196,128,58,0.4)' }}
                onClick={() => navigate('/guarantor-request')}>
                <ChevronRight size={13} /> Get One
              </button>
            )}
          </div>

          <div style={{ padding: '14px 18px' }}>
            {guarantorsLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
                <div className="spinner spinner-sm" style={{ borderTopColor: '#FF8C69', borderColor: 'rgba(255,255,255,0.2)' }} />
                Loading your guarantors…
              </div>
            ) : approvedGuarantors.length === 0 ? (
              <div style={{ fontSize: 13, lineHeight: 1.7 }}>
                <AlertTriangle size={15} color="#c4803a" style={{ marginRight: 6, verticalAlign: 'middle' }} />
                <span style={{ color: 'rgba(255,255,255,0.75)' }}>
                  You have no approved guarantors yet.{' '}
                </span>
                <button className="btn btn-ghost"
                  style={{ fontSize: 12, color: '#FF8C69', padding: '2px 0', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}
                  onClick={() => navigate('/guarantor-request')}>
                  Request a guarantor →
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {approvedGuarantors.map(g => {
                  const gName = g.guarantor?.name || g.guarantorAddress?.slice(0, 10) + '…';
                  const isSelected = selectedGuarantor?._id === g._id;
                  return (
                    <label key={g._id} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      border: `2px solid ${isSelected ? '#00373f' : 'rgba(255,255,255,0.15)'}`,
                      borderRadius: 10, padding: '12px 14px', cursor: 'pointer',
                      background: isSelected ? 'rgba(0,55,63,0.08)' : 'rgba(255,255,255,0.04)',
                      transition: 'all 0.2s',
                    }}>
                      <input type="radio" name="guarantor" value={g._id}
                        checked={isSelected}
                        onChange={() => setSelectedGuarantor(g)}
                        style={{ accentColor: '#00373f' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                          <span style={{ fontWeight: 700, fontSize: 14, color: 'rgba(255,255,255,0.95)' }}>
                            {gName}
                          </span>
                          {g.guarantor?.zkVerified && (
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#00b4a0', background: 'rgba(0,180,160,0.15)', borderRadius: 4, padding: '1px 6px', display: 'flex', alignItems: 'center', gap: 3 }}>
                              <ShieldCheck size={9} /> ZK
                            </span>
                          )}
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#00b47e', background: 'rgba(0,180,126,0.15)', borderRadius: 4, padding: '1px 6px' }}>
                            ✓ Approved
                          </span>
                        </div>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontFamily: 'monospace' }}>
                          Liable up to {g.guaranteeAmountEth} ETH
                        </span>
                      </div>
                      {isSelected && <CheckCircle size={18} color="#00373f" />}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
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
          {totalRepayEth !== null && selectedGuarantor && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(0,55,63,0.12), rgba(0,55,63,0.06))',
              border: '1px solid rgba(0,55,63,0.3)',
              borderRadius: 14, padding: '16px 18px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontWeight: 700, color: '#00b4a0', fontSize: 14 }}>
                <Info size={14} /> Loan Summary
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 13 }}>
                <span style={{ color: 'rgba(255,255,255,0.55)' }}>You receive:</span>
                <span style={{ fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>
                  ${principalUsd.toFixed(2)} ({principalEth.toFixed(6)} ETH)
                </span>

                <span style={{ color: 'rgba(255,255,255,0.55)' }}>Collateral locked:</span>
                <span style={{ fontWeight: 700, color: '#00b47e' }}>None — Guarantor-backed</span>

                <span style={{ color: 'rgba(255,255,255,0.55)' }}>Guarantor:</span>
                <span style={{ fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>
                  {selectedGuarantor?.guarantor?.name || 'Selected'}
                  {' '}(liable up to {selectedGuarantor?.guaranteeAmountEth} ETH)
                </span>

                <span style={{ color: 'rgba(255,255,255,0.55)' }}>Interest ({interestPercent}% for {form.durationDays}d):</span>
                <span style={{ fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>~{estimatedInterestEth.toFixed(6)} ETH</span>

                <span style={{ color: 'rgba(255,255,255,0.55)' }}>Total to repay:</span>
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
            disabled={loading || !principalEth || priceLoading || !selectedGuarantor}
          >
            {loading
              ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'white', borderColor: 'rgba(255,255,255,0.3)' }} />Processing…</>
              : <><Wallet size={18} /> Submit Loan Request</>
            }
          </button>
        </form>
      </div>
    </div>
  );
}
