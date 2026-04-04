import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle, XCircle, AlertTriangle, TrendingDown,
  Clock, RefreshCw, ChevronRight, BarChart2,
} from 'lucide-react';
import { getSettlement } from '../api/loanApi';

// ── helpers ────────────────────────────────────────────────────
function fmt(eth) {
  return eth != null ? `${Number(eth).toFixed(4)} ETH` : '—';
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function daysLeft(dueDate) {
  if (!dueDate) return null;
  const diff = Math.ceil((new Date(dueDate) - Date.now()) / 86_400_000);
  return diff;
}

const STATUS_COLORS = {
  active:    { bg: 'rgba(0,55,63,0.09)',   text: '#00373f',  label: 'Active'    },
  pending:   { bg: 'rgba(196,128,58,0.12)', text: '#c4803a',  label: 'Pending'   },
  repaid:    { bg: 'rgba(0,55,63,0.07)',   text: '#00573f',  label: 'Repaid'    },
  defaulted: { bg: 'rgba(186,26,26,0.09)', text: '#ba1a1a',  label: 'Defaulted' },
  cancelled: { bg: 'rgba(100,100,100,0.1)', text: '#8a7e80', label: 'Cancelled' },
};

// ── main component ─────────────────────────────────────────────
export default function SettlementStatus({ userRole }) {
  const navigate = useNavigate();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getSettlement()
      .then(r => setData(r.data.settlement))
      .catch(e => setError(e?.response?.data?.message || 'Failed to load settlement info'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Loading ────────────────────────────────────────────────
  if (loading) return (
    <div className="card" style={{ padding: '28px 24px', textAlign: 'center' }}>
      <span className="spinner" style={{ borderTopColor: '#60180b', borderColor: 'rgba(96,24,11,0.15)' }} />
      <p style={{ marginTop: 14, fontSize: 14, color: '#8a7e80' }}>Loading settlement status…</p>
    </div>
  );

  // ── Error ──────────────────────────────────────────────────
  if (error) return (
    <div className="card" style={{ borderColor: 'rgba(186,26,26,0.3)', background: 'rgba(186,26,26,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <XCircle size={20} color="#ba1a1a" />
        <span style={{ fontWeight: 700, color: '#ba1a1a', fontSize: 15 }}>Could not load settlement data</span>
      </div>
      <p style={{ fontSize: 13, color: '#8a7e80', marginBottom: 16 }}>{error}</p>
      <button className="btn btn-secondary" onClick={load} style={{ fontSize: 13 }}>
        <RefreshCw size={13} style={{ marginRight: 6 }} />Retry
      </button>
    </div>
  );

  if (!data) return null;

  const {
    maxLoansAllowed, activeLoanCount, loansAvailable,
    canRequestNewLoan, totalLoansCompleted, totalLoansDefaulted,
    activeLoans = [],
  } = data;

  const capacityPct = Math.min(100, (activeLoanCount / maxLoansAllowed) * 100);
  const barColor    = canRequestNewLoan ? '#00373f' : '#ba1a1a';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Status banner ─────────────────────────────────── */}
      <div style={{
        borderRadius: 16,
        padding: '20px 24px',
        background: canRequestNewLoan
          ? 'linear-gradient(135deg, rgba(0,55,63,0.07), rgba(0,55,63,0.03))'
          : 'linear-gradient(135deg, rgba(186,26,26,0.07), rgba(186,26,26,0.03))',
        border: `1.5px solid ${canRequestNewLoan ? 'rgba(0,55,63,0.22)' : 'rgba(186,26,26,0.25)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {canRequestNewLoan
            ? <CheckCircle size={28} color="#00373f" />
            : <XCircle    size={28} color="#ba1a1a" />
          }
          <div>
            <p style={{ fontWeight: 800, fontSize: 16, color: '#342f30', marginBottom: 2 }}>
              {canRequestNewLoan
                ? `You can request ${loansAvailable} more loan${loansAvailable !== 1 ? 's' : ''}`
                : 'Loan limit reached — repay a loan first'}
            </p>
            <p style={{ fontSize: 13, color: '#8a7e80' }}>
              {canRequestNewLoan
                ? 'Max 2 concurrent active/pending loans allowed'
                : 'You have 2 active or pending loans. Repay one to unlock a new loan request.'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {canRequestNewLoan && userRole === 'borrower' && (
            <button
              className="btn btn-primary"
              style={{ fontSize: 13, background: '#00373f', whiteSpace: 'nowrap' }}
              onClick={() => navigate('/borrow')}
            >
              <TrendingDown size={14} style={{ marginRight: 6 }} />
              Request Loan
            </button>
          )}
          <button
            className="btn btn-secondary"
            style={{ fontSize: 12, padding: '8px 14px' }}
            onClick={load}
            title="Refresh"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* ── Capacity card ─────────────────────────────────── */}
      <div className="card" style={{ padding: '22px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <h3 className="card-heading" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <BarChart2 size={18} color="var(--accent-bright)" />
            Loan Capacity
          </h3>
          <span style={{ fontSize: 12, color: '#8a7e80', fontWeight: 600,
            background: 'rgba(96,24,11,0.07)', borderRadius: 20, padding: '3px 10px',
          }}>
            Parallel Mode · Max {maxLoansAllowed}
          </span>
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
            <span style={{ fontSize: 13, color: '#8a7e80' }}>Active / Pending Loans</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#342f30' }}>{activeLoanCount} / {maxLoansAllowed}</span>
          </div>
          <div style={{ height: 10, borderRadius: 99, background: 'rgba(96,24,11,0.08)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 99,
              width: `${capacityPct}%`,
              background: canRequestNewLoan
                ? 'linear-gradient(90deg, #00373f, #00879f)'
                : 'linear-gradient(90deg, #ba1a1a, #e85252)',
              transition: 'width 0.5s ease',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 5 }}>
            <span style={{ fontSize: 12, color: canRequestNewLoan ? '#00373f' : '#ba1a1a', fontWeight: 600 }}>
              {loansAvailable} slot{loansAvailable !== 1 ? 's' : ''} available
            </span>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
          {[
            { label: 'Max Allowed',  value: maxLoansAllowed,     color: '#342f30' },
            { label: 'Active Now',   value: activeLoanCount,     color: activeLoanCount >= maxLoansAllowed ? '#ba1a1a' : '#00373f' },
            { label: 'Completed',    value: totalLoansCompleted, color: '#00373f' },
            { label: 'Defaulted',    value: totalLoansDefaulted, color: totalLoansDefaulted > 0 ? '#ba1a1a' : '#8a7e80' },
          ].map(s => (
            <div key={s.label} style={{
              background: 'rgba(96,24,11,0.04)', borderRadius: 12,
              padding: '12px 14px', textAlign: 'center',
            }}>
              <p style={{ fontSize: 22, fontWeight: 800, color: s.color, margin: '0 0 4px' }}>{s.value}</p>
              <p style={{ fontSize: 11, color: '#8a7e80', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Active loans list ──────────────────────────────── */}
      <div className="card" style={{ padding: '22px 24px' }}>
        <h3 className="card-heading" style={{ marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Clock size={18} color="var(--accent-bright)" />
          Active & Pending Loans
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#8a7e80', fontWeight: 500 }}>
            {activeLoans.length} loan{activeLoans.length !== 1 ? 's' : ''}
          </span>
        </h3>

        {activeLoans.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#8a7e80' }}>
            <CheckCircle size={36} color="rgba(0,55,63,0.3)" style={{ marginBottom: 12 }} />
            <p style={{ fontSize: 14, fontWeight: 600 }}>No active or pending loans</p>
            <p style={{ fontSize: 13, marginTop: 4 }}>You&apos;re free to request a new loan.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {activeLoans.map((loan, i) => {
              const sc     = STATUS_COLORS[loan.status] || STATUS_COLORS.pending;
              const days   = daysLeft(loan.dueDate);
              const urgent = days !== null && days <= 3;
              return (
                <div key={loan._id} style={{
                  border: `1px solid ${urgent ? 'rgba(186,26,26,0.3)' : 'var(--border-color)'}`,
                  borderRadius: 14,
                  padding: '16px 18px',
                  background: urgent ? 'rgba(186,26,26,0.03)' : 'rgba(255,248,247,0.6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  flexWrap: 'wrap', gap: 12,
                }}>
                  {/* Left info */}
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#8a7e80' }}>
                        Loan #{i + 1}
                      </span>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 8px',
                        borderRadius: 20, background: sc.bg, color: sc.text,
                      }}>
                        {sc.label}
                      </span>
                      {urgent && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#ba1a1a', display: 'flex', alignItems: 'center', gap: 3 }}>
                          <AlertTriangle size={11} /> Due soon
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '6px 18px' }}>
                      <span style={infoItem}><b>Amount</b>{fmt(loan.principal)}</span>
                      <span style={infoItem}><b>Collateral</b>{fmt(loan.collateral)}</span>
                      <span style={infoItem}><b>Rate</b>{loan.interestRateBps != null ? `${(loan.interestRateBps / 100).toFixed(1)}%` : '—'}</span>
                      <span style={infoItem}><b>Duration</b>{loan.durationDays ? `${loan.durationDays}d` : '—'}</span>
                      {loan.dueDate && (
                        <span style={{ ...infoItem, color: urgent ? '#ba1a1a' : undefined }}>
                          <b>Due</b>{fmtDate(loan.dueDate)}{days !== null ? ` (${days >= 0 ? `${days}d left` : 'overdue'})` : ''}
                        </span>
                      )}
                      {loan.onChainId != null && (
                        <span style={infoItem}><b>On-chain ID</b>#{loan.onChainId}</span>
                      )}
                    </div>
                  </div>

                  {/* Repay button — active loans; Cancel button — pending (unfunded) loans */}
                  {loan.status === 'active' && (
                    <button
                      className="btn"
                      style={{
                        background: urgent ? '#ba1a1a' : '#60180b',
                        color: '#fff', fontSize: 13, whiteSpace: 'nowrap',
                      }}
                      onClick={() => navigate(`/history?repay=${loan._id}`)}
                    >
                      Repay Loan <ChevronRight size={14} />
                    </button>
                  )}
                  {loan.status === 'pending' && (
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: 13, whiteSpace: 'nowrap', color: '#c4803a', borderColor: '#c4803a' }}
                      onClick={() => navigate(`/history`)}
                    >
                      View / Cancel <ChevronRight size={14} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Rules card ────────────────────────────────────── */}
      <div className="card" style={{ padding: '18px 22px', background: 'rgba(0,55,63,0.03)', border: '1px solid rgba(0,55,63,0.12)' }}>
        <h4 style={{ fontSize: 13, fontWeight: 700, color: '#00373f', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 7 }}>
          ⚖️ Settlement Rules (Parallel Mode)
        </h4>
        <ul style={{ fontSize: 13, color: '#8a7e80', lineHeight: 1.9, paddingLeft: 18, margin: 0 }}>
          <li>Maximum <strong style={{ color: '#342f30' }}>2 concurrent</strong> active or pending loans per borrower</li>
          <li>Repay any active loan to free up a slot</li>
          <li>Defaulted loans <strong style={{ color: '#ba1a1a' }}>reduce your credit score</strong> and affect future eligibility</li>
          <li>Collateral is released on-chain upon full repayment</li>
          <li>Status auto-updates after on-chain transaction confirmation</li>
        </ul>
      </div>
    </div>
  );
}

const infoItem = {
  display: 'flex', flexDirection: 'column', gap: 1,
  fontSize: 12, color: '#342f30',
  '& b': { fontSize: 10, color: '#8a7e80', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, display: 'block' },
};
