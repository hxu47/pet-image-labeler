import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

// ProtectedRoute component to secure routes that require authentication
const ProtectedRoute = ({ children, requireAdmin = false, requireLabeler = false }) => {
  const { currentUser, isAdmin, isLabeler, loading } = useAuth();

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="d-flex justify-content-center p-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  // If not authenticated, redirect to login
  if (!currentUser) {
    return <Navigate to="/login" />;
  }

  // Check for admin requirement
  if (requireAdmin && !isAdmin) {
    return <Navigate to="/unauthorized" />;
  }

  // Check for labeler requirement
  if (requireLabeler && !(isLabeler || isAdmin)) {
    return <Navigate to="/unauthorized" />;
  }

  // If all checks pass, render the protected component
  return children;
};

export default ProtectedRoute;