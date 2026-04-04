import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import CrushReveal from './components/CrushReveal';

import Landing from './pages/Landing';
import Register     from './pages/Register';
import VerifyEmail  from './pages/VerifyEmail';
import Login        from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword  from './pages/ResetPassword';
import Dashboard       from './pages/Dashboard';
import Borrow          from './pages/Borrow';
import Lend            from './pages/Lend';
import LoanHistory     from './pages/LoanHistory';
import ZkVerification  from './pages/ZkVerification';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Landing page with CrushReveal splash animation */}
          <Route path="/" element={<CrushReveal><Landing /></CrushReveal>} />
          {/* Auth pages */}
          <Route path="/register" element={<Register />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          {/* Protected routes */}
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/borrow"    element={<ProtectedRoute><Borrow /></ProtectedRoute>} />
          <Route path="/lend"      element={<ProtectedRoute><Lend /></ProtectedRoute>} />
          <Route path="/history"   element={<ProtectedRoute><LoanHistory /></ProtectedRoute>} />
          <Route path="/zk-verify" element={<ProtectedRoute><ZkVerification /></ProtectedRoute>} />
          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
