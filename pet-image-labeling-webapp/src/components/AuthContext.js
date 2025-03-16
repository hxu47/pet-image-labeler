import React, { createContext, useState, useEffect, useContext } from 'react';
import { authService } from '../services/auth';

// Create the authentication context
const AuthContext = createContext(null);

// AuthProvider component
export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLabeler, setIsLabeler] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await authService.getCurrentUser();
        if (user) {
          setCurrentUser(user);
          
          // Check user roles
          const adminStatus = await authService.isAdmin();
          setIsAdmin(adminStatus);
          
          const labelerStatus = await authService.isLabeler();
          setIsLabeler(labelerStatus);
        }
      } catch (error) {
        console.error('Auth check error:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Sign in function
  const login = async (email, password) => {
    const user = await authService.signIn(email, password);
    setCurrentUser(user);
    
    // Update roles after login
    const adminStatus = await authService.isAdmin();
    setIsAdmin(adminStatus);
    
    const labelerStatus = await authService.isLabeler();
    setIsLabeler(labelerStatus);
    
    return user;
  };

  // Sign out function
  const logout = async () => {
    await authService.signOut();
    setCurrentUser(null);
    setIsAdmin(false);
    setIsLabeler(false);
  };

  // Register function
  const register = async (email, password, name, role = 'Labeler') => {
    return await authService.signUp(email, password, name, role);
  };

  // Get ID token for API calls
  const getToken = async () => {
    return await authService.getIdToken();
  };

  // Provide the auth context
  const value = {
    currentUser,
    isAdmin,
    isLabeler,
    loading,
    login,
    logout,
    register,
    getToken
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use the auth context
export const useAuth = () => {
  return useContext(AuthContext);
};

export default AuthContext;