/**
 * GuarantorInbox.jsx
 *
 * Dual-purpose page:
 *
 * GUARANTOR TAB — Incoming requests for the logged-in user's wallet:
 *  - See each pending request with borrower info, loan details, liability amount
 *  - Upload verification document metadata (bank statement, income proof, etc.)
 *  - Approve or Reject with optional note
 *  - Email goes ONLY to the borrower when they respond
 *
 * MY REQUESTS TAB — Borrower's sent requests:
 *  - See status of all guarantor requests they've sent
 *  - Cancel pending requests
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, UserCheck, UserX, FileText, Upload, CheckCircle,
  AlertTriangle, Clock, XCircle, ChevronRight, Shield, ShieldCheck,
  Inbox, Send as SendIcon, Bell, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useGuarantor } from '../hooks/useGuarantor';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useNotifications } from '../hooks/useNotifications';

const STATUS_CONFIG = {
  pending:   { color: '#c4803a', bg: '#fef2f0', label: 'Pending', icon: <Clock size={13} /> },
  approved:  { color: '#00373f', bg: '#e6f0ef', label: 'Approved', icon: <CheckCircle size={13} /> },
  rejected:  { color: '#ba1a1a', bg: '#fde8e8', label: 'Rejected', icon: <XCircle size={13} /> },
  cancelled: { color: '#8a7e80', bg: '#F3F4F6', label: 'Cancelled', icon: <XCircle size={13} /> },
};

const DOC_TYPES = [
  { value: '',               label: 'Select document type…' },
  { value: 'bank_statement', label: 'Bank Statement' },
  { value: 'income_proof',   label: 'Income Proof / Salary Slip' },
  { value: 'government_id',  label: 'Government ID' },
  { value: 'property_deed',  label: 'Property Deed' },
  { value: 'other',          label: 'Other' },
];

// ── VerifyDocumentButton ─────────────────────────────────────────────────────
// Re-hashes an uploaded file and compares against stored SHA-256 documentHash.
function VerifyDocumentButton({ storedHash }) {
  const [result,  setResult]  = useState(null); // null | 'match' | 'mismatch' | 'manual'
  const [checking, setChecking] = useState(false);
  const fileRef = useRef(null);

  // Only show if the stored hash looks like a SHA-256 (64 hex chars)
  const isSHA256 = /^[0-9a-f]{64}$/.test(storedHash || '');

  async function handleVerifyFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setChecking(true);
    setResult(null);
    try {
      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hex = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0')).join('');
      setResult(hex === storedHash ? 'match' : 'mismatch');
    } catch {
      setResult('error');
    } finally {
      setChecking(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  if (!storedHash) return null;

  return (
    <div style={{ marginTop: 6 }}>
      {isSHA256 ? (
        <>
          <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={handleVerifyFile} />
          <button
            onClick={() => { setResult(null); fileRef.current?.click(); }}
            disabled={checking}
            style={{
              background: 'none', border: '1px solid rgba(0,55,63,0.3)', borderRadius: 8,
              padding: '4px 10px', fontSize: 11, color: '#00373f', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 600,
            }}
          >
            {checking
              ? <><div className="spinner spinner-sm" style={{ width: 10, height: 10, borderWidth: 2 }} /> Verifying…</>
              : <><CheckCircle size={11} /> Verify Document</>
            }
          </button>
          {result === 'match' && (
            <span style={{
              marginLeft: 8, fontSize: 11, color: '#00373f', fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}>
              <CheckCircle size={12} /> Hash matches — document is authentic
            </span>
          )}
          {result === 'mismatch' && (
            <span style={{
              marginLeft: 8, fontSize: 11, color: '#ba1a1a', fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}>
              <AlertTriangle size={12} /> Hash mismatch — document may be tampered
            </span>
          )}
        </>
      ) : (
        <span style={{ fontSize: 11, color: '#8a7e80', fontStyle: 'italic' }}>
          Reference stored (manual entry — not verifiable by hash)
        </span>
      )}
    </div>
  );
}

// ── ApproveModal ─────────────────────────────────────────────────────────────
async function computeSHA256(file) {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function ApproveModal({ request, onConfirm, onClose, loading }) {
  const [docType,      setDocType]      = useState('');
  const [docNote,      setDocNote]      = useState('');
  const [docHash,      setDocHash]      = useState('');
  const [docFileName,  setDocFileName]  = useState('');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [hashing,      setHashing]      = useState(false);
  const fileInputRef = useRef(null);

  async function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploadedFile(file);
    setDocFileName(file.name);
    setHashing(true);
    try {
      const hash = await computeSHA256(file);
      setDocHash(hash);
    } catch {
      setDocHash(file.name); // fallback to filename if crypto unavailable
    } finally {
      setHashing(false);
    }
  }

  function handleRemoveFile() {
    setUploadedFile(null);
    setDocHash('');
    setDocFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        background: 'white', borderRadius: 20, padding: '32px', width: '100%', maxWidth: 480,
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#342f30' }}>Approve Guarantee</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8a7e80' }}>
            <XCircle size={20} />
          </button>
        </div>

        {/* Liability warning removed */}

        {/* Document type */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#342f30', display: 'block', marginBottom: 6 }}>
            Verification Document Type <span style={{ color: '#8a7e80', fontWeight: 400 }}>(optional but recommended)</span>
          </label>
          <select
            value={docType}
            onChange={e => setDocType(e.target.value)}
            style={{
              width: '100%', padding: '10px 12px',
              border: '1px solid rgba(96,24,11,0.2)', borderRadius: 10,
              fontSize: 13, outline: 'none',
            }}
          >
            {DOC_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>

        {docType && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#342f30', display: 'block', marginBottom: 8 }}>
              Upload Document
              <span style={{ fontWeight: 400, color: '#8a7e80' }}> (optional)</span>
            </label>

            {/* File drop zone */}
            {!uploadedFile ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '2px dashed rgba(96,24,11,0.25)', borderRadius: 12,
                  padding: '20px 16px', textAlign: 'center', cursor: 'pointer',
                  background: 'rgba(96,24,11,0.02)', marginBottom: 10,
                  transition: 'border-color 0.2s, background 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(96,24,11,0.5)'; e.currentTarget.style.background = 'rgba(96,24,11,0.05)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(96,24,11,0.25)'; e.currentTarget.style.background = 'rgba(96,24,11,0.02)'; }}
              >
                <Upload size={22} color="#815249" style={{ marginBottom: 8 }} />
                <p style={{ fontSize: 13, color: '#342f30', fontWeight: 600, marginBottom: 2 }}>
                  Click to select a file
                </p>
                <p style={{ fontSize: 11, color: '#8a7e80' }}>
                  PDF, JPG, PNG, DOCX — any format accepted
                </p>
              </div>
            ) : (
              <div style={{
                background: 'rgba(0,55,63,0.06)', border: '1px solid rgba(0,55,63,0.2)',
                borderRadius: 10, padding: '10px 14px', marginBottom: 10,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: hashing ? 6 : (docHash ? 6 : 0) }}>
                  <FileText size={18} color="#00373f" style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#342f30', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {uploadedFile.name}
                    </p>
                    <p style={{ fontSize: 11, color: '#8a7e80' }}>
                      {(uploadedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <button
                    onClick={handleRemoveFile}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ba1a1a', padding: 4, flexShrink: 0 }}
                    title="Remove file"
                  >
                    <XCircle size={16} />
                  </button>
                </div>
                {hashing && (
                  <p style={{ fontSize: 11, color: '#8a7e80', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div className="spinner spinner-sm" style={{ width: 12, height: 12, borderWidth: 2 }} />
                    Computing SHA-256 hash…
                  </p>
                )}
                {!hashing && docHash && (
                  <div style={{
                    background: 'rgba(0,55,63,0.08)', borderRadius: 6, padding: '6px 10px',
                    fontFamily: 'monospace', fontSize: 10, color: '#00373f',
                    wordBreak: 'break-all', lineHeight: 1.5,
                  }}>
                    <span style={{ fontWeight: 700, fontFamily: 'inherit' }}>SHA-256: </span>{docHash}
                  </div>
                )}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />

            {/* Manual hash input — only show when no file is uploaded */}
            {!uploadedFile && (
              <>
                <label style={{ fontSize: 12, color: '#8a7e80', display: 'block', marginBottom: 4 }}>
                  Or enter reference manually (IPFS hash, file name, reference number)
                </label>
                <input
                  type="text"
                  placeholder="e.g. QmXoypiz..., salary_slip_march.pdf, HDFC-2024-03"
                  value={docHash}
                  onChange={e => setDocHash(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 12px',
                    border: '1px solid rgba(96,24,11,0.2)', borderRadius: 10,
                    fontSize: 13, outline: 'none',
                  }}
                />
              </>
            )}
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#342f30', display: 'block', marginBottom: 6 }}>
            Note to Borrower <span style={{ color: '#8a7e80', fontWeight: 400 }}>(optional)</span>
          </label>
          <textarea
            placeholder="E.g. I'm approving your guarantee. Please repay on time."
            value={docNote}
            onChange={e => setDocNote(e.target.value)}
            rows={3}
            maxLength={300}
            style={{
              width: '100%', padding: '10px 12px',
              border: '1px solid rgba(96,24,11,0.2)', borderRadius: 10,
              fontSize: 13, outline: 'none', resize: 'vertical',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            className="btn"
            style={{ flex: 1, background: '#00373f', color: 'white' }}
            onClick={() => onConfirm({ documentFile: uploadedFile || null, documentHash: docHash || null, documentFileName: docFileName || null, documentType: docType || null, guarantorNote: docNote })}
            disabled={loading || hashing}
          >
            {loading
              ? <div className="spinner spinner-sm" style={{ borderTopColor: 'white', borderColor: 'rgba(255,255,255,0.3)' }} />
              : <UserCheck size={16} />
            }
            Confirm Approval
          </button>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose} disabled={loading}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── RejectModal ──────────────────────────────────────────────────────────────
function RejectModal({ request, onConfirm, onClose, loading }) {
  const [note, setNote] = useState('');
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{ background: 'white', borderRadius: 20, padding: '32px', width: '100%', maxWidth: 440 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#342f30', marginBottom: 16 }}>Decline Request</h2>
        <p style={{ fontSize: 14, color: '#8a7e80', marginBottom: 20 }}>
          You're declining the guarantee request from <strong>{request.borrower?.walletAddress?.slice(0,6)}…</strong>.
          They will be notified by email (if configured).
        </p>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#342f30', display: 'block', marginBottom: 6 }}>
            Reason <span style={{ color: '#8a7e80', fontWeight: 400 }}>(optional)</span>
          </label>
          <textarea
            placeholder="E.g. I'm not comfortable guaranteeing this amount at this time."
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
            maxLength={300}
            style={{
              width: '100%', padding: '10px 12px',
              border: '1px solid rgba(186,26,26,0.3)', borderRadius: 10,
              fontSize: 13, outline: 'none', resize: 'vertical',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            className="btn"
            style={{ flex: 1, background: '#ba1a1a', color: 'white' }}
            onClick={() => onConfirm(note)}
            disabled={loading}
          >
            {loading ? <div className="spinner spinner-sm" style={{ borderTopColor: 'white', borderColor: 'rgba(255,255,255,0.3)' }} /> : <UserX size={16} />}
            Decline
          </button>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose} disabled={loading}>Back</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function GuarantorInbox() {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const { loading, getInbox, getMyRequests, approveRequest, rejectRequest, cancelRequest } = useGuarantor();

  const [activeTab,    setActiveTab]    = useState('inbox');
  const [inbox,        setInbox]        = useState([]);
  const [myRequests,   setMyRequests]   = useState([]);
  const [refreshKey,   setRefreshKey]   = useState(0);
  const [approveModal, setApproveModal] = useState(null); // request obj
  const [rejectModal,  setRejectModal]  = useState(null); // request obj
  const [actionLoading, setActionLoading] = useState(false);
  const [ethPrice,     setEthPrice]     = useState(null);
  const [notifOpen,    setNotifOpen]    = useState(false);

  const { notifications, unreadCount, markAllRead, dismiss } = useNotifications();
  const prevNotifLen = useRef(0);

  useEffect(() => {
    if (notifications.length > prevNotifLen.current) {
      const latest = notifications[0];
      if (latest) {
        toast(latest.title, { icon: '🔔', duration: 4000, style: { fontWeight: 600, fontSize: 14 } });
      }
    }
    prevNotifLen.current = notifications.length;
  }, [notifications]);

  const reload = useCallback(() => setRefreshKey(k => k + 1), []);

  const fmtUsd = (eth) => ethPrice
    ? (eth * ethPrice).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
    : null;

  useEffect(() => {
    if (!token) return;
    getInbox(token).then(setInbox);
    getMyRequests(token).then(setMyRequests);

    // Fetch ETH price
    const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');
    fetch(`${API_BASE}/api/eth-price`)
      .then(r => r.json())
      .then(d => { if (d.success) setEthPrice(d.usd); })
      .catch(() => {});
  }, [token, refreshKey, getInbox, getMyRequests]);

  async function handleApprove(data) {
    setActionLoading(true);
    try {
      await approveRequest(token, approveModal._id, data);
      toast.success('Guarantee approved! Borrower has been notified.');
      setApproveModal(null);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject(note) {
    setActionLoading(true);
    try {
      await rejectRequest(token, rejectModal._id, note);
      toast.success('Request declined. Borrower has been notified.');
      setRejectModal(null);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancel(id) {
    if (!confirm('Cancel this guarantor request?')) return;
    try {
      await cancelRequest(token, id);
      toast.success('Request cancelled.');
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  }

  const pendingInboxCount = inbox.filter(r => r.status === 'pending').length;

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #fff8f7 0%, #f5e8e5 100%)' }}>

      {/* ── Fixed Top Navbar with Back Button ── */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 80,
        background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)', boxShadow: '0 2px 20px rgba(96,24,11,0.10)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 36px', zIndex: 200,
      }}>
        <button onClick={() => navigate('/dashboard')} className="btn btn-ghost"
          style={{
            padding: '12px 22px', fontSize: 18, fontWeight: 800,
            background: 'linear-gradient(135deg, #f5e8e5, #fdddd7)',
            borderRadius: 50, display: 'flex', alignItems: 'center', gap: 10,
            color: '#60180b', border: '1.5px solid rgba(96,24,11,0.18)',
            boxShadow: '0 2px 10px rgba(96,24,11,0.10)', transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg, #fdddd7, #f5c8c0)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(96,24,11,0.18)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, #f5e8e5, #fdddd7)'; e.currentTarget.style.boxShadow = '0 2px 10px rgba(96,24,11,0.10)'; }}
        >
          <ArrowLeft size={22} /> Back
        </button>
        <h2 style={{ fontWeight: 900, fontSize: 26, color: '#342f30', letterSpacing: '-0.5px' }}>Guarantor Center</h2>
        <div style={{ width: 140, display: 'flex', justifyContent: 'flex-end', position: 'relative' }}>
          {/* ── Bell ── */}
          <button
            onClick={() => { setNotifOpen(o => !o); if (!notifOpen) markAllRead(); }}
            style={{
              background: unreadCount > 0 ? 'linear-gradient(135deg,#60180b,#815249)' : '#f5e8e5',
              border: unreadCount > 0 ? 'none' : '1.5px solid rgba(96,24,11,0.18)',
              borderRadius: '50%', width: 46, height: 46,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'all 0.2s', position: 'relative',
            }}
            title="Notifications"
          >
            <Bell size={20} color={unreadCount > 0 ? 'white' : '#60180b'} />
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
              position: 'absolute', top: 56, right: 0, width: 360,
              background: 'white', borderRadius: 18,
              boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
              border: '1px solid rgba(0,0,0,0.06)', zIndex: 500,
              maxHeight: 480, display: 'flex', flexDirection: 'column', overflow: 'hidden',
              textAlign: 'left',
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
                    <Bell size={32} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
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
      </div>

      <Navbar />

      {approveModal && (
        <ApproveModal request={approveModal} onConfirm={handleApprove}
          onClose={() => setApproveModal(null)} loading={actionLoading} />
      )}
      {rejectModal && (
        <RejectModal request={rejectModal} onConfirm={handleReject}
          onClose={() => setRejectModal(null)} loading={actionLoading} />
      )}

      <main style={{ maxWidth: 900, margin: '0 auto', padding: '118px 28px 88px' }}>

        {/* (Back button removed from here — now in top navbar) */}

        <h1 style={{ fontSize: 40, fontWeight: 900, color: '#342f30', marginBottom: 10, letterSpacing: '-0.5px' }}>Guarantor Center</h1>
        <p style={{ color: '#8a7e80', fontSize: 20, marginBottom: 36 }}>
          Review incoming guarantee requests or track your sent requests.
        </p>

        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: 8, background: 'rgba(96,24,11,0.07)', borderRadius: 16, padding: 6, marginBottom: 36, width: 'fit-content' }}>
          {[
            { id: 'inbox',    label: 'My Inbox',       icon: <Inbox size={20} />,    count: pendingInboxCount },
            { id: 'sent',     label: 'My Requests',    icon: <SendIcon size={20} />, count: 0 },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              background: activeTab === tab.id ? 'white' : 'transparent',
              border: 'none', borderRadius: 12, padding: '13px 28px',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 9,
              fontSize: 18, fontWeight: activeTab === tab.id ? 800 : 500,
              color: activeTab === tab.id ? '#342f30' : '#8a7e80',
              boxShadow: activeTab === tab.id ? '0 2px 10px rgba(96,24,11,0.12)' : 'none',
              transition: 'all 0.2s', position: 'relative',
            }}>
              {tab.icon} {tab.label}
              {tab.count > 0 && (
                <span style={{
                  background: '#60180b', color: 'white', borderRadius: '50%',
                  width: 24, height: 24, fontSize: 13, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── INBOX TAB ── */}
        {activeTab === 'inbox' && (
          <div>
            {!user?.walletAddress && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#8a7e80' }}>
                <Shield size={40} color="#c4803a" style={{ marginBottom: 12 }} />
                <p>Connect your wallet on the Dashboard to see guarantee requests addressed to your wallet.</p>
                <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/dashboard')}>
                  Connect Wallet
                </button>
              </div>
            )}

            {user?.walletAddress && inbox.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#8a7e80' }}>
                <Inbox size={48} color="#d4b8b3" style={{ marginBottom: 12 }} />
                <p style={{ fontSize: 15 }}>No guarantee requests yet.</p>
                <p style={{ fontSize: 13 }}>When someone requests you as a guarantor, it will appear here.</p>
              </div>
            )}

            {inbox.map(req => {
              const cfg    = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
              const loan   = req.loan;
              const borrow = req.borrower;

              return (
                <div key={req._id} className="card" style={{ marginBottom: 16, borderLeft: `4px solid ${cfg.color}` }}>
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 48, height: 48, borderRadius: '50%',
                        background: 'linear-gradient(135deg, #60180b, #815249)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', fontWeight: 700, fontSize: 18,
                      }}>
                        {borrow?.walletAddress ? '0x' : 'B'}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 800, fontSize: 21 }} title={borrow?.walletAddress}>
                            {borrow?.walletAddress?.slice(0, 6)}…{borrow?.walletAddress?.slice(-4)}
                          </span>
                          {borrow?.zkVerified && <ShieldCheck size={18} color="#00373f" title="ZK Verified" />}
                        </div>
                        <p style={{ fontSize: 15, color: '#8a7e80', fontFamily: 'monospace' }}>
                          {borrow?.walletAddress?.slice(0, 8)}…{borrow?.walletAddress?.slice(-6)}
                        </p>
                      </div>
                    </div>
                    <span style={{
                      background: cfg.bg, color: cfg.color, borderRadius: 50,
                      padding: '8px 20px', fontSize: 16, fontWeight: 800,
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                    }}>
                      {cfg.icon} {cfg.label}
                    </span>
                  </div>

                  {/* Loan details */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: 18, marginBottom: 18,
                    background: 'rgba(96,24,11,0.03)', borderRadius: 14, padding: '20px 22px',
                  }}>
                    {[
                      { label: 'Loan Amount',   value: fmtUsd(loan?.principal) || `${loan?.principal} ETH`, sub: `${loan?.principal} ETH` },
                      { label: 'Duration',      value: `${loan?.durationDays} days` },
                      { label: 'Interest Rate', value: `${((loan?.interestRateBps || 0) / 100).toFixed(1)}% ` },
                    ].map((item, i) => (
                      <div key={i}>
                        <p style={{ fontSize: 15, color: '#8a7e80', marginBottom: 5, fontWeight: 600 }}>{item.label}</p>
                        <p style={{ fontSize: 24, fontWeight: 800, color: item.accent ? '#ba1a1a' : '#342f30' }}>
                          {item.value}
                        </p>
                        {item.sub && <p style={{ fontSize: 14, color: '#8a7e80', marginTop: 3 }}>{item.sub}</p>}
                      </div>
                    ))}
                  </div>

                  {/* Borrower's message */}
                  {req.borrowerMessage && (
                    <div style={{
                      background: 'rgba(107,78,255,0.06)', border: '1px solid rgba(107,78,255,0.2)',
                      borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#342f30',
                      fontStyle: 'italic',
                    }}>
                      💬 "{req.borrowerMessage}"
                    </div>
                  )}

                  {/* Response info */}
                  {req.guarantorNote && req.status !== 'pending' && (
                    <div style={{ fontSize: 12, color: '#8a7e80', marginBottom: 12 }}>
                      Your note: "{req.guarantorNote}"
                    </div>
                  )}
                  {req.documentType && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 12, color: '#00373f', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <FileText size={13} />
                        <span style={{ fontWeight: 600 }}>{req.documentType.replace(/_/g, ' ')}</span>
                        {req.documentFileName && (
                          <span style={{ color: '#8a7e80', fontStyle: 'italic' }}>— {req.documentFileName}</span>
                        )}
                      </div>
                      {req.documentHash && (
                        <div style={{
                          fontFamily: 'monospace', fontSize: 10, color: '#8a7e80',
                          marginBottom: 4, wordBreak: 'break-all',
                        }}>
                          SHA-256: {req.documentHash.length === 64
                            ? `${req.documentHash.slice(0, 16)}…${req.documentHash.slice(-8)}`
                            : req.documentHash.slice(0, 28) + '…'
                          }
                        </div>
                      )}
                      <VerifyDocumentButton storedHash={req.documentHash} />
                    </div>
                  )}

                  {/* Requested date */}
                  <p style={{ fontSize: 14, color: '#8a7e80', marginBottom: req.status === 'pending' ? 16 : 0 }}>
                    Requested {new Date(req.requestedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>

                  {/* Actions — only for pending */}
                  {req.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 14 }}>
                      <button
                        className="btn"
                        style={{ flex: 1, background: '#00373f', color: 'white', fontSize: 18, padding: '14px 22px', fontWeight: 800 }}
                        onClick={() => setApproveModal(req)}
                      >
                        <UserCheck size={20} /> Approve
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ flex: 1, fontSize: 18, padding: '14px 22px', color: '#ba1a1a', borderColor: 'rgba(186,26,26,0.3)', fontWeight: 800 }}
                        onClick={() => setRejectModal(req)}
                      >
                        <UserX size={20} /> Decline
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── SENT / MY REQUESTS TAB ── */}
        {activeTab === 'sent' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={() => navigate('/guarantor-request')}>
                + New Request
              </button>
            </div>

            {myRequests.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#8a7e80' }}>
                <SendIcon size={48} color="#d4b8b3" style={{ marginBottom: 12 }} />
                <p style={{ fontSize: 15 }}>No guarantor requests sent yet.</p>
                <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/guarantor-request')}>
                  Request a Guarantor
                </button>
              </div>
            )}

            {myRequests.map(req => {
              const cfg      = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
              const guarantor = req.guarantor;
              const loan      = req.loan;

              return (
                <div key={req._id} className="card" style={{ marginBottom: 14, borderLeft: `4px solid ${cfg.color}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: 15 }}>
                          {req.guarantorAddress?.slice(0, 6)}…{req.guarantorAddress?.slice(-4)}
                        </span>
                        {guarantor?.zkVerified && <ShieldCheck size={13} color="#00373f" />}
                      </div>
                      <p style={{ fontSize: 12, color: '#8a7e80', fontFamily: 'monospace' }}>
                        Registered Guarantor
                      </p>
                    </div>
                    <span style={{
                      background: cfg.bg, color: cfg.color, borderRadius: 50,
                      padding: '4px 12px', fontSize: 12, fontWeight: 700,
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                    }}>
                      {cfg.icon} {cfg.label}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: 22, fontSize: 18, color: '#8a7e80', marginBottom: 14, flexWrap: 'wrap' }}>
                    <span>Loan: <strong style={{ color: '#342f30', fontSize: 22 }}>{fmtUsd(loan?.principal) || `${loan?.principal} ETH`}</strong></span>
                    <span>Sent: <strong style={{ color: '#342f30', fontSize: 18 }}>{new Date(req.requestedAt).toLocaleDateString('en-IN')}</strong></span>
                  </div>

                  {req.guarantorNote && (
                    <div style={{
                      background: 'rgba(0,0,0,0.04)', borderRadius: 8, padding: '8px 12px',
                      fontSize: 13, color: '#342f30', marginBottom: 10, fontStyle: 'italic',
                    }}>
                      Note from guarantor: "{req.guarantorNote}"
                    </div>
                  )}

                  {req.status === 'pending' && (
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: 15, padding: '10px 18px', color: '#ba1a1a', fontWeight: 700 }}
                      onClick={() => handleCancel(req._id)}
                    >
                      <XCircle size={16} /> Cancel Request
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
