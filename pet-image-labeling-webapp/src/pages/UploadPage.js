import React, { useState } from 'react';
import UploadForm from '../components/UploadForm';
import { imageApi } from '../services/api';

const UploadPage = () => {
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);

  const handleUpload = async (file) => {
    try {
      await imageApi.uploadImage(file);
      setSuccess('Image uploaded successfully!');
      setError(null);
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        setSuccess(null);
      }, 5000);
    } catch (err) {
      setError('Failed to upload image. Please try again later.');
      setSuccess(null);
      console.error(err);
    }
  };

  return (
    <div>
      <h2 className="mb-4">Upload Pet Images</h2>
      
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}
      
      {success && (
        <div className="alert alert-success" role="alert">
          {success}
        </div>
      )}
      
      <div className="row">
        <div className="col-md-6 mx-auto">
          <UploadForm onUpload={handleUpload} />
          
          <div className="card mt-4">
            <div className="card-header">
              <h5 className="mb-0">Upload Guidelines</h5>
            </div>
            <div className="card-body">
              <ul className="list-group list-group-flush">
                <li className="list-group-item">Images must be in JPEG or PNG format</li>
                <li className="list-group-item">Maximum file size: 5MB</li>
                <li className="list-group-item">The pet should be clearly visible in the image</li>
                <li className="list-group-item">Avoid uploading images with multiple pets</li>
                <li className="list-group-item">Ensure good lighting and minimal background distractions</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadPage;