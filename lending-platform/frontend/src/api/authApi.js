import axios from 'axios';

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  withCredentials: false,
});

// Attach token to every request
API.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Token helpers ──────────────────────────────────────────────
export const saveToken   = (t) => localStorage.setItem('lendchain_token', t);
export const getToken    = ()  => localStorage.getItem('lendchain_token');
export const removeToken = ()  => localStorage.removeItem('lendchain_token');

// ── Wallet Auth API ────────────────────────────────────────────
/** GET /api/auth/nonce/:walletAddress  → { message } */
export const getNonce = (walletAddress) =>
  API.get(`/auth/nonce/${walletAddress}`);

/** POST /api/auth/verify  → { isNewUser, token, role, walletAddress } */
export const verifySignature = (data) => API.post('/auth/verify', data);

/** POST /api/auth/select-role  → { token, role, walletAddress } */
export const selectRole = (data) => API.post('/auth/select-role', data);

/** GET /api/auth/me  → { user } */
export const getMe = () => API.get('/auth/me');
