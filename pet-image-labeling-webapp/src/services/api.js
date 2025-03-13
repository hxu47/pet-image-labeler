import axios from 'axios';
import { config } from '../config';

// Create a base API client
const apiClient = axios.create({
  baseURL: config.apiUrl,
  headers: {
    'Content-Type': 'application/json'
  }
});

// API functions for image operations
export const imageApi = {
  // Get images with a specific label status
  getImages: async (status = 'unlabeled', limit = 10) => {
    try {
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
      // Get a presigned URL for S3 upload
      const presignedUrlResponse = await apiClient.get(`/upload-url?filename=${file.name}`);
      const { uploadUrl, imageId } = presignedUrlResponse.data;
      
      // Upload directly to S3 using the presigned URL
      await axios.put(uploadUrl, file, {
        headers: {
          'Content-Type': file.type
        }
      });
      
      return { imageId };
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  },
  
  // Submit labels for an image
  submitLabels: async (imageId, labels) => {
    try {
      const response = await apiClient.post('/labels', {
        imageId,
        labels,
        labeledBy: 'current-user' // In a real app, this would be the authenticated user ID
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
      const response = await apiClient.get('/metrics');
      return response.data;
    } catch (error) {
      console.error('Error fetching metrics:', error);
      throw error;
    }
  }
};

// API functions for user management
export const userApi = {
  getUsers: async () => {
    try {
      const response = await apiClient.get('/users');
      return response.data;
    } catch (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
  },
  
  createUser: async (userData) => {
    try {
      const response = await apiClient.post('/users', userData);
      return response.data;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }
};