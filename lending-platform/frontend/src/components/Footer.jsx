import React from 'react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="landing-footer">
      <div className="container">
        <div className="footer-top">
          <div>
            <span className="navbar-logo" style={{ fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <img src="/logo.png" alt="Go Secure" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'contain' }} />
              Go Secure
            </span>
            <p style={{ color: 'var(--text-card-muted)', marginTop: '12px', maxWidth: '260px', fontSize: '14px' }}>
              The open, permissionless lending protocol built on Ethereum.
            </p>
          </div>
          <div className="footer-links-group">
            <div className="footer-col">
              <p className="footer-col-title">Protocol</p>
              <Link to="/">Home</Link>
              <a href="#features">Features</a>
              <a href="#markets">Markets</a>
            </div>
            <div className="footer-col">
              <p className="footer-col-title">Account</p>
              <Link to="/register">Sign Up</Link>
              <Link to="/login">Sign In</Link>
              <Link to="/dashboard">Dashboard</Link>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p style={{ color: 'var(--text-card-muted)', fontSize: '13px' }}>
            &copy; {new Date().getFullYear()} Go Secure. All rights reserved. Not financial advice.
          </p>
        </div>
      </div>
    </footer>
  );
}
