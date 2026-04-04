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

// GET single loan
export const getLoan      = (id)   => API.get(`/loans/${id}`);

// PUT after calling fundLoan() on-chain
export const fundLoan     = (id, data)      => API.put(`/loans/${id}/fund`, data);

// PUT after calling repayLoan() on-chain
export const repayLoan    = (id, data)      => API.put(`/loans/${id}/repay`, data);

// PUT after calling liquidate() on-chain
export const liquidateLoan = (id, data)     => API.put(`/loans/${id}/liquidate`, data);

// DELETE (cancel before funded)
export const cancelLoan   = (id)   => API.delete(`/loans/${id}`);
