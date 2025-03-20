import axios from 'axios';
import { config } from '../config';
import { authService } from './auth';

// Create a base API client
const createApiClient = async () => {
  // Get the current authentication token
  const token = await authService.getIdToken();
  
  return axios.create({
    baseURL: config.apiUrl,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    }
  });
};

// API functions for image operations
export const imageApi = {
  // Get images with a specific label status
  getImages: async (status = 'unlabeled', limit = 10) => {
    try {
      const apiClient = await createApiClient();
      const response = await apiClient.get(`/images?status=${status}&limit=${limit}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching images:', error);
      throw error;
    }
  },
  
  // Upload a new image
  uploadImage: async (file) => {
    try {
      const apiClient = await createApiClient();
      console.log('Requesting presigned URL for:', file.name);

      // Get current user info
      const currentUser = await authService.getCurrentUser();
      const userName = currentUser?.attributes?.name || 
                      currentUser?.username || 
                      'Anonymous';

      // Get a presigned URL for S3 upload
      const presignedUrlResponse = await apiClient.get(`/upload-url?filename=${encodeURIComponent(file.name)}`);
      console.log('Received response:', presignedUrlResponse.data);
      
      const { uploadUrl, imageId } = presignedUrlResponse.data;
      
      if (!uploadUrl) {
        throw new Error('No upload URL received from server');
      }
      
      // Upload directly to S3 using the presigned URL
      console.log('Uploading to S3 with presigned URL');
      const uploadResponse = await axios({
        method: 'PUT',
        url: uploadUrl,
        data: file,
        headers: {
          'Content-Type': file.type,
          'Access-Control-Allow-Origin': '*'
        },
        // Don't transform the request body
        transformRequest: [(data) => data]
      });
      
      console.log('S3 upload response:', uploadResponse);
      return { imageId };
    } catch (error) {
      console.error('Error uploading image:', error);
      // Log more details about the error
      if (error.response) {
        console.error('Server responded with:', error.response.status, error.response.data);
      }
      throw error;
    }
  },
  
  // Submit labels for an image
  submitLabels: async (imageId, labels) => {
    try {
      const apiClient = await createApiClient();
      const currentUser = await authService.getCurrentUser();
      const userId = currentUser?.username || 'anonymous';
      
      const response = await apiClient.post('/labels', {
        imageId,
        labels,
        labeledBy: userId
      });
      return response.data;
    } catch (error) {
      console.error('Error submitting labels:', error);
      throw error;
    }
  }
};

// API functions for dashboard metrics
export const dashboardApi = {
  getMetrics: async () => {
    try {
      console.log("Calling API to fetch dashboard metrics");
      const apiClient = await createApiClient();
      const response = await apiClient.get('/metrics');
      
      console.log("API response received:", response.status);
      
      // Log both the response data and whether recentActivity exists
      if (response.data) {
        console.log("Response data received");
        if (response.data.recentActivity) {
          console.log(`Found ${response.data.recentActivity.length} activity entries`);
        } else {
          console.warn("No recentActivity property in response data");
          response.data.recentActivity = []; // Ensure it exists
        }
      } else {
        console.warn("No data in API response");
      }
      
      return response.data;
    } catch (error) {
      console.error('Error fetching metrics:', error);
      
      // Check for specific error types to provide better error messages
      if (error.response) {
        console.error('Server response error:', error.response.status, error.response.data);
      } else if (error.request) {
        console.error('No response received from server');
      } else {
        console.error('Error setting up request:', error.message);
      }
      
      throw error;
    }
  }
};

// API functions for user management
export const userApi = {
  getUsers: async () => {
    try {
      const apiClient = await createApiClient();
      const response = await apiClient.get('/users');
      return response.data;
    } catch (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
  },
  
  createUser: async (userData) => {
    try {
      const apiClient = await createApiClient();
      const response = await apiClient.post('/users', userData);
      return response.data;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  },
  
  getUserProfile: async () => {
    try {
      const apiClient = await createApiClient();
      const currentUser = await authService.getCurrentUser();
      const userId = currentUser?.username;
      
      if (!userId) {
        throw new Error('User not authenticated');
      }
      
      const response = await apiClient.get(`/users/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      throw error;
    }
  },
  
  updateUserProfile: async (profileData) => {
    try {
      const apiClient = await createApiClient();
      const currentUser = await authService.getCurrentUser();
      const userId = currentUser?.username;
      
      if (!userId) {
        throw new Error('User not authenticated');
      }
      
      const response = await apiClient.put(`/users/${userId}`, profileData);
      return response.data;
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  },

  getUserStatistics: async () => {
    try {
      const apiClient = await createApiClient();
      const currentUser = await authService.getCurrentUser();
      const userId = currentUser?.username;
      
      if (!userId) {
        throw new Error('User not authenticated');
      }
      
      const response = await apiClient.get(`/users/${userId}/statistics`);
      return response.data;
    } catch (error) {
      console.error('Error fetching user statistics:', error);
      // Return default values to make UI more resilient
      return {
        imagesUploaded: 0,
        imagesLabeled: 0
      };
    }
  },

  getUserActivity: async () => {
    try {
      const apiClient = await createApiClient();
      const currentUser = await authService.getCurrentUser();
      const userId = currentUser?.username;
      
      if (!userId) {
        throw new Error('User not authenticated');
      }
      
      const response = await apiClient.get(`/users/${userId}/activity`);
      return response.data;
    } catch (error) {
      console.error('Error fetching user activity:', error);
      // Return empty array 
      return [];
    }
  }
};

