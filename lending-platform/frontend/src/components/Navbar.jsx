import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const isLanding = location.pathname === '/';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // On non-landing pages, navbar is always "scrolled" style (white bg)
  const navClass = `landing-nav${(scrolled || !isLanding) ? ' landing-nav--scrolled' : ''}`;

  return (
    <nav className={navClass}>
      <div className="landing-nav-inner">
        <Link to="/" className="navbar-logo" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="/logo.png" alt="Go Secure" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'contain' }} />
          Go Secure
        </Link>
        <div className="navbar-links">
          {isLanding ? (
            <>
              <a href="#features">Features</a>
              <a href="#how-it-works">How it Works</a>
              <a href="#markets">Markets</a>
            </>
          ) : (
            <>
              <Link to="/">Home</Link>
              <Link to="/dashboard">Dashboard</Link>
            </>
          )}
        </div>
        <div className="landing-nav-actions">
          <Link to="/login" className="btn btn-secondary" style={{ padding: '10px 24px', fontSize: '14px' }}>Sign In</Link>
          <Link to="/register" className="btn btn-primary" style={{ padding: '10px 24px', fontSize: '14px' }}>Get Started</Link>
        </div>
        <button className="mobile-menu-btn" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>
      {menuOpen && (
        <div className="mobile-menu">
          {isLanding ? (
            <>
              <a href="#features" onClick={() => setMenuOpen(false)}>Features</a>
              <a href="#how-it-works" onClick={() => setMenuOpen(false)}>How it Works</a>
              <a href="#markets" onClick={() => setMenuOpen(false)}>Markets</a>
            </>
          ) : (
            <>
              <Link to="/" onClick={() => setMenuOpen(false)}>Home</Link>
              <Link to="/dashboard" onClick={() => setMenuOpen(false)}>Dashboard</Link>
            </>
          )}
          <Link to="/login" onClick={() => setMenuOpen(false)}>Sign In</Link>
          <Link to="/register" className="btn btn-primary" style={{ textAlign: 'center' }} onClick={() => setMenuOpen(false)}>Get Started</Link>
        </div>
      )}
    </nav>
  );
}
