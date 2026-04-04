import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrowserProvider } from 'ethers';
import toast from 'react-hot-toast';
import { getNonce, verifySignature, selectRole, saveToken } from '../api/authApi';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

// ─── Step types ────────────────────────────────────────────────
// 'connect'     → initial "Connect MetaMask" button
// 'role'        → new user must pick Borrower / Lender
// 'loading'     → spinner while signing / verifying

export default function Login() {
  const navigate          = useNavigate();
  const { login }         = useAuth();
  const [step, setStep]   = useState('connect');
  const [busy, setBusy]   = useState(false);

  // Kept in state to reuse in selectRole call
  const [pendingToken,   setPendingToken]   = useState(null);
  const [pendingWallet,  setPendingWallet]  = useState(null);

  // ── Connect + Sign ──────────────────────────────────────────
  async function handleConnect() {
    if (!window.ethereum) {
      toast.error('MetaMask not detected. Please install it first.', { duration: 5000 });
      return;
    }

    setBusy(true);
    try {
      // 1. Request accounts
      const provider = new BrowserProvider(window.ethereum);
      await provider.send('eth_requestAccounts', []);
      const signer        = await provider.getSigner();
      const walletAddress = (await signer.getAddress()).toLowerCase();

      toast('Step 1/3 — Fetching nonce…', { icon: '🔐' });

      // 2. Get nonce message from backend
      const nonceRes = await getNonce(walletAddress);
      const message  = nonceRes.data.message;

      toast('Step 2/3 — Sign the message in MetaMask…', { icon: '✍️', duration: 8000 });

      // 3. Sign
      const signature = await signer.signMessage(message);

      toast('Step 3/3 — Verifying…', { icon: '⚡' });

      // 4. Send to backend
      const verifyRes = await verifySignature({ walletAddress, signature });
      const { isNewUser, token, role } = verifyRes.data;

      if (!isNewUser) {
        // Existing user with a role → log in immediately
        login(token, { walletAddress, role });
        toast.success(`Welcome back! Connected as ${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`, {
          style: { background: '#342f30', color: '#fff' },
          iconTheme: { primary: '#00373f', secondary: '#fff' },
        });
        navigate('/dashboard', { replace: true });
      } else {
        // New user → role selection screen
        setPendingToken(token);
        setPendingWallet(walletAddress);
        setStep('role');
      }
    } catch (err) {
      if (err.code === 4001 || err.code === 'ACTION_REJECTED') {
        toast.error('Signature rejected. Please sign to authenticate.');
      } else {
        toast.error(err?.response?.data?.message || err.message || 'Authentication failed');
      }
    } finally {
      setBusy(false);
    }
  }

  // ── Pick Role ───────────────────────────────────────────────
  async function handleSelectRole(role) {
    setBusy(true);
    try {
      // Temporarily set token so the API call can auth
      saveToken(pendingToken);

      const res = await selectRole({ role });
      const { token: finalToken } = res.data;

      login(finalToken, { walletAddress: pendingWallet, role });
      toast.success(`Role set: ${role.charAt(0).toUpperCase() + role.slice(1)}. Welcome aboard! 🎉`, {
        style:     { background: '#342f30', color: '#fff' },
        iconTheme: { primary: '#00373f', secondary: '#fff' },
        duration:  4000,
      });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to set role');
      setBusy(false);
    }
  }

  return (
    <>
      <Navbar />
      <div className="auth-split-page">
        {/* ── Left: form ── */}
        <div className="auth-split-left">
          <div className="auth-card">

            {step === 'connect' && (
              <>
                <div className="auth-header">
                  <div className="auth-icon-wrap" style={{ fontSize: 28 }}>🦊</div>
                  <h1 className="auth-title">Sign In</h1>
                  <p className="auth-subtitle">
                    Connect your MetaMask wallet to access Go Secure.
                    No passwords, no email — just your wallet.
                  </p>
                </div>

                <button
                  id="metamask-connect-btn"
                  className="btn btn-primary auth-submit"
                  onClick={handleConnect}
                  disabled={busy}
                  style={{ marginTop: 8, fontSize: 16, gap: 12 }}
                >
                  {busy ? (
                    <><span className="spinner spinner-sm" /> Connecting…</>
                  ) : (
                    <>
                      <img
                        src="https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg"
                        alt="MetaMask"
                        style={{ width: 24, height: 24 }}
                      />
                      Connect with MetaMask
                    </>
                  )}
                </button>

                {/* How it works */}
                <div style={{ marginTop: 28 }}>
                  {[
                    { icon: '🔐', text: 'We never store passwords or private keys' },
                    { icon: '✍️', text: 'Sign a one-time message to prove ownership' },
                    { icon: '⚡', text: 'Instantly authenticated — no waiting' },
                  ].map(({ icon, text }) => (
                    <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                      <span style={{ fontSize: 18 }}>{icon}</span>
                      <span style={{ fontSize: 13, color: 'var(--text-card-muted)' }}>{text}</span>
                    </div>
                  ))}
                </div>

                <p className="auth-footer" style={{ marginTop: 20 }}>
                  Don't have MetaMask?{' '}
                  <a
                    href="https://metamask.io/download/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="auth-link"
                  >
                    Install it here ↗
                  </a>
                </p>
              </>
            )}

            {step === 'role' && (
              <>
                <div className="auth-header">
                  <div className="auth-icon-wrap" style={{ fontSize: 28 }}>👋</div>
                  <h1 className="auth-title">Welcome!</h1>
                  <p className="auth-subtitle">
                    First time here. Choose how you want to use Go Secure.
                    <br />
                    <span style={{ fontSize: 12, color: 'var(--color-error)', fontWeight: 600 }}>
                      This cannot be changed later.
                    </span>
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 8 }}>
                  {/* Borrower card */}
                  <button
                    id="role-borrower-btn"
                    onClick={() => handleSelectRole('borrower')}
                    disabled={busy}
                    style={{
                      display:         'flex',
                      alignItems:      'flex-start',
                      gap:             14,
                      padding:         '20px 18px',
                      borderRadius:    16,
                      border:          '2px solid rgba(96,24,11,0.25)',
                      background:      'rgba(96,24,11,0.06)',
                      cursor:          busy ? 'not-allowed' : 'pointer',
                      textAlign:       'left',
                      transition:      'all 0.2s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = '#60180b'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(96,24,11,0.25)'}
                  >
                    <span style={{ fontSize: 34, lineHeight: 1 }}>🏦</span>
                    <div>
                      <p style={{ fontWeight: 800, fontSize: 16, color: '#60180b', margin: '0 0 4px' }}>Borrower</p>
                      <p style={{ fontSize: 13, color: 'var(--text-card-muted)', margin: 0, lineHeight: 1.5 }}>
                        Deposit crypto collateral and borrow ETH instantly via smart contract.
                      </p>
                    </div>
                  </button>

                  {/* Lender card */}
                  <button
                    id="role-lender-btn"
                    onClick={() => handleSelectRole('lender')}
                    disabled={busy}
                    style={{
                      display:         'flex',
                      alignItems:      'flex-start',
                      gap:             14,
                      padding:         '20px 18px',
                      borderRadius:    16,
                      border:          '2px solid rgba(0,55,63,0.25)',
                      background:      'rgba(0,55,63,0.06)',
                      cursor:          busy ? 'not-allowed' : 'pointer',
                      textAlign:       'left',
                      transition:      'all 0.2s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = '#00373f'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(0,55,63,0.25)'}
                  >
                    <span style={{ fontSize: 34, lineHeight: 1 }}>💰</span>
                    <div>
                      <p style={{ fontWeight: 800, fontSize: 16, color: '#00373f', margin: '0 0 4px' }}>Lender</p>
                      <p style={{ fontSize: 13, color: 'var(--text-card-muted)', margin: 0, lineHeight: 1.5 }}>
                        Fund loan requests and earn interest. Collateral is locked on-chain.
                      </p>
                    </div>
                  </button>
                </div>

                {busy && (
                  <div style={{ textAlign: 'center', marginTop: 20 }}>
                    <span className="spinner" style={{ borderTopColor: '#60180b', borderColor: 'rgba(96,24,11,0.2)' }} />
                    <p style={{ fontSize: 13, color: 'var(--text-card-muted)', marginTop: 10 }}>Saving your role…</p>
                  </div>
                )}
              </>
            )}

          </div>
        </div>

        {/* ── Right: video panel ── */}
        <div className="auth-split-right">
          <video autoPlay loop muted playsInline className="auth-split-video">
            <source src="/v1.mp4" type="video/mp4" />
          </video>
          <div className="auth-split-video-overlay">
            {/* Brand */}
            <div className="auth-split-brand">
              <img src="/logo.png" alt="Go Secure" />
              <div className="auth-split-brand-text">
                <h3>Go Secure</h3>
                <span>DeFi Lending Platform</span>
              </div>
            </div>

            {/* Hero */}
            <div className="auth-split-hero">
              <h2>
                {step === 'role'
                  ? <>Pick your<br /><em>role once,</em> forever.</>
                  : <>Welcome back<br />to <em>DeFi done right.</em></>
                }
              </h2>
              <p>
                Borrow against crypto collateral or earn competitive yields—
                all secured by smart contracts, no middlemen.
              </p>
              <div className="auth-split-stats">
                <div className="auth-stat-badge"><strong>$2.4B+</strong><span>Total Value Locked</span></div>
                <div className="auth-stat-badge"><strong>180K+</strong><span>Active Users</span></div>
                <div className="auth-stat-badge"><strong>12% APY</strong><span>Avg. Lender Return</span></div>
              </div>
            </div>

            <div className="auth-split-features">
              {[
                { dot: '#f5d5c8', text: 'Non-custodial — you hold your keys' },
                { dot: '#b3e0d8', text: 'Smart contract collateral, always' },
                { dot: '#c4803a', text: 'Get funded in minutes, not days' },
              ].map(f => (
                <div key={f.text} className="auth-split-feature">
                  <span className="auth-split-feature-dot" style={{ background: f.dot }} />
                  {f.text}
                </div>
              ))}
            </div>

            <div className="auth-split-trust">
              <div className="auth-split-trust-icon">🔒</div>
              <p><strong>Bank-grade Security</strong>Audited smart contracts, no custodial risk</p>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
