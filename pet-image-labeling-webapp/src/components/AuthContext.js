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
    console.log('AuthContext: Starting login process');
    try {
      const user = await authService.signIn(email, password);
      console.log('AuthContext: User authenticated successfully:', user);
      setCurrentUser(user);
      
      // Check if roles are being correctly assessed
      console.log('AuthContext: Checking user roles...');
      const adminStatus = await authService.isAdmin();
      console.log('AuthContext: isAdmin status:', adminStatus);
      setIsAdmin(adminStatus);
      
      const labelerStatus = await authService.isLabeler();
      console.log('AuthContext: isLabeler status:', labelerStatus);
      setIsLabeler(labelerStatus);
      
      return user;
    } catch (error) {
      console.error('AuthContext: Login error:', error);
      throw error;
    }
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
    getToken,
    // Add these for development testing:
    setCurrentUser, // for local testing
    setIsAdmin, // for local testing
    setIsLabeler // for local testing
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