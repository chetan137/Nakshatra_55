import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, LayoutDashboard, TrendingDown, TrendingUp, Clock, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled,  setScrolled]  = useState(false);
  const location   = useLocation();
  const navigate   = useNavigate();
  const { isAuthenticated, user, logout } = useAuth();
  const isLanding  = location.pathname === '/';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => setMenuOpen(false), [location.pathname]);

  const navClass = `landing-nav${(scrolled || !isLanding) ? ' landing-nav--scrolled' : ''}`;

  function handleLogout() {
    logout();
    navigate('/');
  }

  return (
    <nav className={navClass}>
      <div className="landing-nav-inner">
        {/* Logo */}
        <Link to="/" className="navbar-logo" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/logo.png" alt="Go Secure" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'contain' }} />
          Go Secure
        </Link>

        {/* Desktop links */}
        <div className="navbar-links">
          {isLanding ? (
            <>
              <a href="#features">Features</a>
              <a href="#how-it-works">How it Works</a>
              <a href="#markets">Markets</a>
            </>
          ) : isAuthenticated ? (
            <>
              <Link to="/dashboard">Dashboard</Link>
              {user?.role === 'borrower' && <Link to="/borrow">Borrow</Link>}
              {user?.role === 'lender'   && <Link to="/lend">Lend</Link>}
              <Link to="/history">History</Link>
            </>
          ) : (
            <>
              <Link to="/">Home</Link>
              <a href="#features">Features</a>
            </>
          )}
        </div>

        {/* Desktop CTA */}
        <div className="landing-nav-actions">
          {isAuthenticated ? (
            <>
              <span style={{ fontSize: 13, color: 'var(--text-card-muted)', fontFamily: 'monospace' }}>
                {user?.walletAddress?.slice(0, 6)}…{user?.walletAddress?.slice(-4)}
              </span>
              <button
                className="btn btn-secondary"
                style={{ padding: '10px 20px', fontSize: 14 }}
                onClick={handleLogout}
              >
                <LogOut size={14} style={{ marginRight: 6 }} />
                Disconnect
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-secondary" style={{ padding: '10px 24px', fontSize: 14 }}>
                Sign In
              </Link>
              <Link to="/login" className="btn btn-primary" style={{ padding: '10px 24px', fontSize: 14 }}>
                Get Started
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button className="mobile-menu-btn" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="mobile-menu">
          {isLanding ? (
            <>
              <a href="#features"     onClick={() => setMenuOpen(false)}>Features</a>
              <a href="#how-it-works" onClick={() => setMenuOpen(false)}>How it Works</a>
              <a href="#markets"      onClick={() => setMenuOpen(false)}>Markets</a>
            </>
          ) : isAuthenticated ? (
            <>
              <Link to="/dashboard" onClick={() => setMenuOpen(false)}>Dashboard</Link>
              {user?.role === 'borrower' && <Link to="/borrow"  onClick={() => setMenuOpen(false)}>Borrow</Link>}
              {user?.role === 'lender'   && <Link to="/lend"    onClick={() => setMenuOpen(false)}>Lend</Link>}
              <Link to="/history"   onClick={() => setMenuOpen(false)}>History</Link>
            </>
          ) : (
            <Link to="/" onClick={() => setMenuOpen(false)}>Home</Link>
          )}

          {isAuthenticated ? (
            <button
              className="btn btn-secondary"
              style={{ textAlign: 'center', width: '100%', marginTop: 8 }}
              onClick={() => { handleLogout(); setMenuOpen(false); }}
            >
              Disconnect Wallet
            </button>
          ) : (
            <>
              <Link to="/login" onClick={() => setMenuOpen(false)}>Sign In</Link>
              <Link to="/login" className="btn btn-primary" style={{ textAlign: 'center' }} onClick={() => setMenuOpen(false)}>
                Get Started
              </Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
