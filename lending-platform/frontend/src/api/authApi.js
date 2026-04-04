import axios from 'axios';

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  withCredentials: false,
});

// Attach token to every request
API.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Token helpers ──
export function saveToken(token) {
  localStorage.setItem('lendchain_token', token);
}

export function getToken() {
  return localStorage.getItem('lendchain_token');
}

export function removeToken() {
  localStorage.removeItem('lendchain_token');
}

// ── Auth API calls ──
export const register = (data) => API.post('/auth/register', data);
export const verifyEmail = (data) => API.post('/auth/verify-email', data);
export const resendOTP = (data) => API.post('/auth/resend-otp', data);
export const login = (data) => API.post('/auth/login', data);
export const forgotPassword = (data) => API.post('/auth/forgot-password', data);
export const verifyResetOTP = (data) => API.post('/auth/verify-reset-otp', data);
export const resetPassword = (data) => API.post('/auth/reset-password', data);
export const getMe = () => API.get('/auth/me');
export const walletChallenge = (data) => API.post('/auth/wallet-challenge', data);
export const verifyWallet = (data) => API.post('/auth/verify-wallet', data);
