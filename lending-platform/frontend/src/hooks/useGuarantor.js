/**
 * useGuarantor.js
 *
 * Manages the guarantor request flow:
 *  - searchByWallet(address)          — find LendChain user by MetaMask wallet
 *  - requestGuarantor(data)           — borrower sends request for a loan
 *  - getInbox()                       — guarantor fetches their pending requests
 *  - getMyRequests()                  — borrower fetches their sent requests
 *  - approveRequest(id, data)         — guarantor approves + uploads doc metadata
 *  - rejectRequest(id, note)          — guarantor rejects
 *  - cancelRequest(id)                — borrower cancels pending request
 *  - getForLoan(loanId)               — get guarantor status for a specific loan
 */

import { useState, useCallback } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function authHeader(token) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

export function useGuarantor() {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const searchByWallet = useCallback(async (token, walletAddress) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.post(
        `${API}/guarantor/search`,
        { walletAddress },
        authHeader(token)
      );
      return data;
    } catch (err) {
      const msg = err?.response?.data?.message || err.message;
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const requestGuarantor = useCallback(async (token, { loanId = null, guarantorWallet, guaranteeAmountEth, borrowerMessage }) => {
    setLoading(true);
    setError(null);
    try {
      const payload = { guarantorWallet, guaranteeAmountEth, borrowerMessage };
      if (loanId) payload.loanId = loanId;   // only send loanId when a loan already exists
      const { data } = await axios.post(
        `${API}/guarantor/request`,
        payload,
        authHeader(token)
      );
      return data;
    } catch (err) {
      const msg = err?.response?.data?.message || err.message;
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const getInbox = useCallback(async (token) => {
    try {
      const { data } = await axios.get(`${API}/guarantor/inbox`, authHeader(token));
      return data.requests || [];
    } catch {
      return [];
    }
  }, []);

  const getMyRequests = useCallback(async (token) => {
    try {
      const { data } = await axios.get(`${API}/guarantor/my-requests`, authHeader(token));
      return data.requests || [];
    } catch {
      return [];
    }
  }, []);

  const getForLoan = useCallback(async (token, loanId) => {
    try {
      const { data } = await axios.get(`${API}/guarantor/loan/${loanId}`, authHeader(token));
      return data;
    } catch {
      return { exists: false };
    }
  }, []);

  const approveRequest = useCallback(async (token, id, { documentFile, documentHash, documentFileName, documentType, guarantorNote }) => {
    setLoading(true);
    setError(null);
    try {
      let payload;
      const headers = { ...authHeader(token).headers };

      // If there is an actual file, use FormData for multipart/form-data upload
      if (documentFile) {
        payload = new FormData();
        payload.append('document', documentFile); // this key must match multer .single('document')
        if (documentHash) payload.append('documentHash', documentHash);
        if (documentFileName) payload.append('documentFileName', documentFileName);
        if (documentType) payload.append('documentType', documentType);
        if (guarantorNote) payload.append('guarantorNote', guarantorNote);
      } else {
        // Fallback or manual entry
        payload = { documentHash, documentFileName, documentType, guarantorNote };
      }

      const { data } = await axios.put(`${API}/guarantor/${id}/approve`, payload, { headers });
      return data;
    } catch (err) {
      const msg = err?.response?.data?.message || err.message;
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const rejectRequest = useCallback(async (token, id, guarantorNote = '') => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.put(
        `${API}/guarantor/${id}/reject`,
        { guarantorNote },
        authHeader(token)
      );
      return data;
    } catch (err) {
      const msg = err?.response?.data?.message || err.message;
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const cancelRequest = useCallback(async (token, id) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.delete(`${API}/guarantor/${id}/cancel`, authHeader(token));
      return data;
    } catch (err) {
      const msg = err?.response?.data?.message || err.message;
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    searchByWallet,
    requestGuarantor,
    getInbox,
    getMyRequests,
    getForLoan,
    approveRequest,
    rejectRequest,
    cancelRequest,
  };
}
