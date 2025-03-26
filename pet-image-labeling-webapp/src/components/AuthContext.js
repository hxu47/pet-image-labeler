// components/AuthContext.js
import React, { createContext, useState, useEffect, useContext } from 'react';
import { authService } from '../services/auth';
import { createApiClient } from '../services/api';

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
      // Authenticate with Cognito
      const user = await authService.signIn(email, password);
      console.log('AuthContext: User authenticated successfully:', user);
      setCurrentUser(user);
      
      // Check user roles
      console.log('AuthContext: Checking user roles...');
      const adminStatus = await authService.isAdmin();
      console.log('AuthContext: isAdmin status:', adminStatus);
      setIsAdmin(adminStatus);
      
      const labelerStatus = await authService.isLabeler();
      console.log('AuthContext: isLabeler status:', labelerStatus);
      setIsLabeler(labelerStatus);
      
      // Check if user exists in DynamoDB and create if not
      try {
        // Try to get user from our database
        const userId = user.username || user.attributes?.sub;
        const apiClient = await createApiClient(); 
        
        // First try to get the user profile
        const userProfileResponse = await apiClient.get(`/users/${userId}`);
        
        // If we get an empty response or 404, create the user
        if (!userProfileResponse.data || Object.keys(userProfileResponse.data).length === 0) {
          console.log('User not found in DynamoDB, creating new user record');
          
          // Create user record in DynamoDB with basic info
          await apiClient.post('/users', {
            userId: userId,
            name: user.attributes?.name || 'New User',
            email: user.attributes?.email || '',
            createdAt: new Date().toISOString()
          });
          console.log('Created new user record in DynamoDB');
        }
      } catch (dbError) {
        // If we get an error (like 404 Not Found), create the user
        console.error('Error accessing user data:', dbError);
        // Show more details about the error
        if (dbError.response) {
          console.error('Error response:', dbError.response.status, dbError.response.data);
        }
        console.log('Error or user not found, creating user record:', dbError);
        try {
          const userId = user.username || user.attributes?.sub;
          const apiClient = await createApiClient();
          
          await apiClient.post('/users', {
            userId: userId,
            name: user.attributes?.name || 'New User',
            email: user.attributes?.email || '',
            createdAt: new Date().toISOString()
          });
          console.log('Created new user record in DynamoDB after error');
        } catch (createError) {
          console.error('Failed to create user record:', createError);
          // Continue with login anyway - don't block the user
        }
      }

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