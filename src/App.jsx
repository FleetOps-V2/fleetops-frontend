import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';

// Pages
import Home          from './pages/Home';
import Login         from './pages/Login';
import Vehicles      from './pages/Vehicles';
import Requests      from './pages/Requests';
import Dashboard     from './pages/Dashboard';
import Maintenance   from './pages/Maintenance';
import Admin         from './pages/Admin';
import Tracking      from './pages/Tracking';         // GPS Telemetry Tracking (All roles)

const App = () => {
  return (
    <>
      <Navbar />
      <div className="page-wrapper">
        <ErrorBoundary>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />

          {/* All authenticated roles */}
          <Route path="/vehicles" element={
            <ProtectedRoute><Vehicles /></ProtectedRoute>
          } />
          <Route path="/requests" element={
            <ProtectedRoute><Requests /></ProtectedRoute>
          } />
          <Route path="/maintenance" element={
            <ProtectedRoute><Maintenance /></ProtectedRoute>
          } />
          <Route path="/tracking" element={
            <ProtectedRoute><Tracking /></ProtectedRoute>
          } />

          {/* Manager + Admin */}
          <Route path="/dashboard" element={
            <ProtectedRoute requireAdmin={false}><Dashboard /></ProtectedRoute>
          } />

          {/* Admin-only pages */}
          <Route path="/admin" element={
            <ProtectedRoute allowedRoles={['ADMIN']}><Admin /></ProtectedRoute>
          } />
        </Routes>
        </ErrorBoundary>
      </div>
    </>
  );
};

export default App;
