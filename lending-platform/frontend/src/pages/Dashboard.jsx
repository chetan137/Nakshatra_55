import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wallet, Mail, Shield, ShieldCheck, LogOut, ChevronRight,
  TrendingUp, TrendingDown, Clock, CheckCircle,
  DollarSign, Activity, History, Plus, Lock, Users, Inbox, Bell, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useWallet } from '../hooks/useWallet';
import { useZkProof } from '../hooks/useZkProof';
import { getMyStats } from '../api/loanApi';
import SettlementStatus from '../components/SettlementStatus';
import { useNotifications } from '../hooks/useNotifications';

export default function Dashboard() {
  const { user, token, logout } = useAuth();
  const navigate         = useNavigate();
  const wallet           = useWallet();
  const { zkStatus, checkStatus } = useZkProof();
  const [stats,    setStats]    = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [ethPrice, setEthPrice] = useState(3000);
  const [activeNav, setActiveNav] = useState('dashboard');
  const [withdrawModal, setWithdrawModal] = useState(false);
  const [withdrawStep,  setWithdrawStep]  = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);

  const { notifications, unreadCount, markAllRead, dismiss } = useNotifications();
  const prevNotifLen = useRef(0);

  // Show a toast whenever a new notification arrives
  useEffect(() => {
    if (notifications.length > prevNotifLen.current) {
      const latest = notifications[0];
      if (latest) {
        toast(latest.title, {
          icon: '🔔',
          duration: 4000,
          style: { fontWeight: 600, fontSize: 14 },
        });
      }
    }
    prevNotifLen.current = notifications.length;
  }, [notifications]);

  useEffect(() => {
    getMyStats()
      .then(r => setStats(r.data.stats))
      .catch(() => {})
      .finally(() => setLoading(false));
    if (token) checkStatus(token);
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd')
      .then(r => r.json())
      .then(d => { if (d?.ethereum?.usd) setEthPrice(d.ethereum.usd); })
      .catch(() => {});
  }, [token, checkStatus]);

  function fmtUSD(ethVal) {
    const usd = (parseFloat(ethVal) || 0) * ethPrice;
    return '$' + usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function handleLogout() {
    logout();
    toast.success('Logged out', { style: { background: '#342f30', color: '#fff' } });
    navigate('/login', { replace: true });
  }

  async function handleConnectWallet() {
    const addr = await wallet.connect();
    if (addr) toast.success(`Wallet connected: ${addr.slice(0, 8)}…`);
  }

  function handleWithdraw() {
    setWithdrawStep(1);
    setWithdrawModal(true);
    // Simulate processing steps
    setTimeout(() => setWithdrawStep(2), 2800);
  }

  if (!user) return null;

  const isZkVerified = user?.zkVerified || zkStatus?.verified;

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <Activity size={18} />, action: () => setActiveNav('dashboard') },
    ...(user.role === 'borrower' ? [{ id: 'borrow', label: 'Borrow', icon: <TrendingDown size={18} />, action: () => navigate('/borrow') }] : []),
    ...(user.role === 'lender' ? [{ id: 'lend', label: 'Lend', icon: <TrendingUp size={18} />, action: () => navigate('/lend') }] : []),
    { id: 'history',   label: 'History',   icon: <History size={18} />,      action: () => navigate('/history') },
    {
      id: 'guarantor-inbox',
      label: 'Guarantor Inbox',
      icon: <Inbox size={18} />,
      action: () => navigate('/guarantor-inbox'),
    },
  ];

  return (
    <div className="page-dashboard">

      {/* ── Withdraw Demo Modal ── */}
      {withdrawModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div style={{
            background: 'white', borderRadius: 24, padding: 36,
            maxWidth: 420, width: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
            textAlign: 'center',
          }}>
            {withdrawStep === 1 && (
              <>
                {/* Processing state */}
                <div style={{
                  width: 72, height: 72, borderRadius: '50%',
                  background: 'linear-gradient(135deg,#60180b,#815249)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 20px', animation: 'spin 1.2s linear infinite',
                }}>
                  <DollarSign size={32} color="white" />
                </div>
                <h2 style={{ fontWeight: 800, fontSize: 22, color: '#342f30', marginBottom: 8 }}>Processing Withdrawal</h2>
                <p style={{ color: '#8a7e80', fontSize: 15, marginBottom: 28, lineHeight: 1.6 }}>
                  Transferring <strong style={{ color: '#60180b' }}>{fmtUSD(stats?.totalBorrowed || 0)}</strong> to your bank account…
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left' }}>
                  {[
                    { label: 'Verifying identity', done: true },
                    { label: 'Converting ETH to USD',  done: true },
                    { label: 'Initiating bank transfer', done: false, active: true },
                  ].map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10,
                      background: s.active ? 'rgba(96,24,11,0.05)' : 'transparent',
                      borderRadius: 10, padding: '8px 12px' }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                        background: s.done ? '#00373f' : (s.active ? '#c4803a' : '#e5e7eb'),
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {s.done ? <CheckCircle size={13} color="white" /> : null}
                        {s.active ? <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'white', animation: 'pulse 1s infinite' }} /> : null}
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 600, color: s.done ? '#342f30' : (s.active ? '#c4803a' : '#9ca3af') }}>{s.label}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            {withdrawStep === 2 && (
              <>
                {/* Success state */}
                <div style={{
                  width: 80, height: 80, borderRadius: '50%',
                  background: 'linear-gradient(135deg,#00373f,#00879f)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 20px',
                }}>
                  <CheckCircle size={40} color="white" />
                </div>
                <h2 style={{ fontWeight: 900, fontSize: 26, color: '#00373f', marginBottom: 6 }}>Withdrawal Successful!</h2>
                <p style={{ color: '#8a7e80', fontSize: 15, marginBottom: 8 }}>Amount transferred to your bank account</p>
                <div style={{
                  background: 'linear-gradient(135deg,#e6f0ef,#d1fae5)',
                  borderRadius: 16, padding: '20px 24px', margin: '20px 0',
                  border: '2px solid rgba(0,55,63,0.2)',
                }}>
                  <p style={{ fontSize: 13, color: '#8a7e80', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Amount Credited</p>
                  <p style={{ fontSize: 36, fontWeight: 900, color: '#00373f', margin: '0 0 6px' }}>{fmtUSD(stats?.totalBorrowed || 0)}</p>
                  <p style={{ fontSize: 13, color: '#8a7e80' }}>Bank A/C •••• 4782 &nbsp;·&nbsp; Ref: LC{Date.now().toString().slice(-6)}</p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    className="btn"
                    style={{ flex: 1, background: '#00373f', color: 'white', fontSize: 15, padding: '12px 20px', fontWeight: 700 }}
                    onClick={() => { setWithdrawModal(false); setWithdrawStep(0); }}
                  >
                    Done
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {/* ── Sidebar ── */}
      <aside className="dash-sidebar">
        <div
          className="dash-sidebar-logo"
          onClick={() => navigate('/')}
          style={{
            cursor: 'pointer',
            padding: '14px 16px',
            background: 'linear-gradient(135deg, rgba(248, 243, 243, 0.97), rgba(76, 233, 214, 0.02))',
            borderRadius: '12px',
            marginBottom: '32px',
            border: '1px solid rgba(96, 24, 11, 0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            color: 'black',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 12px rgba(96, 24, 11, 0.08)' }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}
          title="Go to Home Page"
        >
          <div style={{
            background: 'linear-gradient(135deg, #60180b, #815249)',
            borderRadius: '10px',
            width: '38px',
            height: '38px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'black',
            boxShadow: '0 4px 10px rgba(240, 225, 222, 0.3)'
          }}>
            <ShieldCheck size={20} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 800, fontSize: '18px', color: '#100f0fff', letterSpacing: '-0.3px', lineHeight: '1.2' }}>Go Secure</span>
            <span style={{ fontSize: '11px', color: '#60180b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>← Back to Home</span>
          </div>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>

            {/* ── Bell ── */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => { setNotifOpen(o => !o); if (!notifOpen) markAllRead(); }}
                style={{
                  background: unreadCount > 0 ? 'linear-gradient(135deg,#60180b,#815249)' : '#f1f5f9',
                  border: 'none', borderRadius: '50%', width: 42, height: 42,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', transition: 'all 0.2s', position: 'relative',
                }}
                title="Notifications"
              >
                <Bell size={20} color={unreadCount > 0 ? 'white' : '#8a7e80'} />
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute', top: -4, right: -4,
                    background: '#ba1a1a', color: 'white',
                    borderRadius: '50%', width: 18, height: 18,
                    fontSize: 11, fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '2px solid white',
                  }}>{unreadCount > 9 ? '9+' : unreadCount}</span>
                )}
              </button>

              {/* Dropdown */}
              {notifOpen && (
                <div style={{
                  position: 'absolute', top: 52, right: 0, width: 360,
                  background: 'white', borderRadius: 18,
                  boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
                  border: '1px solid rgba(0,0,0,0.06)', zIndex: 500,
                  maxHeight: 480, display: 'flex', flexDirection: 'column', overflow: 'hidden',
                }}>
                  <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 800, fontSize: 16, color: '#342f30' }}>🔔 Notifications</span>
                    <button onClick={() => setNotifOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8a7e80', padding: 4 }}>
                      <X size={16} />
                    </button>
                  </div>

                  <div style={{ overflowY: 'auto', flex: 1 }}>
                    {notifications.length === 0 ? (
                      <div style={{ padding: '36px 20px', textAlign: 'center', color: '#8a7e80' }}>
                        <Bell size={32} style={{ marginBottom: 10, opacity: 0.3 }} />
                        <p style={{ fontSize: 14, fontWeight: 600 }}>All caught up!</p>
                        <p style={{ fontSize: 13 }}>No new notifications yet.</p>
                      </div>
                    ) : (
                      notifications.map(n => (
                        <div key={n.id} style={{
                          padding: '14px 20px',
                          borderBottom: '1px solid #f8fafc',
                          background: n.read ? 'white' : 'rgba(96,24,11,0.03)',
                          display: 'flex', gap: 12, alignItems: 'flex-start',
                          transition: 'background 0.15s',
                        }}
                          onMouseEnter={e => e.currentTarget.style.background = '#fef8f7'}
                          onMouseLeave={e => e.currentTarget.style.background = n.read ? 'white' : 'rgba(96,24,11,0.03)'}
                        >
                          <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => { setNotifOpen(false); navigate(n.link); }}>
                            <p style={{ fontWeight: 700, fontSize: 14, color: '#342f30', margin: '0 0 2px' }}>{n.title}</p>
                            <p style={{ fontSize: 13, color: '#8a7e80', margin: '0 0 4px', lineHeight: 1.4 }}>{n.body}</p>
                            <p style={{ fontSize: 11, color: '#c4b0b0', margin: 0 }}>
                              {n.time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          <button onClick={() => dismiss(n.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c4b0b0', padding: '2px 4px', flexShrink: 0 }}>
                            <X size={13} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── User pill ── */}
            <div className="dash-user-pill">
              <div className="dash-avatar">{user.role?.charAt(0).toUpperCase() || '?'}</div>
              <div>
                <span className="text-small" style={{ fontWeight: 600, display: 'block', textTransform: 'capitalize' }}>{user.role || 'No role'}</span>
                <span style={{ fontSize: 11, color: '#8a7e80' }}>{user.walletAddress?.slice(0, 8)}…</span>
              </div>
            </div>
          </div>
        </header>

        {/* ── Stats Grid ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginBottom: 32 }}>
          {user.role === 'borrower' && (
            <>
              <StatCard
                icon={<TrendingDown size={28} color="#ffffff" />}
                label="Total Borrowed"
                value={loading ? '…' : fmtUSD(stats?.totalBorrowed || 0)}
                sub={`${stats?.loansAsBorrower || 0} loans`}
                color="#ffffff"
                highlight={true}
                bgGradient="linear-gradient(135deg, #60180b, #815249)"
              />
              {/* Withdraw Button */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(135deg, #fff8f7, #fef2f0)',
                borderRadius: 20, border: '2px dashed rgba(96,24,11,0.2)',
                padding: '20px 16px', flexDirection: 'column', gap: 10,
                cursor: 'pointer', transition: 'all 0.2s',
              }}
                onClick={handleWithdraw}
                onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(96,24,11,0.5)'; e.currentTarget.style.background='linear-gradient(135deg,#fef2f0,#fde8e0)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(96,24,11,0.2)'; e.currentTarget.style.background='linear-gradient(135deg,#fff8f7,#fef2f0)'; }}
              >
                <div style={{ background: 'linear-gradient(135deg,#60180b,#815249)', borderRadius: 14, padding: 12 }}>
                  <DollarSign size={26} color="white" />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontWeight: 800, fontSize: 16, color: '#342f30', margin: '0 0 2px' }}>Withdraw Funds</p>
                  <p style={{ fontSize: 13, color: '#8a7e80', margin: 0 }}>Transfer to your bank account</p>
                </div>
              </div>
            </>
          )}
          {user.role === 'lender' && (
            <StatCard
              icon={<TrendingUp size={28} color="#ffffff" />}
              label="Total Lent"
              value={loading ? '…' : fmtUSD(stats?.totalLent || 0)}
              sub={`${stats?.loansAsLender || 0} loans`}
              color="#ffffff"
              highlight={true}
              bgGradient="linear-gradient(135deg, #002a31, #00373f)"
            />
          )}
          <StatCard
            icon={<Activity size={28} color="#c4803a" />}
            label="Active Loans"
            value={loading ? '…' : (stats?.activeBorrowed || 0) + (stats?.activeLent || 0)}
            sub={`${stats?.activeBorrowed || 0} borrowing · ${stats?.activeLent || 0} lending`}
            color="#c4803a"
          />
          <StatCard
            icon={<CheckCircle size={28} color="#00373f" />}
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
                Deposit crypto collateral and get funds instantly. Smart contract handles everything.
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

function StatCard({ icon, label, value, sub, color, highlight, bgGradient }) {
  return (
    <div className={highlight ? "card-dark" : "card"} style={{ textAlign: 'left', background: bgGradient || undefined }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: highlight ? 18 : 16 }}>
        <span style={{ fontSize: highlight ? 16 : 14, color: highlight ? 'rgba(255,255,255,0.8)' : '#8a7e80', fontWeight: 700 }}>{label}</span>
        <div style={{ background: highlight ? 'rgba(255,255,255,0.15)' : `${color}15`, borderRadius: '12px', padding: '10px' }}>{icon}</div>
      </div>
      <p style={{ fontSize: highlight ? 36 : 32, fontWeight: 800, color, marginBottom: 8 }}>{value}</p>
      <p style={{ fontSize: highlight ? 15 : 14, color: highlight ? 'rgba(255,255,255,0.6)' : '#8a7e80', fontWeight: 600 }}>{sub}</p>
    </div>
  );
}
