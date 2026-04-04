import React from 'react';
import { Link } from 'react-router-dom';
import { Github, Twitter, Globe, Shield, Lock, Zap } from 'lucide-react';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer style={{
      background: '#fff8f7',
      borderTop: '1px solid rgba(96,24,11,0.12)',
      paddingTop: 56,
      paddingBottom: 28,
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px' }}>

        {/* Top grid */}
        <div className="footer-grid" style={{
          display: 'grid',
          gridTemplateColumns: '1.7fr 1fr 1fr 1fr',
          gap: 40,
          marginBottom: 48,
        }}>

          {/* Brand col */}
          <div>
            <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', marginBottom: 14 }}>
              <img src="/logo.png" alt="Go Secure" style={{ width: 36, height: 36, borderRadius: 9, objectFit: 'contain' }} />
              <span style={{ fontSize: 20, fontWeight: 800, color: '#342f30', letterSpacing: '-0.5px' }}>Go Secure</span>
            </Link>
            <p style={{ fontSize: 14, color: '#8a7e80', lineHeight: 1.7, maxWidth: 260 }}>
              The open, permissionless lending protocol built on Ethereum. Borrow and earn — without a middleman.
            </p>

            {/* Trust badges */}
            <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
              {[
                { icon: <Shield size={11} />, label: 'Audited' },
                { icon: <Lock size={11} />,   label: 'Non-custodial' },
                { icon: <Zap size={11} />,    label: 'On-chain' },
              ].map(b => (
                <span key={b.label} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  fontSize: 11, fontWeight: 600,
                  color: '#60180b',
                  background: 'rgba(96,24,11,0.07)',
                  border: '1px solid rgba(96,24,11,0.15)',
                  borderRadius: 20, padding: '4px 10px',
                }}>
                  {b.icon}{b.label}
                </span>
              ))}
            </div>
          </div>

          {/* Protocol col */}
          <div>
            <p style={colTitle}>Protocol</p>
            <Link to="/"       style={linkStyle}>Home</Link>
            <a href="#features"     style={linkStyle}>Features</a>
            <a href="#how-it-works" style={linkStyle}>How it Works</a>
            <a href="#markets"      style={linkStyle}>Markets</a>
          </div>

          {/* Account col */}
          <div>
            <p style={colTitle}>Account</p>
            <Link to="/login"     style={linkStyle}>Connect Wallet</Link>
            <Link to="/dashboard" style={linkStyle}>Dashboard</Link>
            <Link to="/borrow"    style={linkStyle}>Borrow</Link>
            <Link to="/lend"      style={linkStyle}>Lend</Link>
            <Link to="/history"   style={linkStyle}>Loan History</Link>
          </div>

          {/* Legal + Social col */}
          <div>
            <p style={colTitle}>Legal</p>
            <a href="#" style={linkStyle}>Terms of Service</a>
            <a href="#" style={linkStyle}>Privacy Policy</a>
            <a href="#" style={linkStyle}>Risk Disclosure</a>

            <p style={{ ...colTitle, marginTop: 24 }}>Community</p>
            <div style={{ display: 'flex', gap: 10 }}>
              {[
                { icon: <Github size={15} />,  href: 'https://github.com/chetan137/Nakshatra_55' },
                { icon: <Twitter size={15} />, href: '#' },
                { icon: <Globe size={15} />,   href: '#' },
              ].map((s, i) => (
                <a key={i} href={s.href} target="_blank" rel="noopener noreferrer"
                  style={{
                    width: 34, height: 34, borderRadius: 8,
                    background: 'rgba(96,24,11,0.07)',
                    border: '1px solid rgba(96,24,11,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#815249', textDecoration: 'none', transition: 'all 0.18s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#60180b'; e.currentTarget.style.color = '#fff8f7'; e.currentTarget.style.borderColor = '#60180b'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(96,24,11,0.07)'; e.currentTarget.style.color = '#815249'; e.currentTarget.style.borderColor = 'rgba(96,24,11,0.15)'; }}
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(96,24,11,0.1)', marginBottom: 22 }} />

        {/* Bottom row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <p style={{ fontSize: 13, color: '#8a7e80' }}>
            © {year} Go Secure. All rights reserved. Not financial advice.
          </p>
          <p style={{ fontSize: 12, color: '#c4b5b0' }}>
            Built on Ethereum · Sepolia Testnet
          </p>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) { .footer-grid { grid-template-columns: 1fr 1fr !important; } }
        @media (max-width: 480px) { .footer-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </footer>
  );
}

const colTitle = {
  fontSize: 11,
  fontWeight: 700,
  color: '#60180b',
  textTransform: 'uppercase',
  letterSpacing: 1.2,
  marginBottom: 14,
};

const linkStyle = {
  display: 'block',
  fontSize: 14,
  color: '#8a7e80',
  textDecoration: 'none',
  marginBottom: 10,
  transition: 'color 0.15s',
};
