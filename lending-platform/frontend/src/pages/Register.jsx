import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, UserPlus, MailCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { register, verifyEmail, resendOTP } from '../api/authApi';
import OTPInput from '../components/OTPInput';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export default function Register() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [step, setStep] = useState('register');
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', role: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const [userId, setUserId] = useState(null);
  const [otp, setOtp] = useState('');
  const [cooldown, setCooldown] = useState(0);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function validate() {
    if (!form.role) { toast.error('Please select a role: Borrower or Lender'); return false; }
    if (form.name.trim().length < 2) { toast.error('Name must be at least 2 characters'); return false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { toast.error('Enter a valid email'); return false; }
    if (form.password.length < 6) { toast.error('Password must be at least 6 characters'); return false; }
    if (!/\d/.test(form.password)) { toast.error('Password must contain at least 1 number'); return false; }
    if (form.password !== form.confirmPassword) { toast.error('Passwords do not match'); return false; }
    return true;
  }

  async function handleRegisterSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await register({ name: form.name, email: form.email, password: form.password, role: form.role });
      setUserId(res.data.userId);
      setStep('verify');
      setCooldown(60);
      toast.success(res.data.message, { style: { background: '#342f30', color: '#fff' }, iconTheme: { primary: '#00373f', secondary: '#fff' } });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (step !== 'verify' || cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [step, cooldown]);

  const handleOTPChange = useCallback((val) => setOtp(val), []);

  async function handleVerifySubmit(e) {
    e.preventDefault();
    if (otp.length !== 6) { toast.error('Enter all 6 digits'); return; }
    setLoading(true);
    try {
      const res = await verifyEmail({ userId, otp });
      login(res.data.token, res.data.user);
      toast.success('Email verified successfully!', { style: { background: '#1A1040', color: '#fff' }, iconTheme: { primary: '#00C896', secondary: '#fff' } });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0) return;
    try {
      await resendOTP({ userId });
      setCooldown(60);
      toast.success('OTP resent!', { style: { background: '#1A1040', color: '#fff' }, iconTheme: { primary: '#00C896', secondary: '#fff' } });
    } catch (err) {
      const secs = err.response?.data?.secondsRemaining;
      if (secs) setCooldown(secs);
      toast.error(err.response?.data?.message || 'Failed to resend');
    }
  }

  return (
    <>
      <Navbar />
      <div className="auth-split-page">
        {/* Left — Form */}
        <div className="auth-split-left">
          <div className="auth-card">
            {step === 'register' ? (
              <>
                <div className="auth-header">
                  <div className="auth-icon-wrap"><UserPlus size={28} color="#6B4EFF" /></div>
                  <h1 className="auth-title">Create Account</h1>
                  <p className="auth-subtitle">Start your decentralized lending journey</p>
                </div>

                <form onSubmit={handleRegisterSubmit} className="auth-form">
                  <div className="form-group" style={{ marginBottom: 20 }}>
                    <label>Select Role <span style={{ color: '#ba1a1a' }}>*</span></label>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <div
                        onClick={() => setForm(f => ({ ...f, role: 'borrower' }))}
                        style={{ flex: 1, padding: '14px 12px', borderRadius: 12, border: `2px solid ${form.role === 'borrower' ? '#60180b' : 'rgba(96,24,11,0.2)'}`, background: form.role === 'borrower' ? 'rgba(96,24,11,0.1)' : 'transparent', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s', fontWeight: form.role === 'borrower' ? 700 : 500, color: form.role === 'borrower' ? '#60180b' : 'var(--text-primary)', userSelect: 'none' }}
                      >
                        🏦 Borrower
                      </div>
                      <div
                        onClick={() => setForm(f => ({ ...f, role: 'lender' }))}
                        style={{ flex: 1, padding: '14px 12px', borderRadius: 12, border: `2px solid ${form.role === 'lender' ? '#00373f' : 'rgba(0,55,63,0.2)'}`, background: form.role === 'lender' ? 'rgba(0,55,63,0.1)' : 'transparent', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s', fontWeight: form.role === 'lender' ? 700 : 500, color: form.role === 'lender' ? '#00373f' : 'var(--text-primary)', userSelect: 'none' }}
                      >
                        💰 Lender
                      </div>
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="reg-name">Full Name</label>
                    <input id="reg-name" name="name" placeholder="John Doe" value={form.name} onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="reg-email">Email Address</label>
                    <input id="reg-email" name="email" type="email" placeholder="john@example.com" value={form.email} onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="reg-password">Password</label>
                    <div className="input-icon-wrap">
                      <input id="reg-password" name="password" type={showPw ? 'text' : 'password'} placeholder="Min 6 chars, include a number" value={form.password} onChange={handleChange} />
                      <button type="button" className="input-icon-btn" onClick={() => setShowPw(!showPw)} aria-label="Toggle password">{showPw ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                    </div>
                  </div>
                  <div className="form-group">
                    <label htmlFor="reg-confirm">Confirm Password</label>
                    <input id="reg-confirm" name="confirmPassword" type="password" placeholder="Re-enter your password" value={form.confirmPassword} onChange={handleChange} />
                  </div>

                  <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
                    {loading ? <span className="spinner spinner-sm" /> : 'Create Account'}
                  </button>
                </form>

                <p className="auth-footer">Already have an account? <Link to="/login" className="auth-link">Sign in</Link></p>
              </>
            ) : (
              <>
                <div className="auth-header">
                  <div className="auth-icon-wrap"><MailCheck size={28} color="#6B4EFF" /></div>
                  <h1 className="auth-title">Verify Email</h1>
                  <p className="auth-subtitle">We sent a 6-digit code to<br /><strong>{form.email}</strong></p>
                </div>

                <form onSubmit={handleVerifySubmit} className="auth-form">
                  <OTPInput onChange={handleOTPChange} />
                  <button type="submit" className="btn btn-primary auth-submit" disabled={loading || otp.length !== 6}>
                    {loading ? <span className="spinner spinner-sm" /> : 'Verify Email'}
                  </button>
                </form>

                <p className="auth-footer">
                  Didn't get the code?{' '}
                  <button type="button" className="auth-link-btn" onClick={handleResend} disabled={cooldown > 0}>
                    {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend OTP'}
                  </button>
                </p>
                <p className="auth-footer" style={{ marginTop: '12px' }}>
                  <button type="button" className="auth-link-btn" onClick={() => setStep('register')} disabled={loading} style={{ color: 'var(--text-card-muted)' }}>
                    &larr; Back to Register
                  </button>
                </p>
              </>
            )}
          </div>
        </div>

        {/* Right — Video Panel */}
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
              <h2>Start your<br /><em>DeFi journey</em> today.</h2>
              <p>
                Join 180,000+ users who borrow and lend on-chain with full transparency, zero banks, zero paperwork.
              </p>

              {/* Stats */}
              <div className="auth-split-stats">
                <div className="auth-stat-badge">
                  <strong>$890M+</strong>
                  <span>Loans Issued</span>
                </div>
                <div className="auth-stat-badge">
                  <strong>120+</strong>
                  <span>Countries</span>
                </div>
                <div className="auth-stat-badge">
                  <strong>0</strong>
                  <span>Middlemen</span>
                </div>
              </div>
            </div>

            {/* Features */}
            <div className="auth-split-features">
              {[
                { dot: '#f5d5c8', text: 'Choose Borrower or Lender role' },
                { dot: '#b3e0d8', text: 'Earn up to 15% APY as a lender' },
                { dot: '#c4803a', text: 'Collateral always protected on-chain' },
              ].map(f => (
                <div key={f.text} className="auth-split-feature">
                  <span className="auth-split-feature-dot" style={{ background: f.dot }} />
                  {f.text}
                </div>
              ))}
            </div>

            {/* Trust bar */}
            <div className="auth-split-trust">
              <div className="auth-split-trust-icon">⛓️</div>
              <p>
                <strong>On-Chain Collateral</strong>
                Smart contracts hold collateral— not us
              </p>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}