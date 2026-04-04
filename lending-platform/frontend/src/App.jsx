import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import CrushReveal from './components/CrushReveal';

import Landing     from './pages/Landing';
import Login       from './pages/Login';      // wallet-auth: connect + role selection
import Dashboard   from './pages/Dashboard';
import Borrow      from './pages/Borrow';
import Lend        from './pages/Lend';
import LoanHistory from './pages/LoanHistory';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Landing page with CrushReveal splash animation */}
          <Route path="/"      element={<CrushReveal><Landing /></CrushReveal>} />

          {/* Wallet auth — single entry point for connect + role selection */}
          <Route path="/login"  element={<Login />} />
          {/* Legacy aliases so old links don't 404 */}
          <Route path="/register" element={<Navigate to="/login" replace />} />

          {/* Protected routes */}
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/borrow"    element={<ProtectedRoute><Borrow /></ProtectedRoute>} />
          <Route path="/lend"      element={<ProtectedRoute><Lend /></ProtectedRoute>} />
          <Route path="/history"   element={<ProtectedRoute><LoanHistory /></ProtectedRoute>} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
