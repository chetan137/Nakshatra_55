import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Register     from './pages/Register';
import VerifyEmail  from './pages/VerifyEmail';
import Login        from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword  from './pages/ResetPassword';
import Dashboard    from './pages/Dashboard';
import Borrow       from './pages/Borrow';
import Lend         from './pages/Lend';
import LoanHistory  from './pages/LoanHistory';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/"                  element={<Navigate to="/login" replace />} />
          <Route path="/register"          element={<Register />} />
          <Route path="/verify-email"      element={<VerifyEmail />} />
          <Route path="/login"             element={<Login />} />
          <Route path="/forgot-password"   element={<ForgotPassword />} />
          <Route path="/reset-password"    element={<ResetPassword />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/borrow"    element={<ProtectedRoute><Borrow /></ProtectedRoute>} />
          <Route path="/lend"      element={<ProtectedRoute><Lend /></ProtectedRoute>} />
          <Route path="/history"   element={<ProtectedRoute><LoanHistory /></ProtectedRoute>} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
