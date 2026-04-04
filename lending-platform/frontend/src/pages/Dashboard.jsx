import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, Mail, Shield, LogOut, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    toast.success('Logged out', { style: { background: '#1A1040', color: '#fff' } });
    navigate('/login', { replace: true });
  }

  function handleConnectWallet() {
    toast('MetaMask integration coming soon!', { icon: '🦊', style: { background: '#1A1040', color: '#fff' } });
  }

  if (!user) return null;

  return (
    <div className="page-dashboard">
      {/* Sidebar */}
      <aside className="dash-sidebar">
        <div className="dash-sidebar-logo">LendChain</div>
        <nav className="dash-sidebar-nav">
          <a href="#" className="dash-nav-item active">Dashboard</a>
          <a href="#" className="dash-nav-item">Lend</a>
          <a href="#" className="dash-nav-item">Borrow</a>
          <a href="#" className="dash-nav-item">Markets</a>
          <a href="#" className="dash-nav-item">History</a>
        </nav>
        <button className="btn btn-danger dash-logout" onClick={handleLogout}>
          <LogOut size={18} style={{ marginRight: '8px' }} /> Logout
        </button>
      </aside>

      {/* Main Content */}
      <main className="dash-main">
        <header className="dash-topbar">
          <h1 className="section-heading" style={{ color: 'var(--text-card-primary)' }}>
            Welcome back, <span style={{ color: 'var(--accent-bright)' }}>{user.name}</span>!
          </h1>
          <div className="dash-user-pill">
            <div className="dash-avatar">{user.name?.charAt(0).toUpperCase()}</div>
            <span className="text-small" style={{ fontWeight: 600 }}>{user.name}</span>
          </div>
        </header>

        <div className="dash-grid">
          {/* Profile Card */}
          <div className="card">
            <h3 className="card-heading" style={{ marginBottom: '20px' }}>Profile</h3>
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
              <Wallet size={18} color="var(--accent-bright)" />
              <div>
                <span className="text-tiny" style={{ color: 'var(--text-card-muted)' }}>Wallet</span>
                <p className="text-body">{user.walletAddress || 'Not connected'}</p>
              </div>
            </div>
          </div>

          {/* Wallet Card */}
          <div className="card-dark">
            <h3 className="card-heading" style={{ color: 'white', marginBottom: '12px' }}>Connect Wallet</h3>
            <p className="text-body" style={{ color: 'var(--text-dark-card-muted)', marginBottom: '24px' }}>
              Link your MetaMask wallet to start lending or borrowing on-chain.
            </p>
            <button className="btn btn-accent" onClick={handleConnectWallet}>
              <Wallet size={18} style={{ marginRight: '8px' }} /> Connect MetaMask <ChevronRight size={18} style={{ marginLeft: '4px' }} />
            </button>
          </div>

          {/* Stats Cards */}
          <div className="card" style={{ textAlign: 'center' }}>
            <p className="text-small" style={{ color: 'var(--text-card-muted)', marginBottom: '8px' }}>Total Lent</p>
            <p className="section-heading" style={{ color: 'var(--color-success)' }}>$0.00</p>
            <span className="status-badge badge-active" style={{ marginTop: '12px', display: 'inline-block' }}>Active</span>
          </div>

          <div className="card" style={{ textAlign: 'center' }}>
            <p className="text-small" style={{ color: 'var(--text-card-muted)', marginBottom: '8px' }}>Total Borrowed</p>
            <p className="section-heading" style={{ color: 'var(--accent-secondary)' }}>$0.00</p>
            <span className="status-badge badge-pending" style={{ marginTop: '12px', display: 'inline-block' }}>No Loans</span>
          </div>
        </div>
      </main>
    </div>
  );
}
