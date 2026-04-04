/**
 * GuarantorRequest.jsx
 *
 * Borrower flow — request a guarantor PRE-APPROVAL (no loan required first):
 *  1. Enter guarantor's MetaMask wallet address → search
 *  2. System shows guarantor's LendChain profile (name, ZK status)
 *  3. Set guarantee amount + optional message → Send
 *
 * Once approved, the borrower can go to /borrow and select this guarantor
 * when creating their non-collateral loan.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Search, ShieldCheck, UserCheck, UserX,
  AlertTriangle, CheckCircle, Send, Wallet, ChevronRight,
  FileText, Info,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useGuarantor } from '../hooks/useGuarantor';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export default function GuarantorRequest() {
  const navigate            = useNavigate();
  const { user, token }     = useAuth();
  const { loading, searchByWallet, requestGuarantor } = useGuarantor();

  const [walletInput,  setWalletInput]  = useState('');
  const [foundUser,    setFoundUser]    = useState(null);
  const [searchDone,   setSearchDone]   = useState(false);
  const [guaranteeAmt, setGuaranteeAmt] = useState('');
  const [message,      setMessage]      = useState('');
  const [submitted,    setSubmitted]    = useState(false);
  const [sentTo,       setSentTo]       = useState(null);

  // Redirect lenders — they don't need guarantors
  useEffect(() => {
    if (user?.role === 'lender') {
      toast.error('Lenders don\'t need guarantors.');
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  // ── Step 1: Search guarantor by wallet ─────────────────
  async function handleSearch(e) {
    e.preventDefault();
    if (!/^0x[0-9a-fA-F]{40}$/.test(walletInput.trim())) {
      return toast.error('Enter a valid Ethereum wallet address (0x…)');
    }
    setSearchDone(false);
    setFoundUser(null);
    try {
      const result = await searchByWallet(token, walletInput.trim());
      setSearchDone(true);
      if (result.found) {
        setFoundUser(result.user);
      } else {
        setFoundUser(null);
        toast.error(result.message || 'No account found for this wallet.');
      }
    } catch (err) {
      toast.error(err.message);
    }
  }

  // ── Step 2: Send guarantee request ─────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    if (!foundUser)    return toast.error('Search and confirm a guarantor first');
    if (!guaranteeAmt || Number(guaranteeAmt) <= 0) return toast.error('Enter a valid guarantee amount');

    try {
      await requestGuarantor(token, {
        // No loanId — this is a pre-approval; loan is linked on /borrow
        guarantorWallet:    foundUser.walletAddress,
        guaranteeAmountEth: Number(guaranteeAmt),
        borrowerMessage:    message,
      });
      setSentTo(foundUser);
      setSubmitted(true);
      toast.success(`Guarantee request sent to ${foundUser.name}!`, { duration: 5000 });
    } catch (err) {
      toast.error(err.message);
    }
  }

  // ── Success screen ──────────────────────────────────────
  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #fff8f7 0%, #f5e8e5 100%)' }}>
        <Navbar />
        <main style={{ maxWidth: 560, margin: '0 auto', padding: '80px 20px', textAlign: 'center' }}>
          <div style={{ background: 'rgba(0,55,63,0.08)', borderRadius: '50%', padding: 24, display: 'inline-flex', marginBottom: 24 }}>
            <Send size={48} color="#00373f" />
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#342f30', marginBottom: 12 }}>Request Sent!</h1>
          <p style={{ color: '#8a7e80', fontSize: 16, marginBottom: 8, lineHeight: 1.7 }}>
            <strong>{sentTo?.name}</strong> has received an email notification.
            Once they approve, you can create your loan on the Borrow page.
          </p>
          <p style={{ color: '#8a7e80', fontSize: 14, marginBottom: 32 }}>
            You'll receive an email when they respond. Track status in{' '}
            <button style={{ background: 'none', border: 'none', color: '#60180b', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', fontSize: 14 }}
              onClick={() => navigate('/guarantor-inbox')}>
              Guarantor Inbox
            </button>.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => navigate('/borrow')}>
              <ChevronRight size={16} /> Go to Borrow
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/guarantor-inbox')}>
              <FileText size={16} /> View Inbox
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #fff8f7 0%, #f5e8e5 100%)' }}>
      <Navbar />
      <main style={{ maxWidth: 680, margin: '0 auto', padding: '40px 20px 80px' }}>

        {/* Back */}
        <button onClick={() => navigate(-1)} className="btn btn-ghost"
          style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
          <ArrowLeft size={16} /> Back
        </button>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 30, fontWeight: 800, color: '#342f30', marginBottom: 8 }}>
            Request a Guarantor
          </h1>
          <p style={{ color: '#8a7e80', fontSize: 15, lineHeight: 1.6 }}>
            Get a guarantor pre-approved <em>before</em> creating your loan. Search by their MetaMask
            wallet address — an email notification will be sent{' '}
            <strong>only to that user</strong>.
          </p>
        </div>

        {/* How it works banner */}
        <div style={{
          background: 'rgba(0,55,63,0.05)', border: '1px solid rgba(0,55,63,0.14)',
          borderRadius: 14, padding: '16px 20px', marginBottom: 28,
          display: 'flex', alignItems: 'flex-start', gap: 12,
        }}>
          <Info size={18} color="#00373f" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#342f30', marginBottom: 6 }}>Two-step process</p>
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#8a7e80', lineHeight: 1.8 }}>
              <li>Find your guarantor here → they approve (or reject) your request.</li>
              <li>Once approved, go to <strong style={{ color: '#60180b' }}>Borrow</strong> — their name appears as a required guarantor field when creating your loan.</li>
            </ol>
          </div>
        </div>

        {/* Step 1: Search Guarantor */}
        <div className="card" style={{ marginBottom: 20, padding: '24px' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, color: '#342f30' }}>
            Step 1 — Find Guarantor by Wallet
          </h3>
          <p style={{ fontSize: 13, color: '#8a7e80', marginBottom: 16 }}>
            Enter the MetaMask wallet address of the person who agreed to guarantee your loan.
          </p>

          <form onSubmit={handleSearch} style={{ display: 'flex', gap: 10 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Wallet size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#8a7e80' }} />
              <input
                type="text"
                placeholder="0x… (guarantor's MetaMask address)"
                value={walletInput}
                onChange={e => { setWalletInput(e.target.value); setFoundUser(null); setSearchDone(false); }}
                style={{
                  width: '100%', padding: '11px 14px 11px 36px',
                  border: '1px solid rgba(96,24,11,0.2)', borderRadius: 10,
                  fontSize: 13, fontFamily: 'monospace', outline: 'none',
                  background: 'rgba(96,24,11,0.02)',
                }}
                disabled={loading}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading || !walletInput.trim()} style={{ padding: '11px 20px' }}>
              {loading
                ? <div className="spinner spinner-sm" style={{ borderTopColor: 'white', borderColor: 'rgba(255,255,255,0.3)' }} />
                : <Search size={16} />}
              Search
            </button>
          </form>

          {/* Search Result — not found */}
          {searchDone && !foundUser && (
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10, color: '#ba1a1a', fontSize: 14 }}>
              <UserX size={18} />
              No LendChain account found for this wallet. The guarantor must be registered.
            </div>
          )}

          {/* Search Result — found */}
          {foundUser && (
            <div style={{
              marginTop: 16, border: '2px solid #00373f', borderRadius: 12,
              padding: '16px 20px', background: 'rgba(0,55,63,0.04)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #00373f, #008070)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontWeight: 700, fontSize: 18,
                }}>
                  {foundUser.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 16, color: '#342f30' }}>{foundUser.name}</span>
                    {foundUser.zkVerified && (
                      <span style={{
                        fontSize: 11, fontWeight: 700, color: '#00373f',
                        background: 'rgba(0,55,63,0.12)', borderRadius: 6, padding: '2px 8px',
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}>
                        <ShieldCheck size={11} /> ZK Verified
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 12, color: '#8a7e80', fontFamily: 'monospace', marginTop: 2 }}>
                    {foundUser.walletAddress.slice(0, 10)}…{foundUser.walletAddress.slice(-8)}
                  </p>
                </div>
                <CheckCircle size={22} color="#00373f" />
              </div>

              <div style={{ fontSize: 13, color: '#8a7e80', display: 'flex', gap: 16 }}>
                <span>Role: <strong style={{ color: '#342f30', textTransform: 'capitalize' }}>{foundUser.role}</strong></span>
                <span>Identity: <strong style={{ color: foundUser.zkVerified ? '#00373f' : '#c4803a' }}>
                  {foundUser.zkVerified ? '✓ ZK Verified' : 'Not ZK verified'}
                </strong></span>
              </div>
            </div>
          )}
        </div>

        {/* Step 2: Terms */}
        {foundUser && (
          <div className="card" style={{ marginBottom: 20, padding: '24px' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, color: '#342f30' }}>
              Step 2 — Set Guarantee Terms
            </h3>
            <p style={{ fontSize: 13, color: '#8a7e80', marginBottom: 16 }}>
              Specify how much <strong>{foundUser.name}</strong> will be liable for if you default on your future loan.
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Guarantee Amount */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#342f30', display: 'block', marginBottom: 6 }}>
                  Guarantee Amount (ETH) <span style={{ color: '#ba1a1a' }}>*</span>
                </label>
                <input
                  type="number" step="0.0001" min="0.0001"
                  placeholder="e.g. 0.5"
                  value={guaranteeAmt}
                  onChange={e => setGuaranteeAmt(e.target.value)}
                  style={{
                    width: '100%', padding: '11px 14px', border: '1px solid rgba(96,24,11,0.2)',
                    borderRadius: 10, fontSize: 14, outline: 'none',
                  }}
                  required
                />
                <p style={{ fontSize: 12, color: '#8a7e80', marginTop: 4 }}>
                  This is the max ETH the guarantor must pay if you default. Must cover your intended loan amount.
                </p>
              </div>

              {/* Optional message */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#342f30', display: 'block', marginBottom: 6 }}>
                  Message to Guarantor{' '}
                  <span style={{ fontWeight: 400, color: '#8a7e80' }}>(optional)</span>
                </label>
                <textarea
                  placeholder="E.g. Hi, I'm planning a small ETH loan and would like you as my guarantor. I have stable income and will repay on time."
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  maxLength={500}
                  rows={3}
                  style={{
                    width: '100%', padding: '11px 14px', border: '1px solid rgba(96,24,11,0.2)',
                    borderRadius: 10, fontSize: 13, outline: 'none', resize: 'vertical',
                  }}
                />
                <p style={{ fontSize: 11, color: '#8a7e80', marginTop: 2 }}>{message.length}/500</p>
              </div>

              {/* Warning */}
              <div style={{
                background: 'rgba(196,128,58,0.08)', border: '1px solid rgba(196,128,58,0.3)',
                borderRadius: 10, padding: '12px 14px',
                display: 'flex', alignItems: 'flex-start', gap: 10,
              }}>
                <AlertTriangle size={16} color="#c4803a" style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 13, color: '#815249', lineHeight: 1.6 }}>
                  By sending this request, you confirm that <strong>{foundUser.name}</strong> has verbally
                  agreed to guarantee your future loan. An email notification will be sent{' '}
                  <strong>only to their registered email</strong>. They must approve before you can use them
                  when creating a loan.
                </p>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading || !foundUser || !guaranteeAmt}
                style={{ marginTop: 4 }}
              >
                {loading
                  ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'white', borderColor: 'rgba(255,255,255,0.3)' }} />Sending…</>
                  : <><Send size={16} /> Send Guarantee Request to {foundUser.name}</>
                }
              </button>
            </form>
          </div>
        )}

        {/* How it works */}
        <div style={{
          background: 'rgba(96,24,11,0.04)', border: '1px solid rgba(96,24,11,0.1)',
          borderRadius: 14, padding: '20px 24px',
        }}>
          <h4 style={{ fontSize: 14, fontWeight: 700, color: '#342f30', marginBottom: 12 }}>How Guarantors Work</h4>
          {[
            ['🔍 Search',  'Find the guarantor by their MetaMask wallet address'],
            ['📧 Notify',  'Only they receive the email request — no spam to others'],
            ['📄 Review',  'Guarantor reviews + optionally uploads a verification document'],
            ['✅ Approve', 'Once approved, go to Borrow — they appear as your required guarantor'],
            ['⚠️ Default', 'If you default, the guarantor is liable for the guaranteed ETH amount'],
          ].map(([s, desc]) => (
            <div key={s} style={{ display: 'flex', gap: 12, marginBottom: 8, fontSize: 13 }}>
              <span style={{ fontWeight: 700, minWidth: 86 }}>{s}</span>
              <span style={{ color: '#8a7e80' }}>{desc}</span>
            </div>
          ))}
        </div>

      </main>
      <Footer />
    </div>
  );
}
