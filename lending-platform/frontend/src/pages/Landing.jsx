import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Shield, Zap, TrendingUp, Users, ChevronDown,
  Wallet, Globe, Lock, BarChart3, Menu, X, Star, CheckCircle
} from 'lucide-react';

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const stats = [
    { label: 'Total Value Locked', value: '$2.4B+' },
    { label: 'Active Users', value: '180K+' },
    { label: 'Loans Issued', value: '$890M+' },
    { label: 'Countries', value: '120+' },
  ];

  const features = [
    {
      icon: <Shield size={32} color="#6B4EFF" />,
      title: 'Non-Custodial',
      desc: 'You always control your assets. Smart contracts are the only intermediary — fully transparent and audited.',
    },
    {
      icon: <Zap size={32} color="#FF5C34" />,
      title: 'Instant Liquidity',
      desc: 'Borrow against your crypto collateral in minutes. No credit checks, no paperwork, no waiting.',
    },
    {
      icon: <TrendingUp size={32} color="#00C896" />,
      title: 'High Yield Lending',
      desc: 'Earn competitive APY by supplying liquidity to lending pools. Withdraw any time.',
    },
    {
      icon: <Globe size={32} color="#6B4EFF" />,
      title: 'Truly Borderless',
      desc: 'Access decentralized finance from anywhere in the world. No bank account required.',
    },
    {
      icon: <Lock size={32} color="#FF5C34" />,
      title: 'Battle-Tested Security',
      desc: 'Smart contracts audited by top security firms. Multi-sig governance and emergency pause mechanisms.',
    },
    {
      icon: <BarChart3 size={32} color="#00C896" />,
      title: 'Real-Time Markets',
      desc: 'Live interest rates, collateral ratios, and market depth — full on-chain transparency.',
    },
  ];

  const steps = [
    { num: '01', title: 'Connect Wallet', desc: 'Link your MetaMask or any Web3 wallet in one click.' },
    { num: '02', title: 'Deposit Collateral', desc: 'Deposit ETH, BTC, or other supported assets as collateral.' },
    { num: '03', title: 'Borrow or Lend', desc: 'Instantly borrow stablecoins or earn yield by supplying liquidity.' },
    { num: '04', title: 'Manage & Repay', desc: 'Track your positions, repay loans, and withdraw earnings anytime.' },
  ];

  const testimonials = [
    { name: 'Aryan Mehta', role: 'DeFi Trader', text: 'LendChain is the smoothest borrowing experience in DeFi. Got liquidity against my ETH in 3 minutes flat.', rating: 5 },
    { name: 'Sofia Rossi', role: 'Yield Farmer', text: 'I\'ve tried 10 lending protocols. LendChain is the only one where the UI actually makes sense.', rating: 5 },
    { name: 'James Okonkwo', role: 'Crypto Investor', text: 'Earning 12% APY on my stablecoin deposits. Transparent, fast, secure — everything DeFi should be.', rating: 5 },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', overflowX: 'hidden' }}>

      {/* ── Navbar ── */}
      <nav className={`landing-nav${scrolled ? ' landing-nav--scrolled' : ''}`}>
        <div className="landing-nav-inner">
          <span className="navbar-logo">LendChain</span>
          <div className="navbar-links">
            <a href="#features">Features</a>
            <a href="#how-it-works">How it Works</a>
            <a href="#markets">Markets</a>
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
            <a href="#features" onClick={() => setMenuOpen(false)}>Features</a>
            <a href="#how-it-works" onClick={() => setMenuOpen(false)}>How it Works</a>
            <a href="#markets" onClick={() => setMenuOpen(false)}>Markets</a>
            <Link to="/login" onClick={() => setMenuOpen(false)}>Sign In</Link>
            <Link to="/register" className="btn btn-primary" style={{ textAlign: 'center' }} onClick={() => setMenuOpen(false)}>Get Started</Link>
          </div>
        )}
      </nav>

      {/* ── Hero ── */}
      <section className="hero-section">
        <div className="hero-badge">
          <CheckCircle size={14} /> Audited &amp; Battle-Tested Protocol
        </div>
        <h1 className="hero-heading" style={{ textAlign: 'center', maxWidth: '800px' }}>
          Decentralized Lending<br />
          <span className="hero-accent">For Everyone</span>
        </h1>
        <p className="hero-sub">
          Borrow instantly against your crypto assets or earn high yields as a lender.
          No banks. No middlemen. Just code, transparency, and you.
        </p>
        <div className="hero-cta-group">
          <Link to="/register" className="btn btn-primary hero-cta-main">
            Start Borrowing <ArrowRight size={18} />
          </Link>
          <Link to="/register" className="btn btn-ghost hero-cta-sec">
            Start Earning
          </Link>
        </div>
        <a href="#features" className="hero-scroll-hint">
          Explore <ChevronDown size={18} />
        </a>
      </section>

      {/* ── Stats Bar ── */}
      <section className="stats-bar">
        {stats.map((s) => (
          <div key={s.label} className="stat-item">
            <span className="stat-value">{s.value}</span>
            <span className="stat-label">{s.label}</span>
          </div>
        ))}
      </section>

      {/* ── Features ── */}
      <section id="features" className="landing-section">
        <div className="container">
          <div className="section-label">Why LendChain</div>
          <h2 className="section-heading landing-section-title">
            Built for the Future of Finance
          </h2>
          <p className="landing-section-sub">
            Everything you need to lend, borrow, and grow your crypto wealth — all on-chain.
          </p>
          <div className="features-grid">
            {features.map((f) => (
              <div key={f.title} className="feature-card card">
                <div className="feature-icon-wrap">{f.icon}</div>
                <h3 className="card-heading">{f.title}</h3>
                <p className="text-body" style={{ color: 'var(--text-card-muted)' }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it Works ── */}
      <section id="how-it-works" className="landing-section landing-section--dark">
        <div className="container">
          <div className="section-label section-label--light">Simple Process</div>
          <h2 className="section-heading landing-section-title" style={{ color: '#fff' }}>
            Live On-Chain in 4 Steps
          </h2>
          <div className="steps-grid">
            {steps.map((s, i) => (
              <div key={s.num} className="step-card">
                <div className="step-num">{s.num}</div>
                <h3 className="card-heading" style={{ color: '#fff', marginBottom: '10px' }}>{s.title}</h3>
                <p className="text-body" style={{ color: 'var(--text-dark-card-muted)' }}>{s.desc}</p>
                {i < steps.length - 1 && <div className="step-arrow" aria-hidden>→</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Markets Preview ── */}
      <section id="markets" className="landing-section">
        <div className="container">
          <div className="section-label">Live Markets</div>
          <h2 className="section-heading landing-section-title">Top Lending Markets</h2>
          <div className="markets-table">
            <div className="markets-header">
              <span>Asset</span><span>APY (Supply)</span><span>APY (Borrow)</span><span>Liquidity</span><span>Status</span>
            </div>
            {[
              { asset: 'ETH', supply: '4.2%', borrow: '6.8%', liquidity: '$420M', status: 'active' },
              { asset: 'USDC', supply: '8.1%', borrow: '10.4%', liquidity: '$890M', status: 'active' },
              { asset: 'WBTC', supply: '2.9%', borrow: '5.1%', liquidity: '$210M', status: 'active' },
              { asset: 'DAI', supply: '7.3%', borrow: '9.6%', liquidity: '$340M', status: 'active' },
            ].map((m) => (
              <div key={m.asset} className="markets-row">
                <span className="market-asset">
                  <span className="asset-dot" />
                  {m.asset}
                </span>
                <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>{m.supply}</span>
                <span style={{ color: 'var(--accent-secondary)', fontWeight: 600 }}>{m.borrow}</span>
                <span style={{ fontWeight: 500 }}>{m.liquidity}</span>
                <span><span className="status-badge badge-active">{m.status}</span></span>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: '32px' }}>
            <Link to="/register" className="btn btn-primary">Access All Markets <ArrowRight size={16} /></Link>
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="landing-section" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container">
          <div className="section-label">Community</div>
          <h2 className="section-heading landing-section-title">Trusted by Thousands</h2>
          <div className="testimonials-grid">
            {testimonials.map((t) => (
              <div key={t.name} className="card-tinted testimonial-card">
                <div className="testimonial-stars">
                  {Array(t.rating).fill(0).map((_, i) => (
                    <Star key={i} size={16} fill="#FFB547" color="#FFB547" />
                  ))}
                </div>
                <p className="text-body" style={{ color: 'var(--text-primary)', marginBottom: '20px', fontStyle: 'italic' }}>
                  "{t.text}"
                </p>
                <div className="testimonial-author">
                  <div className="testimonial-avatar">{t.name.charAt(0)}</div>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>{t.name}</p>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="cta-banner">
        <div className="container" style={{ textAlign: 'center' }}>
          <Wallet size={48} color="rgba(255,255,255,0.8)" style={{ marginBottom: '24px' }} />
          <h2 className="section-heading" style={{ color: '#fff', marginBottom: '16px' }}>
            Ready to Get Started?
          </h2>
          <p className="text-body" style={{ color: 'rgba(255,255,255,0.75)', marginBottom: '32px', maxWidth: '480px', margin: '0 auto 32px' }}>
            Join 180,000+ users earning and borrowing on the most trusted DeFi lending platform.
          </p>
          <div className="hero-cta-group">
            <Link to="/register" className="btn" style={{ background: '#fff', color: 'var(--accent-primary)', padding: '16px 40px', fontSize: '17px', fontWeight: 700, borderRadius: '50px' }}>
              Create Free Account <ArrowRight size={18} />
            </Link>
            <Link to="/login" className="btn btn-ghost">
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        <div className="container">
          <div className="footer-top">
            <div>
              <span className="navbar-logo" style={{ fontSize: '20px' }}>LendChain</span>
              <p style={{ color: 'var(--text-dark-card-muted)', marginTop: '12px', maxWidth: '260px', fontSize: '14px' }}>
                The open, permissionless lending protocol built on Ethereum.
              </p>
            </div>
            <div className="footer-links-group">
              <div className="footer-col">
                <p className="footer-col-title">Protocol</p>
                <a href="#features">Features</a>
                <a href="#markets">Markets</a>
                <a href="#how-it-works">Docs</a>
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
            <p style={{ color: 'var(--text-dark-card-muted)', fontSize: '13px' }}>
              © {new Date().getFullYear()} LendChain. All rights reserved. Not financial advice.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
