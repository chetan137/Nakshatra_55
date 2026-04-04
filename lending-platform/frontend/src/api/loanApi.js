import axios from 'axios';
import { getToken } from './authApi';

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  withCredentials: false,
});

API.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Loan CRUD ──────────────────────────────────────────
// POST after calling createLoan() on-chain
export const createLoan   = (data) => API.post('/loans', data);

// GET marketplace (all pending loans)
export const getAvailable = ()     => API.get('/loans/available');

// GET my loans (borrower + lender)
export const getMyLoans   = ()     => API.get('/loans/my');

// GET dashboard stats
export const getMyStats   = ()     => API.get('/loans/stats');

// GET settlement status (active loan cap logic)
export const getSettlement = ()     => API.get('/loans/settlement');

// GET single loan
export const getLoan      = (id)   => API.get(`/loans/${id}`);

// GET live repayment amount (principal + accrued interest from chain)
export const getLoanOwed  = (id)   => API.get(`/loans/${id}/owed`);

// PUT after calling fundLoan() on-chain
export const fundLoan     = (id, data)      => API.put(`/loans/${id}/fund`, data);

// PUT after calling repayLoan() on-chain
export const repayLoan    = (id, data)      => API.put(`/loans/${id}/repay`, data);

// PUT after calling liquidate() on-chain
export const liquidateLoan = (id, data)     => API.put(`/loans/${id}/liquidate`, data);

// DELETE (cancel before funded)
export const cancelLoan   = (id)   => API.delete(`/loans/${id}`);

// ── Guarantor API ──────────────────────────────────────────
// Search LendChain user by MetaMask wallet address
export const searchGuarantorByWallet = (walletAddress) =>
  API.post('/guarantor/search', { walletAddress });

// Borrower requests a guarantor for a pending loan
export const requestGuarantor = (data) =>
  API.post('/guarantor/request', data);

// Guarantor's inbox — all requests for their wallet
export const getGuarantorInbox = () =>
  API.get('/guarantor/inbox');

// Borrower's sent guarantor requests
export const getMyGuarantorRequests = () =>
  API.get('/guarantor/my-requests');

// Get guarantor status for a specific loan
export const getGuarantorForLoan = (loanId) =>
  API.get(`/guarantor/loan/${loanId}`);

// Guarantor approves request
export const approveGuarantorRequest = (id, data) =>
  API.put(`/guarantor/${id}/approve`, data);

// Guarantor rejects request
export const rejectGuarantorRequest = (id, data) =>
  API.put(`/guarantor/${id}/reject`, data);

// Borrower cancels pending request
export const cancelGuarantorRequest = (id) =>
  API.delete(`/guarantor/${id}/cancel`);
