import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogIn, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { login as loginAPI } from '../api/authApi';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.email || !form.password) { toast.error('Please fill in all fields'); return; }
    setLoading(true);
    try {
      const res = await loginAPI(form);
      login(res.data.token, res.data.user);
      toast.success(`Welcome back, ${res.data.user.name}!`, { style: { background: '#342f30', color: '#fff' }, iconTheme: { primary: '#00373f', secondary: '#fff' } });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const data = err.response?.data;
      if (data?.needsVerification) {
        sessionStorage.setItem('lendchain_userId', data.userId);
        sessionStorage.setItem('lendchain_email', form.email);
        toast.error(data.message);
        navigate('/verify-email');
      } else {
        toast.error(data?.message || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Navbar />
      <div className="auth-split-page">
        {/* Left — Form */}
        <div className="auth-split-left">
          <div className="auth-card">
            <div className="auth-header">
              <div className="auth-icon-wrap"><LogIn size={28} color="#60180b" /></div>
              <h1 className="auth-title">Welcome Back</h1>
              <p className="auth-subtitle">Sign in to your Go Secure account</p>
            </div>

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="form-group">
                <label htmlFor="login-email">Email Address</label>
                <input id="login-email" name="email" type="email" placeholder="john@example.com" value={form.email} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label htmlFor="login-password">Password</label>
                <div className="input-icon-wrap">
                  <input id="login-password" name="password" type={showPw ? 'text' : 'password'} placeholder="Enter your password" value={form.password} onChange={handleChange} />
                  <button type="button" className="input-icon-btn" onClick={() => setShowPw(!showPw)} aria-label="Toggle password">{showPw ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                </div>
              </div>

              <div style={{ textAlign: 'right', marginTop: '-8px' }}>
                <Link to="/forgot-password" className="auth-link text-small">Forgot password?</Link>
              </div>

              <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
                {loading ? <span className="spinner spinner-sm" /> : 'Sign In'}
              </button>
            </form>

            <p className="auth-footer">Don't have an account? <Link to="/register" className="auth-link">Create one</Link></p>
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
              <h2>Welcome back<br />to <em>DeFi done right.</em></h2>
              <p>
                Borrow against crypto collateral or earn competitive yields— all secured by smart contracts, no middlemen.
              </p>

              {/* Stats */}
              <div className="auth-split-stats">
                <div className="auth-stat-badge">
                  <strong>$2.4B+</strong>
                  <span>Total Value Locked</span>
                </div>
                <div className="auth-stat-badge">
                  <strong>180K+</strong>
                  <span>Active Users</span>
                </div>
                <div className="auth-stat-badge">
                  <strong>12% APY</strong>
                  <span>Avg. Lender Return</span>
                </div>
              </div>
            </div>

            {/* Features */}
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

            {/* Trust bar */}
            <div className="auth-split-trust">
              <div className="auth-split-trust-icon">🔒</div>
              <p>
                <strong>Bank-grade Security</strong>
                Audited smart contracts, no custodial risk
              </p>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
