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
  Inbox, Send as SendIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useGuarantor } from '../hooks/useGuarantor';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

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

        {/* Liability warning */}
        <div style={{
          background: 'rgba(186,26,26,0.06)', border: '1px solid rgba(186,26,26,0.25)',
          borderRadius: 12, padding: '14px 16px', marginBottom: 20,
        }}>
          <p style={{ fontSize: 14, color: '#ba1a1a', fontWeight: 700, marginBottom: 4 }}>
            ⚠️ You are guaranteeing {request.guaranteeAmountEth} ETH
          </p>
          <p style={{ fontSize: 13, color: '#815249', lineHeight: 1.6 }}>
            If <strong>{request.borrower?.walletAddress?.slice(0,6)}…</strong> defaults on this loan, you will be responsible
          for repaying <strong>{request.guaranteeAmountEth} ETH</strong>.
          </p>
        </div>

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

  const reload = useCallback(() => setRefreshKey(k => k + 1), []);

  useEffect(() => {
    if (!token) return;
    getInbox(token).then(setInbox);
    getMyRequests(token).then(setMyRequests);
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
      <Navbar />

      {approveModal && (
        <ApproveModal request={approveModal} onConfirm={handleApprove}
          onClose={() => setApproveModal(null)} loading={actionLoading} />
      )}
      {rejectModal && (
        <RejectModal request={rejectModal} onConfirm={handleReject}
          onClose={() => setRejectModal(null)} loading={actionLoading} />
      )}

      <main style={{ maxWidth: 760, margin: '0 auto', padding: '40px 20px 80px' }}>

        <button onClick={() => navigate('/dashboard')} className="btn btn-ghost"
          style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
          <ArrowLeft size={16} /> Dashboard
        </button>

        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#342f30', marginBottom: 6 }}>Guarantor Center</h1>
        <p style={{ color: '#8a7e80', fontSize: 14, marginBottom: 28 }}>
          Review incoming guarantee requests or track your sent requests.
        </p>

        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: 4, background: 'rgba(96,24,11,0.06)', borderRadius: 12, padding: 4, marginBottom: 28, width: 'fit-content' }}>
          {[
            { id: 'inbox',    label: 'My Inbox',       icon: <Inbox size={15} />,    count: pendingInboxCount },
            { id: 'sent',     label: 'My Requests',    icon: <SendIcon size={15} />, count: 0 },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              background: activeTab === tab.id ? 'white' : 'transparent',
              border: 'none', borderRadius: 10, padding: '8px 18px',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 14, fontWeight: activeTab === tab.id ? 700 : 500,
              color: activeTab === tab.id ? '#342f30' : '#8a7e80',
              boxShadow: activeTab === tab.id ? '0 2px 8px rgba(96,24,11,0.1)' : 'none',
              transition: 'all 0.2s', position: 'relative',
            }}>
              {tab.icon} {tab.label}
              {tab.count > 0 && (
                <span style={{
                  background: '#60180b', color: 'white', borderRadius: '50%',
                  width: 18, height: 18, fontSize: 11, fontWeight: 700,
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
                        width: 40, height: 40, borderRadius: '50%',
                        background: 'linear-gradient(135deg, #60180b, #815249)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', fontWeight: 700,
                      }}>
                        {borrow?.walletAddress ? '0x' : 'B'}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 700, fontSize: 15 }} title={borrow?.walletAddress}>
                            {borrow?.walletAddress?.slice(0, 6)}…{borrow?.walletAddress?.slice(-4)}
                          </span>
                          {borrow?.zkVerified && <ShieldCheck size={14} color="#00373f" title="ZK Verified" />}
                        </div>
                        <p style={{ fontSize: 12, color: '#8a7e80', fontFamily: 'monospace' }}>
                          {borrow?.walletAddress?.slice(0, 8)}…{borrow?.walletAddress?.slice(-6)}
                        </p>
                      </div>
                    </div>
                    <span style={{
                      background: cfg.bg, color: cfg.color, borderRadius: 50,
                      padding: '4px 12px', fontSize: 12, fontWeight: 700,
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                    }}>
                      {cfg.icon} {cfg.label}
                    </span>
                  </div>

                  {/* Loan details */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: 12, marginBottom: 16,
                    background: 'rgba(96,24,11,0.03)', borderRadius: 10, padding: '12px 14px',
                  }}>
                    {[
                      { label: 'Loan Amount',    value: `${loan?.principal} ETH` },
                      { label: 'Your Liability', value: `${req.guaranteeAmountEth} ETH`, accent: true },
                      { label: 'Duration',       value: `${loan?.durationDays} days` },
                      { label: 'Interest Rate',  value: `${((loan?.interestRateBps || 0) / 100).toFixed(1)}% APR` },
                    ].map((item, i) => (
                      <div key={i}>
                        <p style={{ fontSize: 11, color: '#8a7e80', marginBottom: 2 }}>{item.label}</p>
                        <p style={{ fontSize: 15, fontWeight: 700, color: item.accent ? '#ba1a1a' : '#342f30' }}>
                          {item.value}
                        </p>
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
                  <p style={{ fontSize: 11, color: '#8a7e80', marginBottom: req.status === 'pending' ? 14 : 0 }}>
                    Requested {new Date(req.requestedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>

                  {/* Actions — only for pending */}
                  {req.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        className="btn"
                        style={{ flex: 1, background: '#00373f', color: 'white', fontSize: 13 }}
                        onClick={() => setApproveModal(req)}
                      >
                        <UserCheck size={15} /> Approve
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ flex: 1, fontSize: 13, color: '#ba1a1a', borderColor: 'rgba(186,26,26,0.3)' }}
                        onClick={() => setRejectModal(req)}
                      >
                        <UserX size={15} /> Decline
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

                  <div style={{ display: 'flex', gap: 20, fontSize: 13, color: '#8a7e80', marginBottom: 10, flexWrap: 'wrap' }}>
                    <span>Loan: <strong style={{ color: '#342f30' }}>{loan?.principal} ETH</strong></span>
                    <span>Liability: <strong style={{ color: '#ba1a1a' }}>{req.guaranteeAmountEth} ETH</strong></span>
                    <span>Sent: <strong style={{ color: '#342f30' }}>{new Date(req.requestedAt).toLocaleDateString('en-IN')}</strong></span>
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
                      style={{ fontSize: 13, color: '#ba1a1a' }}
                      onClick={() => handleCancel(req._id)}
                    >
                      <XCircle size={14} /> Cancel Request
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
