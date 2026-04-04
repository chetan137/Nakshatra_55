import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wallet, Mail, Shield, LogOut, ChevronRight,
  TrendingUp, TrendingDown, Clock, CheckCircle,
  DollarSign, Activity, History, Plus,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useWallet } from '../hooks/useWallet';
import { getMyStats } from '../api/loanApi';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate         = useNavigate();
  const wallet           = useWallet();
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeNav, setActiveNav] = useState('dashboard');

  useEffect(() => {
    getMyStats()
      .then(r => setStats(r.data.stats))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleLogout() {
    logout();
    toast.success('Logged out', { style: { background: '#1A1040', color: '#fff' } });
    navigate('/login', { replace: true });
  }

  async function handleConnectWallet() {
    const addr = await wallet.connect();
    if (addr) toast.success(`Wallet connected: ${addr.slice(0, 8)}…`);
  }

  if (!user) return null;

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <Activity size={18} />, action: () => setActiveNav('dashboard') },
    { id: 'borrow',    label: 'Borrow',    icon: <TrendingDown size={18} />, action: () => navigate('/borrow') },
    { id: 'lend',      label: 'Lend',      icon: <TrendingUp size={18} />,   action: () => navigate('/lend') },
    { id: 'history',   label: 'History',   icon: <History size={18} />,      action: () => navigate('/history') },
  ];

  return (
    <div className="page-dashboard">
      {/* ── Sidebar ── */}
      <aside className="dash-sidebar">
        <div className="dash-sidebar-logo">
          <span style={{ color: '#6B4EFF' }}>⬡</span> Go Secure
        </div>
        <nav className="dash-sidebar-nav">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={item.action}
              className={`dash-nav-item ${activeNav === item.id ? 'active' : ''}`}
              style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: 10, width: '100%', cursor: 'pointer' }}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </nav>
        <button className="btn btn-danger dash-logout" onClick={handleLogout}>
          <LogOut size={18} /> Logout
        </button>
      </aside>

      {/* ── Main ── */}
      <main className="dash-main">
        {/* Topbar */}
        <header className="dash-topbar">
          <div>
            <h1 className="section-heading" style={{ color: 'var(--text-card-primary)', fontSize: 26 }}>
              Welcome back, <span style={{ color: 'var(--accent-bright)' }}>{user.name}</span>!
            </h1>
            <p style={{ color: '#6B7280', fontSize: 14, marginTop: 4 }}>
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="dash-user-pill">
            <div className="dash-avatar">{user.name?.charAt(0).toUpperCase()}</div>
            <div>
              <span className="text-small" style={{ fontWeight: 600, display: 'block' }}>{user.name}</span>
              <span style={{ fontSize: 11, color: '#6B7280', textTransform: 'capitalize' }}>{user.role}</span>
            </div>
          </div>
        </header>

        {/* ── Stats Grid ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginBottom: 32 }}>
          <StatCard
            icon={<TrendingDown size={22} color="#6B4EFF" />}
            label="Total Borrowed"
            value={loading ? '…' : `${stats?.totalBorrowed?.toFixed(4) || '0.0000'} ETH`}
            sub={`${stats?.loansAsBorrower || 0} loans`}
            color="#6B4EFF"
          />
          <StatCard
            icon={<TrendingUp size={22} color="#00C896" />}
            label="Total Lent"
            value={loading ? '…' : `${stats?.totalLent?.toFixed(4) || '0.0000'} ETH`}
            sub={`${stats?.loansAsLender || 0} loans`}
            color="#00C896"
          />
          <StatCard
            icon={<Activity size={22} color="#FFB547" />}
            label="Active Loans"
            value={loading ? '…' : (stats?.activeBorrowed || 0) + (stats?.activeLent || 0)}
            sub={`${stats?.activeBorrowed || 0} borrowing · ${stats?.activeLent || 0} lending`}
            color="#FFB547"
          />
          <StatCard
            icon={<CheckCircle size={22} color="#00A878" />}
            label="Successfully Repaid"
            value={loading ? '…' : stats?.repaid || 0}
            sub={stats?.defaulted ? `${stats.defaulted} defaulted` : 'No defaults'}
            color="#00A878"
          />
        </div>

        {/* ── Quick Actions ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 32 }}>
          {/* Borrow CTA */}
          <div className="card-dark" style={{ background: 'linear-gradient(135deg, #2D1B69, #6B4EFF)' }}>
            <h3 className="card-heading" style={{ color: 'white', marginBottom: 8 }}>
              <TrendingDown size={20} style={{ marginRight: 8, verticalAlign: 'middle' }} />
              Need Funds?
            </h3>
            <p style={{ color: '#C4B5FD', marginBottom: 20, fontSize: 14 }}>
              Deposit crypto collateral and get ETH instantly. Smart contract handles everything.
            </p>
            <button className="btn btn-accent" onClick={() => navigate('/borrow')}>
              <Plus size={16} /> Request Loan <ChevronRight size={16} />
            </button>
          </div>

          {/* Lend CTA */}
          <div className="card-dark" style={{ background: 'linear-gradient(135deg, #005A3C, #00C896)' }}>
            <h3 className="card-heading" style={{ color: 'white', marginBottom: 8 }}>
              <TrendingUp size={20} style={{ marginRight: 8, verticalAlign: 'middle' }} />
              Earn Interest?
            </h3>
            <p style={{ color: '#B3FFE8', marginBottom: 20, fontSize: 14 }}>
              Browse loan requests. Collateral is locked on-chain— your funds are protected.
            </p>
            <button className="btn" style={{ background: 'white', color: '#005A3C' }} onClick={() => navigate('/lend')}>
              Browse Loans <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* ── Profile + Wallet ── */}
        <div className="dash-grid">
          {/* Profile Card */}
          <div className="card">
            <h3 className="card-heading" style={{ marginBottom: 20 }}>Profile</h3>
            <div className="dash-info-row">
              <Mail size={18} color="var(--accent-bright)" />
              <div>
                <span className="text-tiny" style={{ color: 'var(--text-card-muted)' }}>Email</span>
                <p className="text-body">{user.email}</p>
              </div>
            </div>
            <div className="dash-info-row">
              <Shield size={18} color="var(--accent-bright)" />
              <div>
                <span className="text-tiny" style={{ color: 'var(--text-card-muted)' }}>Role</span>
                <p className="text-body" style={{ textTransform: 'capitalize' }}>{user.role}</p>
              </div>
            </div>
            <div className="dash-info-row">
              <CheckCircle size={18} color={user.isEmailVerified ? '#00C896' : '#FFB547'} />
              <div>
                <span className="text-tiny" style={{ color: 'var(--text-card-muted)' }}>Email Status</span>
                <p className="text-body" style={{ color: user.isEmailVerified ? '#00A878' : '#E65100' }}>
                  {user.isEmailVerified ? 'Verified ✓' : 'Not verified'}
                </p>
              </div>
            </div>
          </div>

          {/* Wallet Card */}
          <div className="card-dark">
            <h3 className="card-heading" style={{ color: 'white', marginBottom: 12 }}>
              <Wallet size={20} style={{ marginRight: 8, verticalAlign: 'middle' }} />
              MetaMask Wallet
            </h3>
            {wallet.account ? (
              <>
                <div style={{ background: 'rgba(107,78,255,0.3)', borderRadius: 10, padding: '10px 14px', marginBottom: 20 }}>
                  <p style={{ fontSize: 11, color: '#C4B5FD', marginBottom: 4 }}>Connected</p>
                  <p style={{ fontSize: 14, color: 'white', fontWeight: 700, wordBreak: 'break-all' }}>
                    {wallet.account}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn" style={{ flex: 1, background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', fontSize: 13 }}
                    onClick={() => navigate('/borrow')}>
                    Borrow
                  </button>
                  <button className="btn" style={{ flex: 1, background: '#6B4EFF', color: 'white', fontSize: 13 }}
                    onClick={() => navigate('/lend')}>
                    Lend
                  </button>
                </div>
              </>
            ) : (
              <>
                <p style={{ color: 'var(--text-dark-card-muted)', marginBottom: 20, fontSize: 14 }}>
                  Connect MetaMask to start lending or borrowing on-chain.
                </p>
                <button className="btn btn-accent" onClick={handleConnectWallet} disabled={wallet.connecting}>
                  {wallet.connecting
                    ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'white', borderColor: 'rgba(255,255,255,0.3)' }} /> Connecting…</>
                    : <><Wallet size={18} /> Connect MetaMask <ChevronRight size={18} /></>
                  }
                </button>
              </>
            )}
          </div>

          {/* View History */}
          <div className="card" style={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => navigate('/history')}>
            <History size={36} color="#6B4EFF" style={{ marginBottom: 12 }} />
            <p className="card-heading" style={{ marginBottom: 8 }}>Loan History</p>
            <p style={{ color: '#6B7280', fontSize: 14, marginBottom: 16 }}>
              View all your loans, track status, repay, and liquidate.
            </p>
            <span className="btn btn-secondary" style={{ fontSize: 14, padding: '10px 20px' }}>
              View History <ChevronRight size={16} />
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({ icon, label, value, sub, color }) {
  return (
    <div className="card" style={{ textAlign: 'left' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 600 }}>{label}</span>
        <div style={{ background: `${color}15`, borderRadius: 10, padding: 8 }}>{icon}</div>
      </div>
      <p style={{ fontSize: 24, fontWeight: 800, color, marginBottom: 4 }}>{value}</p>
      <p style={{ fontSize: 12, color: '#9CA3AF' }}>{sub}</p>
    </div>
  );
}
