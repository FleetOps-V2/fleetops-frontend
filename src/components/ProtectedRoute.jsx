import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AppContext } from '../context/AppContext';

const ProtectedRoute = ({ children, requireAdmin = false, allowedRoles = [] }) => {
  const { state } = useContext(AppContext);

  if (!state.isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If explicit allowed roles are provided, validate against them
  if (allowedRoles.length > 0) {
    const hasRole = allowedRoles.some(role => {
      const cleanRole = role.replace('ROLE_', '');
      const userRole = state.role ? state.role.replace('ROLE_', '') : '';
      return cleanRole === userRole;
    });
    if (!hasRole) {
      return <Navigate to="/" replace />;
    }
    return children;
  }

  // Fallback compatibility for requireAdmin
  if (requireAdmin && state.role !== 'ROLE_ADMIN' && state.role !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
