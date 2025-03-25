import { Amplify, Auth } from 'aws-amplify';
import { config } from '../config';

// Initialize Amplify with Cognito configuration
Amplify.configure({
  Auth: {
    region: config.cognito.region,
    userPoolId: config.cognito.userPoolId,
    userPoolWebClientId: config.cognito.userPoolClientId,
    identityPoolId: config.cognito.identityPoolId,
  }
});

// Authentication service
export const authService = {
  // Sign up a new user
  signUp: async (email, password, name, role = 'None') => {
    try {
      const { user } = await Auth.signUp({
        username: email,
        password,
        attributes: {
          email,
          name,
          'custom:role': role,
        }
      });
      return user;
    } catch (error) {
      console.error('Error signing up:', error);
      throw error;
    }
  },

  // Confirm sign up with verification code
  confirmSignUp: async (email, code) => {
    try {
      await Auth.confirmSignUp(email, code);
      return true;
    } catch (error) {
      console.error('Error confirming sign up:', error);
      throw error;
    }
  },

  // Sign in user
  signIn: async (email, password) => {
    try {
      console.log('Attempting to sign in with:', email);
      const user = await Auth.signIn(email, password);
      console.log('Sign in successful, user object:', JSON.stringify(user));
      return user;
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    }
  },

  // Sign out user
  signOut: async () => {
    try {
      await Auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  },

  // Get current authenticated user
  getCurrentUser: async () => {
    try {
      const user = await Auth.currentAuthenticatedUser();
      return user;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  },

  // Get current user's session
  getCurrentSession: async () => {
    try {
      const session = await Auth.currentSession();
      return session;
    } catch (error) {
      console.error('Error getting current session:', error);
      return null;
    }
  },

  // Get JWT token
  getIdToken: async () => {
    try {
      const session = await Auth.currentSession();
      return session.getIdToken().getJwtToken();
    } catch (error) {
      console.error('Error getting ID token:', error);
      return null;
    }
  },

  // Check if user is authenticated
  isAuthenticated: async () => {
    try {
      await Auth.currentAuthenticatedUser();
      return true;
    } catch (error) {
      return false;
    }
  },

  // Check if user is in a specific group
  isInGroup: async (group) => {
    try {
      const user = await Auth.currentAuthenticatedUser();
      const groups = user.signInUserSession.idToken.payload['cognito:groups'] || [];
      return groups.includes(group);
    } catch (error) {
      console.error('Error checking user group:', error);
      return false;
    }
  },

  // Check if user is an admin
  isAdmin: async () => {
    return authService.isInGroup('Admins');
  },

  // Check if user is a labeler
  isLabeler: async () => {
    return authService.isInGroup('Labelers');
  },

  // Update user attributes
  updateUserAttributes: async (attributes) => {
    try {
      const user = await Auth.currentAuthenticatedUser();
      return await Auth.updateUserAttributes(user, attributes);
    } catch (error) {
      console.error('Error updating user attributes:', error);
      throw error;
    }
  },

  // Reset password
  forgotPassword: async (email) => {
    try {
      await Auth.forgotPassword(email);
    } catch (error) {
      console.error('Error initiating password reset:', error);
      throw error;
    }
  },

  // Complete the password reset process
  forgotPasswordSubmit: async (email, code, newPassword) => {
    try {
      await Auth.forgotPasswordSubmit(email, code, newPassword);
    } catch (error) {
      console.error('Error completing password reset:', error);
      throw error;
    }
  }
};

// Export Auth for more advanced usages
export { Auth };