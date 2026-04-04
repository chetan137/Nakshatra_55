import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { register } from '../api/authApi';

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

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

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await register({ name: form.name, email: form.email, password: form.password });
      sessionStorage.setItem('lendchain_userId', res.data.userId);
      sessionStorage.setItem('lendchain_email', form.email);
      toast.success(res.data.message, { style: { background: '#1A1040', color: '#fff' }, iconTheme: { primary: '#00C896', secondary: '#fff' } });
      navigate('/verify-email');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-auth">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-icon-wrap"><UserPlus size={28} color="#6B4EFF" /></div>
          <h1 className="auth-title">Create Account</h1>
          <p className="auth-subtitle">Start your decentralized lending journey</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
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
      </div>
    </div>
  );
}
