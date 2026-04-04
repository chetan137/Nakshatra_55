import React, { createContext, useContext, useState, useEffect } from 'react';
import { getMe, getToken, saveToken, removeToken } from '../api/authApi';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(getToken());
  const [loading, setLoading] = useState(true);

  const isAuthenticated = !!user && !!token;

  // Restore session on mount
  useEffect(() => {
    async function restoreSession() {
      const stored = getToken();
      if (!stored) {
        setLoading(false);
        return;
      }
      try {
        const res = await getMe();
        setUser(res.data.user);
        setToken(stored);
      } catch {
        removeToken();
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    restoreSession();
  }, []);

  function loginUser(newToken, userData) {
    saveToken(newToken);
    setToken(newToken);
    setUser(userData);
  }

  function logout() {
    removeToken();
    setToken(null);
    setUser(null);
  }

  function updateUser(data) {
    setUser((prev) => ({ ...prev, ...data }));
  }

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated, loading, login: loginUser, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
