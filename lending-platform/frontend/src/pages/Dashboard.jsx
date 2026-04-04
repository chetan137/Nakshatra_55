import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wallet, Mail, Shield, ShieldCheck, LogOut, ChevronRight,
  TrendingUp, TrendingDown, Clock, CheckCircle,
  DollarSign, Activity, History, Plus, Lock, Users, Inbox,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useWallet } from '../hooks/useWallet';
import { useZkProof } from '../hooks/useZkProof';
import { getMyStats } from '../api/loanApi';
import SettlementStatus from '../components/SettlementStatus';

export default function Dashboard() {
  const { user, token, logout } = useAuth();
  const navigate         = useNavigate();
  const wallet           = useWallet();
  const { zkStatus, checkStatus } = useZkProof();
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeNav, setActiveNav] = useState('dashboard');

  useEffect(() => {
    getMyStats()
      .then(r => setStats(r.data.stats))
      .catch(() => {})
      .finally(() => setLoading(false));
    if (token) checkStatus(token);
  }, [token, checkStatus]);

  function handleLogout() {
    logout();
    toast.success('Logged out', { style: { background: '#342f30', color: '#fff' } });
    navigate('/login', { replace: true });
  }

  async function handleConnectWallet() {
    const addr = await wallet.connect();
    if (addr) toast.success(`Wallet connected: ${addr.slice(0, 8)}…`);
  }

  if (!user) return null;

  const isZkVerified = user?.zkVerified || zkStatus?.verified;

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <Activity size={18} />, action: () => setActiveNav('dashboard') },
    ...(user.role === 'borrower' ? [{ id: 'borrow', label: 'Borrow', icon: <TrendingDown size={18} />, action: () => navigate('/borrow') }] : []),
    ...(user.role === 'lender' ? [{ id: 'lend', label: 'Lend', icon: <TrendingUp size={18} />, action: () => navigate('/lend') }] : []),
    { id: 'history',   label: 'History',   icon: <History size={18} />,      action: () => navigate('/history') },
    {
      id: 'zk-verify',
      label: isZkVerified ? 'ZK Verified ✓' : 'ZK Verify',
      icon: isZkVerified ? <ShieldCheck size={18} /> : <Shield size={18} />,
      action: () => navigate('/zk-verify'),
    },
    {
      id: 'guarantor-inbox',
      label: 'Guarantor Inbox',
      icon: <Inbox size={18} />,
      action: () => navigate('/guarantor-inbox'),
    },
  ];

  return (
    <div className="page-dashboard">
      {/* ── Sidebar ── */}
      <aside className="dash-sidebar">
        <div className="dash-sidebar-logo">
          <span style={{ color: '#815249' }}>⬡</span> Go Secure
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
              Welcome back, <span style={{ color: 'var(--accent-bright)' }}>{user.walletAddress?.slice(0, 6)}…{user.walletAddress?.slice(-4)}</span>!
            </h1>
            <p style={{ color: '#8a7e80', fontSize: 14, marginTop: 4 }}>
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="dash-user-pill">
            <div className="dash-avatar">{user.role?.charAt(0).toUpperCase() || '?'}</div>
            <div>
              <span className="text-small" style={{ fontWeight: 600, display: 'block', textTransform: 'capitalize' }}>{user.role || 'No role'}</span>
              <span style={{ fontSize: 11, color: '#8a7e80' }}>{user.walletAddress?.slice(0, 8)}…</span>
            </div>
          </div>
        </header>

        {/* ── Stats Grid ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginBottom: 32 }}>
          <StatCard
            icon={<TrendingDown size={22} color="#60180b" />}
            label="Total Borrowed"
            value={loading ? '…' : `${stats?.totalBorrowed?.toFixed(4) || '0.0000'} ETH`}
            sub={`${stats?.loansAsBorrower || 0} loans`}
            color="#60180b"
          />
          <StatCard
            icon={<TrendingUp size={22} color="#00373f" />}
            label="Total Lent"
            value={loading ? '…' : `${stats?.totalLent?.toFixed(4) || '0.0000'} ETH`}
            sub={`${stats?.loansAsLender || 0} loans`}
            color="#00373f"
          />
          <StatCard
            icon={<Activity size={22} color="#c4803a" />}
            label="Active Loans"
            value={loading ? '…' : (stats?.activeBorrowed || 0) + (stats?.activeLent || 0)}
            sub={`${stats?.activeBorrowed || 0} borrowing · ${stats?.activeLent || 0} lending`}
            color="#c4803a"
          />
          <StatCard
            icon={<CheckCircle size={22} color="#00373f" />}
            label="Successfully Repaid"
            value={loading ? '…' : stats?.repaid || 0}
            sub={stats?.defaulted ? `${stats.defaulted} defaulted` : 'No defaults'}
            color="#00373f"
          />
        </div>

        {/* ── Quick Actions ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginBottom: 32 }}>
          {/* Borrow CTA */}
          {user.role === 'borrower' && (
            <div className="card-dark" style={{ background: 'linear-gradient(135deg, #60180b, #815249)' }}>
              <h3 className="card-heading" style={{ color: 'white', marginBottom: 8 }}>
                <TrendingDown size={20} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                Need Funds?
              </h3>
              <p style={{ color: '#d4b8b3', marginBottom: 20, fontSize: 14 }}>
                Deposit crypto collateral and get ETH instantly. Smart contract handles everything.
              </p>
              <button className="btn btn-accent" onClick={() => navigate('/borrow')}>
                <Plus size={16} /> Request Loan <ChevronRight size={16} />
              </button>
            </div>
          )}

          {/* Lend CTA */}
          {user.role === 'lender' && (
            <div className="card-dark" style={{ background: 'linear-gradient(135deg, #002a31, #00373f)' }}>
              <h3 className="card-heading" style={{ color: 'white', marginBottom: 8 }}>
                <TrendingUp size={20} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                Earn Interest?
              </h3>
              <p style={{ color: '#b3e0d8', marginBottom: 20, fontSize: 14 }}>
                Browse loan requests. Collateral is locked on-chain— your funds are protected.
              </p>
              <button className="btn" style={{ background: 'white', color: '#00373f' }} onClick={() => navigate('/lend')}>
                Browse Loans <ChevronRight size={16} />
              </button>
            </div>
          )}

          {/* Guarantor CTA — Borrower: request guarantor */}
          {user.role === 'borrower' && (
            <div className="card" style={{ border: '1px solid rgba(107,78,255,0.25)', background: 'rgba(107,78,255,0.04)' }}>
              <h3 className="card-heading" style={{ marginBottom: 8, color: '#342f30' }}>
                <Users size={20} style={{ marginRight: 8, verticalAlign: 'middle', color: '#6B4EFF' }} />
                Need a Guarantor?
              </h3>
              <p style={{ color: '#8a7e80', marginBottom: 16, fontSize: 14 }}>
                Add a non-collateral guarantor to your loan. Search by MetaMask wallet address —
                only they get notified.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn" style={{ flex: 1, background: '#6B4EFF', color: 'white', fontSize: 13 }}
                  onClick={() => navigate('/guarantor-request')}>
                  <Users size={14} /> Request Guarantor
                </button>
                <button className="btn btn-secondary" style={{ flex: 1, fontSize: 13 }}
                  onClick={() => navigate('/guarantor-inbox')}>
                  <Inbox size={14} /> My Inbox
                </button>
              </div>
            </div>
          )}

          {/* Guarantor CTA — Lender/any: check inbox */}
          {user.role !== 'borrower' && (
            <div className="card" style={{ border: '1px solid rgba(107,78,255,0.25)', background: 'rgba(107,78,255,0.04)' }}>
              <h3 className="card-heading" style={{ marginBottom: 8, color: '#342f30' }}>
                <Inbox size={20} style={{ marginRight: 8, verticalAlign: 'middle', color: '#6B4EFF' }} />
                Guarantor Inbox
              </h3>
              <p style={{ color: '#8a7e80', marginBottom: 16, fontSize: 14 }}>
                Check if anyone has requested you as a guarantor for their loan.
              </p>
              <button className="btn" style={{ background: '#6B4EFF', color: 'white', fontSize: 13 }}
                onClick={() => navigate('/guarantor-inbox')}>
                View Inbox <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>

        {/* ── ZK Verification Banner ── */}
        {(() => {
          const isZkVerified = user?.zkVerified || zkStatus?.verified;
          return (
            <div style={{
              background: isZkVerified
                ? 'linear-gradient(135deg, rgba(0,55,63,0.08), rgba(0,55,63,0.04))'
                : 'linear-gradient(135deg, rgba(196,128,58,0.10), rgba(96,24,11,0.06))',
              border: `1px solid ${isZkVerified ? 'rgba(0,55,63,0.25)' : 'rgba(196,128,58,0.35)'}`,
              borderRadius: 14, padding: '18px 24px', marginBottom: 24,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexWrap: 'wrap', gap: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {isZkVerified
                  ? <ShieldCheck size={28} color="#00373f" />
                  : <Shield size={28} color="#c4803a" />
                }
                <div>
                  <p style={{ fontWeight: 700, fontSize: 15, color: '#342f30', marginBottom: 2 }}>
                    {isZkVerified ? 'Anonymous Identity: Verified ✓' : 'Anonymous Identity: Not Verified'}
                  </p>
                  <p style={{ fontSize: 13, color: '#8a7e80' }}>
                    {isZkVerified
                      ? `ZK proof active · ${zkStatus?.attestation?.countryCode || 'IN'} · Income & ID attested · Your name stays hidden`
                      : 'Complete ZK verification to borrow. No documents uploaded — powered by Reclaim Protocol (zkTLS).'}
                  </p>
                </div>
              </div>
              {!isZkVerified && (
                <button
                  className="btn"
                  style={{ background: '#60180b', color: 'white', fontSize: 13, whiteSpace: 'nowrap' }}
                  onClick={() => navigate('/zk-verify')}
                >
                  <Lock size={14} style={{ marginRight: 6 }} />
                  Verify Anonymously
                </button>
              )}
              {isZkVerified && (
                <span style={{
                  fontSize: 12, color: '#00373f', fontWeight: 700,
                  background: 'rgba(0,55,63,0.12)', borderRadius: 8, padding: '4px 12px',
                }}>
                  Active
                </span>
              )}
            </div>
          );
        })()}

        {/* ── Settlement Status (borrower only) ── */}
        {user.role === 'borrower' && (
          <div style={{ marginBottom: 28 }}>
            <h2 className="section-heading" style={{ fontSize: 18, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 20 }}>⚖️</span> Settlement Status
            </h2>
            <SettlementStatus userRole={user.role} />
          </div>
        )}

        {/* ── Profile + Wallet ── */}
        <div className="dash-grid">
          {/* Profile Card */}
          <div className="card">
            <h3 className="card-heading" style={{ marginBottom: 20 }}>Profile</h3>
            <div className="dash-info-row">
              <Wallet size={18} color="var(--accent-bright)" />
              <div>
                <span className="text-tiny" style={{ color: 'var(--text-card-muted)' }}>Wallet Address</span>
                <p className="text-body" style={{ wordBreak: 'break-all', fontSize: 13 }}>{user.walletAddress}</p>
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
              <CheckCircle size={18} color="#00373f" />
              <div>
                <span className="text-tiny" style={{ color: 'var(--text-card-muted)' }}>Auth Method</span>
                <p className="text-body" style={{ color: '#00373f' }}>MetaMask ✓</p>
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
                <div style={{ background: 'rgba(129,82,73,0.3)', borderRadius: 10, padding: '10px 14px', marginBottom: 20 }}>
                  <p style={{ fontSize: 11, color: '#d4b8b3', marginBottom: 4 }}>Connected</p>
                  <p style={{ fontSize: 14, color: 'white', fontWeight: 700, wordBreak: 'break-all' }}>
                    {wallet.account}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  {user.role === 'borrower' && (
                    <button className="btn" style={{ flex: 1, background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', fontSize: 13 }}
                      onClick={() => navigate('/borrow')}>
                      Borrow
                    </button>
                  )}
                  {user.role === 'lender' && (
                    <button className="btn" style={{ flex: 1, background: '#60180b', color: 'white', fontSize: 13 }}
                      onClick={() => navigate('/lend')}>
                      Lend
                    </button>
                  )}
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
            <History size={36} color="#815249" style={{ marginBottom: 12 }} />
            <p className="card-heading" style={{ marginBottom: 8 }}>Loan History</p>
            <p style={{ color: '#8a7e80', fontSize: 14, marginBottom: 16 }}>
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
        <span style={{ fontSize: 12, color: '#8a7e80', fontWeight: 600 }}>{label}</span>
        <div style={{ background: `${color}15`, borderRadius: 10, padding: 8 }}>{icon}</div>
      </div>
      <p style={{ fontSize: 24, fontWeight: 800, color, marginBottom: 4 }}>{value}</p>
      <p style={{ fontSize: 12, color: '#8a7e80' }}>{sub}</p>
    </div>
  );
}
