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
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const [userId, setUserId] = useState(null);
  const [otp, setOtp] = useState('');
  const [cooldown, setCooldown] = useState(0);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function validate() {
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
      const res = await register({ name: form.name, email: form.email, password: form.password });
      setUserId(res.data.userId);
      setStep('verify');
      setCooldown(60);
      toast.success(res.data.message, { style: { background: '#1A1040', color: '#fff' }, iconTheme: { primary: '#00C896', secondary: '#fff' } });
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