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
      toast.success(`Welcome back, ${res.data.user.name}!`, { style: { background: '#1A1040', color: '#fff' }, iconTheme: { primary: '#00C896', secondary: '#fff' } });
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
              <div className="auth-icon-wrap"><LogIn size={28} color="#6B4EFF" /></div>
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

        {/* Right — Video */}
        <div className="auth-split-right">
          <video autoPlay loop muted playsInline className="auth-split-video">
            <source src="/v1.mp4" type="video/mp4" />
          </video>
          <div className="auth-split-video-overlay">
            <img src="/logo.png" alt="Go Secure" style={{ width: 64, height: 64, borderRadius: 14, objectFit: 'contain', marginBottom: '16px' }} />
            <h2>Go Secure</h2>
            <p>Your gateway to decentralized lending</p>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
