import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { resetPassword } from '../api/authApi';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);

  const resetToken = sessionStorage.getItem('lendchain_resetToken');

  useEffect(() => {
    if (!resetToken) navigate('/forgot-password', { replace: true });
  }, [resetToken, navigate]);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    if (!/\d/.test(form.password)) { toast.error('Password must contain at least 1 number'); return; }
    if (form.password !== form.confirmPassword) { toast.error('Passwords do not match'); return; }
    setLoading(true);
    try {
      await resetPassword({ resetToken, newPassword: form.password });
      sessionStorage.removeItem('lendchain_resetToken');
      toast.success('Password reset successful!', { style: { background: '#1A1040', color: '#fff' }, iconTheme: { primary: '#00C896', secondary: '#fff' } });
      navigate('/login', { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reset failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Navbar />
      <div className="page-auth" style={{ paddingTop: '100px' }}>
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-icon-wrap"><ShieldCheck size={28} color="#6B4EFF" /></div>
            <h1 className="auth-title">Reset Password</h1>
            <p className="auth-subtitle">Choose a strong new password</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="reset-pw">New Password</label>
              <input id="reset-pw" name="password" type="password" placeholder="Min 6 chars, include a number" value={form.password} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label htmlFor="reset-confirm">Confirm Password</label>
              <input id="reset-confirm" name="confirmPassword" type="password" placeholder="Re-enter password" value={form.confirmPassword} onChange={handleChange} />
            </div>
            <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
              {loading ? <span className="spinner spinner-sm" /> : 'Reset Password'}
            </button>
          </form>

          <p className="auth-footer"><Link to="/login" className="auth-link">Back to Sign In</Link></p>
        </div>
      </div>
      <Footer />
    </>
  );
}
