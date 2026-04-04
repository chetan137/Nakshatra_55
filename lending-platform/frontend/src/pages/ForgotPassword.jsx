import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';
import OTPInput from '../components/OTPInput';
import { forgotPassword, verifyResetOTP } from '../api/authApi';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState('email'); // email | otp
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const handleOTPChange = useCallback((val) => setOtp(val), []);

  async function handleSendOTP(e) {
    e.preventDefault();
    if (!email) { toast.error('Enter your email'); return; }
    setLoading(true);
    try {
      await forgotPassword({ email });
      toast.success('If this email exists, an OTP has been sent', { style: { background: '#1A1040', color: '#fff' }, iconTheme: { primary: '#00C896', secondary: '#fff' } });
      setStep('otp');
    } catch {
      toast.error('Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOTP(e) {
    e.preventDefault();
    if (otp.length !== 6) { toast.error('Enter all 6 digits'); return; }
    setLoading(true);
    try {
      const res = await verifyResetOTP({ email, otp });
      sessionStorage.setItem('lendchain_resetToken', res.data.resetToken);
      toast.success('OTP verified! Set your new password', { style: { background: '#1A1040', color: '#fff' }, iconTheme: { primary: '#00C896', secondary: '#fff' } });
      navigate('/reset-password');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-auth">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-icon-wrap"><KeyRound size={28} color="#6B4EFF" /></div>
          <h1 className="auth-title">Forgot Password</h1>
          <p className="auth-subtitle">
            {step === 'email'
              ? "Enter your email and we'll send you a reset code"
              : `Enter the 6-digit code sent to ${email}`}
          </p>
        </div>

        {step === 'email' ? (
          <form onSubmit={handleSendOTP} className="auth-form">
            <div className="form-group">
              <label htmlFor="forgot-email">Email Address</label>
              <input id="forgot-email" type="email" placeholder="john@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
              {loading ? <span className="spinner spinner-sm" /> : 'Send Reset Code'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOTP} className="auth-form">
            <OTPInput onChange={handleOTPChange} />
            <button type="submit" className="btn btn-primary auth-submit" disabled={loading || otp.length !== 6}>
              {loading ? <span className="spinner spinner-sm" /> : 'Verify Code'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
