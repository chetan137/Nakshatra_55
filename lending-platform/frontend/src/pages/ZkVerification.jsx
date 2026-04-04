/**
 * ZkVerification.jsx
 *
 * The Anonymous Identity Verification page.
 *
 * What this page does (in 30 seconds for judges):
 *  1. User "logs into" their bank/govt portal via Reclaim Protocol
 *  2. A Zero-Knowledge proof is generated: "income > $1000, valid ID"
 *  3. The proof hash is stored on-chain. NO name, NO ID number, NO photo.
 *  4. Lenders see "ZK Verified ✓" — they trust the proof, not the documents.
 *  5. If the borrower defaults → Lit Protocol releases the encrypted backup
 *     to the lender ONLY. As long as they repay: 100% anonymous.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, ShieldCheck, Eye, EyeOff, Lock, Unlock,
  CheckCircle, AlertTriangle, ArrowLeft, ChevronRight,
  Zap, Globe, Key, FileText, RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useWallet } from '../hooks/useWallet';
import { useZkProof } from '../hooks/useZkProof';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export default function ZkVerification() {
  const navigate         = useNavigate();
  const { user, token, updateUser } = useAuth();
  const wallet           = useWallet();
  const { loading, error, zkStatus, submitProof, checkStatus } = useZkProof();

  const [step,       setStep]       = useState('idle'); // idle | running | done | already_verified
  const [progress,   setProgress]   = useState('');
  const [showPiiOpt, setShowPiiOpt] = useState(false);
  const [piiOptIn,   setPiiOptIn]   = useState(false);
  const [piiForm,    setPiiForm]    = useState({ name: '', idHash: '', incomeProof: '' });

  // Load existing status on mount
  useEffect(() => {
    if (token) {
      checkStatus(token).then(s => {
        if (s?.verified) setStep('already_verified');
      });
    }
  }, [token, checkStatus]);

  async function handleVerify() {
    if (!user?.walletAddress) {
      toast.error('Connect and verify your wallet first (Dashboard → MetaMask)');
      return;
    }

    setStep('running');
    setProgress('Starting ZK verification…');

    try {
      // Optional: encrypt PII for lender guarantee on default
      const piiData = piiOptIn && piiForm.name
        ? { name: piiForm.name, idHash: piiForm.idHash, incomeProof: piiForm.incomeProof }
        : null;

      // Get ethers signer for on-chain anchoring
      let signer = null;
      try {
        if (window.ethereum) {
          const provider = new (await import('ethers')).ethers.BrowserProvider(window.ethereum);
          signer = await provider.getSigner();
        }
      } catch { /* non-fatal */ }

      const result = await submitProof({
        token,
        piiData,
        signer,
        onProgress: (msg) => setProgress(msg),
      });

      // Update user context so rest of app knows
      updateUser({ zkVerified: true, zkProofHash: result.proofHash });

      setStep('done');
      toast.success('Identity verified anonymously!', { duration: 4000 });
    } catch (err) {
      setStep('idle');
      toast.error(err.message || 'Verification failed');
    }
  }

  const isVerified = step === 'done' || step === 'already_verified' || zkStatus?.verified;

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #fff8f7 0%, #f5e8e5 100%)' }}>
      <Navbar />

      <main style={{ maxWidth: 800, margin: '0 auto', padding: '40px 20px 80px' }}>
        {/* Back */}
        <button
          onClick={() => navigate('/dashboard')}
          className="btn btn-ghost"
          style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </button>

        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            background: isVerified ? '#e6f4f1' : 'linear-gradient(135deg, #60180b, #815249)',
            borderRadius: 20, padding: '10px 20px', marginBottom: 24,
          }}>
            {isVerified
              ? <ShieldCheck size={22} color="#00373f" />
              : <Shield size={22} color="white" />
            }
            <span style={{
              fontSize: 14, fontWeight: 700,
              color: isVerified ? '#00373f' : 'white',
            }}>
              {isVerified ? 'Identity Verified' : 'Anonymous Identity Verification'}
            </span>
          </div>

          <h1 style={{ fontSize: 36, fontWeight: 800, color: '#342f30', marginBottom: 16, lineHeight: 1.2 }}>
            Prove who you are.
            <br />
            <span style={{ color: '#60180b' }}>Reveal nothing.</span>
          </h1>
          <p style={{ fontSize: 17, color: '#8a7e80', maxWidth: 520, margin: '0 auto', lineHeight: 1.7 }}>
            Using <strong>zkTLS + Reclaim Protocol</strong>, verify your identity and income
            without uploading any documents. The lender sees a "✓ Verified" badge.
            Your name, ID, and income data stay on <em>your device</em>.
          </p>
        </div>

        {/* How it works */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16, marginBottom: 40,
        }}>
          {[
            {
              icon: <Globe size={22} color="#60180b" />,
              title: 'You log in locally',
              desc: 'Visit your bank or Aadhaar portal inside the Reclaim browser. Data never leaves your device.',
            },
            {
              icon: <Zap size={22} color="#815249" />,
              title: 'ZK proof generated',
              desc: 'Reclaim creates a cryptographic proof: "income > $1000, ID valid" — zero personal data.',
            },
            {
              icon: <Key size={22} color="#00373f" />,
              title: 'Hash anchored on-chain',
              desc: 'The proof hash goes to the smart contract. Lenders verify it publicly. No PII on-chain.',
            },
            {
              icon: <Lock size={22} color="#c4803a" />,
              title: 'Data revealed only on default',
              desc: 'If you repay: 100% anonymous forever. If you default: Lit Protocol unlocks encrypted backup for lender.',
            },
          ].map((item, i) => (
            <div key={i} className="card" style={{ textAlign: 'center', padding: '20px 16px' }}>
              <div style={{
                background: 'rgba(96,24,11,0.07)', borderRadius: 12,
                padding: 12, display: 'inline-flex', marginBottom: 12,
              }}>
                {item.icon}
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: '#342f30' }}>{item.title}</h3>
              <p style={{ fontSize: 13, color: '#8a7e80', lineHeight: 1.6 }}>{item.desc}</p>
            </div>
          ))}
        </div>

        {/* Main card */}
        <div className="card" style={{ padding: '32px', maxWidth: 560, margin: '0 auto' }}>
          {isVerified ? (
            /* ── Already Verified ── */
            <div style={{ textAlign: 'center' }}>
              <ShieldCheck size={56} color="#00373f" style={{ marginBottom: 16 }} />
              <h2 style={{ fontSize: 22, fontWeight: 800, color: '#00373f', marginBottom: 8 }}>
                Identity Verified ✓
              </h2>
              <p style={{ color: '#8a7e80', marginBottom: 24, fontSize: 15 }}>
                Your ZK proof is active. You can borrow anonymously. Lenders see your
                attestation badge — not your documents.
              </p>

              {(zkStatus?.attestation || step === 'already_verified') && (
                <div style={{
                  background: 'rgba(0,55,63,0.06)', borderRadius: 12,
                  padding: '16px 20px', marginBottom: 24, textAlign: 'left',
                }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#00373f', marginBottom: 10 }}>
                    What lenders see:
                  </p>
                  {[
                    { label: 'Valid Government ID', value: '✓ Attested' },
                    { label: 'Income verified', value: `✓ Above $${zkStatus?.attestation?.incomeAbove || 1000}` },
                    { label: 'Country', value: zkStatus?.attestation?.countryCode || 'IN' },
                    { label: 'Your name', value: '🔒 Hidden' },
                    { label: 'ID number', value: '🔒 Hidden' },
                    { label: 'Documents', value: '🔒 Never uploaded' },
                  ].map((row, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderBottom: i < 5 ? '1px solid rgba(0,55,63,0.08)' : 'none' }}>
                      <span style={{ color: '#8a7e80' }}>{row.label}</span>
                      <span style={{ fontWeight: 700, color: '#342f30' }}>{row.value}</span>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  onClick={() => navigate('/borrow')}
                >
                  <ChevronRight size={16} /> Start Borrowing
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => navigate('/dashboard')}
                >
                  Dashboard
                </button>
              </div>
            </div>
          ) : step === 'running' ? (
            /* ── In Progress ── */
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{
                width: 64, height: 64, margin: '0 auto 20px',
                border: '4px solid rgba(96,24,11,0.15)',
                borderTop: '4px solid #60180b',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }} />
              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#342f30', marginBottom: 12 }}>
                ZK Oracle Running…
              </h3>
              <p style={{ fontSize: 14, color: '#8a7e80', minHeight: 40 }}>{progress}</p>

              {/* Progress steps */}
              <div style={{ marginTop: 24, textAlign: 'left' }}>
                {[
                  'Reclaim Protocol oracle connecting',
                  'Generating Zero-Knowledge proof (zkTLS)',
                  'Attesting income & ID',
                  'Submitting proof to backend',
                  'Anchoring hash on blockchain',
                ].map((label, i) => {
                  const isActive = progress.toLowerCase().includes(label.toLowerCase().split(' ')[0].toLowerCase());
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', fontSize: 13, color: isActive ? '#60180b' : '#8a7e80' }}>
                      {isActive
                        ? <div style={{ width: 16, height: 16, border: '2px solid #60180b', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                        : <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'rgba(0,0,0,0.08)', flexShrink: 0 }} />
                      }
                      {label}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* ── Start Verification ── */
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <div style={{ background: 'rgba(96,24,11,0.08)', borderRadius: 12, padding: 12 }}>
                  <Shield size={24} color="#60180b" />
                </div>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 800, color: '#342f30' }}>
                    Verify Your Identity
                  </h2>
                  <p style={{ fontSize: 13, color: '#8a7e80', marginTop: 2 }}>
                    Takes ~30 seconds. Zero documents uploaded.
                  </p>
                </div>
              </div>

              {/* Wallet check */}
              <div style={{
                background: user?.walletAddress ? 'rgba(0,55,63,0.06)' : 'rgba(196,128,58,0.08)',
                border: `1px solid ${user?.walletAddress ? 'rgba(0,55,63,0.2)' : 'rgba(196,128,58,0.3)'}`,
                borderRadius: 12, padding: '12px 16px', marginBottom: 20,
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                {user?.walletAddress
                  ? <CheckCircle size={16} color="#00373f" />
                  : <AlertTriangle size={16} color="#c4803a" />
                }
                <div style={{ fontSize: 13 }}>
                  {user?.walletAddress
                    ? <><strong>Wallet verified</strong>: {user.walletAddress.slice(0, 8)}…{user.walletAddress.slice(-6)}</>
                    : <><strong>Wallet required</strong>: Go to Dashboard → Connect MetaMask first</>
                  }
                </div>
              </div>

              {/* What gets attested */}
              <div style={{ marginBottom: 24 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#342f30', marginBottom: 10 }}>
                  What the ZK proof will attest (NO PII shared):
                </p>
                {[
                  { icon: <CheckCircle size={14} color="#00373f" />, text: 'You have a valid government-issued ID' },
                  { icon: <CheckCircle size={14} color="#00373f" />, text: 'Your income exceeds $1,000/month' },
                  { icon: <EyeOff size={14} color="#815249" />, text: 'Your name remains hidden from lenders' },
                  { icon: <EyeOff size={14} color="#815249" />, text: 'Your ID number is never revealed' },
                  { icon: <Lock size={14} color="#815249" />, text: 'Documents never leave your device' },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 13, color: '#342f30' }}>
                    {item.icon} {item.text}
                  </div>
                ))}
              </div>

              {/* Optional PII backup toggle */}
              <div style={{
                border: '1px solid rgba(96,24,11,0.15)', borderRadius: 12,
                padding: '14px 16px', marginBottom: 24,
              }}>
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                  onClick={() => setShowPiiOpt(!showPiiOpt)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Key size={16} color="#c4803a" />
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#342f30' }}>
                      Optional: Lender Guarantee (Lit Protocol)
                    </span>
                  </div>
                  <ChevronRight size={16} color="#8a7e80" style={{ transform: showPiiOpt ? 'rotate(90deg)' : 'none', transition: '0.2s' }} />
                </div>
                <p style={{ fontSize: 12, color: '#8a7e80', marginTop: 6 }}>
                  Optionally encrypt your identity with Lit Protocol — revealed ONLY if you default.
                  This increases lender trust and may improve your loan terms.
                </p>

                {showPiiOpt && (
                  <div style={{ marginTop: 14, borderTop: '1px solid rgba(96,24,11,0.1)', paddingTop: 14 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer', marginBottom: 12 }}>
                      <input
                        type="checkbox"
                        checked={piiOptIn}
                        onChange={e => setPiiOptIn(e.target.checked)}
                      />
                      I agree to provide encrypted backup (revealed only on default via smart contract)
                    </label>

                    {piiOptIn && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <input
                          className="form-group input"
                          placeholder="Full name (will be Lit-encrypted)"
                          value={piiForm.name}
                          onChange={e => setPiiForm(f => ({ ...f, name: e.target.value }))}
                          style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(96,24,11,0.2)', fontSize: 13 }}
                        />
                        <input
                          className="form-group input"
                          placeholder="ID hash (Aadhaar last 4 / SSN last 4)"
                          value={piiForm.idHash}
                          onChange={e => setPiiForm(f => ({ ...f, idHash: e.target.value }))}
                          style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(96,24,11,0.2)', fontSize: 13 }}
                        />
                        <p style={{ fontSize: 11, color: '#8a7e80' }}>
                          This data is AES-256 encrypted on your device before submission.
                          Our server never sees it in plaintext.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button
                className="btn btn-primary auth-submit"
                onClick={handleVerify}
                disabled={loading || !user?.walletAddress || step === 'running'}
                style={{ width: '100%' }}
              >
                {loading
                  ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'white', borderColor: 'rgba(255,255,255,0.3)' }} /> Verifying…</>
                  : <><Shield size={18} /> Start Anonymous Verification</>
                }
              </button>

              {!user?.walletAddress && (
                <p style={{ fontSize: 12, color: '#c4803a', textAlign: 'center', marginTop: 10 }}>
                  Connect your wallet on the Dashboard first
                </p>
              )}
            </>
          )}
        </div>

        {/* Comparison table */}
        <div style={{ marginTop: 48 }}>
          <h2 style={{ textAlign: 'center', fontSize: 22, fontWeight: 800, marginBottom: 24, color: '#342f30' }}>
            Traditional vs. Anonymous Lending
          </h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#342f30', color: 'white' }}>
                  <th style={{ padding: '14px 16px', textAlign: 'left', borderRadius: '10px 0 0 0' }}>Feature</th>
                  <th style={{ padding: '14px 16px', textAlign: 'center' }}>Traditional</th>
                  <th style={{ padding: '14px 16px', textAlign: 'center', background: '#60180b', borderRadius: '0 10px 0 0' }}>LendChain ZK</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Login method', 'Email + Full Name', 'MetaMask wallet only'],
                  ['Documents', 'Uploaded to server', 'Stay on your device'],
                  ['Data visibility', 'Lender sees everything', '"Verified ✓" only'],
                  ['Identity disclosure', 'Always visible', 'Only on default'],
                  ['Privacy on repayment', 'No', '100% anonymous'],
                  ['Default recovery', 'Legal action only', 'Lit Protocol reveal'],
                ].map(([feature, trad, zkchain], i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? 'white' : 'rgba(96,24,11,0.03)', borderBottom: '1px solid rgba(96,24,11,0.08)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: '#342f30' }}>{feature}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', color: '#8a7e80' }}>{trad}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: '#00373f', background: 'rgba(0,55,63,0.04)' }}>{zkchain}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <Footer />

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
