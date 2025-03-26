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
        // test comment
        console.log('Attempting to create user in DynamoDB:', {
          userId,
          name: user.attributes?.name || 'New User',
          email: user.attributes?.email || ''
        });
        console.log('API client created:', {
          baseURL: apiClient.defaults.baseURL,
          headers: apiClient.defaults.headers
        });
        console.log('API request headers include Authorization:', 
          !!apiClient.defaults.headers.Authorization || 
          !!apiClient.defaults.headers.common?.Authorization);

        // First try to get the user profile
        console.log(`About to send GET request to /users/${userId}`);
        let userProfileResponse;
        try {
          userProfileResponse = await apiClient.get(`/users/${userId}`);
          console.log('GET request successful:', {
            status: userProfileResponse.status,
            hasData: !!userProfileResponse.data,
            dataKeys: userProfileResponse.data ? Object.keys(userProfileResponse.data) : []
          });
        } catch (error) {
          console.error(`GET request to /users/${userId} failed:`, error.message);
          throw error;  // Re-throw to be caught by the outer catch block
        }
        
        // If we get an empty response or 404, create the user
        if (!userProfileResponse.data || Object.keys(userProfileResponse.data).length === 0) {
          console.log('User not found in DynamoDB, creating new user record');
          
          // Create user record in DynamoDB with basic info
          console.log('Sending POST request to:', '/users');
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
          if (createError.response) {
            console.error('Error creating user - server response:', {
              status: createError.response.status,
              data: createError.response.data,
              headers: createError.response.headers
            });
          } else if (createError.request) {
            console.error('Error creating user - no response received:', createError.request);
          } else {
            console.error('Error creating user - request setup error:', createError.message);
          }
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
    const token = await authService.getIdToken();
    if (token) {
      const maskedToken = token.substring(0, 10) + "..." + token.substring(token.length - 10);
      console.log("Auth token available (masked):", maskedToken);
    } else {
      console.log("No auth token available");
    }
    return token;
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