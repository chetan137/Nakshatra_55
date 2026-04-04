import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import OTPInput from '../components/OTPInput';
import { verifyEmail, resendOTP } from '../api/authApi';
import { useAuth } from '../context/AuthContext';

export default function VerifyEmail() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const userId = sessionStorage.getItem('lendchain_userId');
  const email = sessionStorage.getItem('lendchain_email') || '';

  useEffect(() => {
    if (!userId) navigate('/register', { replace: true });
  }, [userId, navigate]);

  // Countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleOTPChange = useCallback((val) => setOtp(val), []);

  async function handleVerify(e) {
    e.preventDefault();
    if (otp.length !== 6) { toast.error('Enter all 6 digits'); return; }
    setLoading(true);
    try {
      const res = await verifyEmail({ userId, otp });
      login(res.data.token, res.data.user);
      sessionStorage.removeItem('lendchain_userId');
      sessionStorage.removeItem('lendchain_email');
      toast.success('Email verified!', { style: { background: '#1A1040', color: '#fff' }, iconTheme: { primary: '#00C896', secondary: '#fff' } });
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
    <div className="page-auth">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-icon-wrap"><MailCheck size={28} color="#6B4EFF" /></div>
          <h1 className="auth-title">Verify Email</h1>
          <p className="auth-subtitle">We sent a 6-digit code to<br /><strong>{email}</strong></p>
        </div>

        <form onSubmit={handleVerify} className="auth-form">
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
      </div>
    </div>
  );
}
