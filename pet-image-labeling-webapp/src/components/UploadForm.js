import React, { useState } from 'react';

const UploadForm = ({ onUpload }) => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    
    if (!selectedFile) {
      setFile(null);
      setPreview(null);
      return;
    }
    
    // Validate file type
    if (!selectedFile.type.match('image.*')) {
      setError('Please select an image file (JPEG, PNG, etc.)');
      setFile(null);
      setPreview(null);
      return;
    }
    
    // Validate file size (max 5MB)
    if (selectedFile.size > 5 * 1024 * 1024) {
      setError('The image must be less than 5MB');
      setFile(null);
      setPreview(null);
      return;
    }
    
    setFile(selectedFile);
    setError(null);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target.result);
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!file) {
      setError('Please select an image to upload');
      return;
    }
    
    setUploading(true);
    
    try {
      await onUpload(file);
      setFile(null);
      setPreview(null);
    } catch (err) {
      setError('Failed to upload image. Please try again.');
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <h5 className="mb-0">Upload Pet Image</h5>
      </div>
      <div className="card-body">
        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label htmlFor="imageUpload" className="form-label">Select Image</label>
            <input 
              className="form-control" 
              type="file" 
              id="imageUpload" 
              accept="image/*"
              onChange={handleFileChange}
              disabled={uploading}
            />
          </div>
          
          {preview && (
            <div className="text-center mb-3">
              <img 
                src={preview} 
                alt="Preview" 
                className="img-fluid" 
                style={{ maxHeight: '300px' }}
              />
            </div>
          )}
          
          <button 
            type="submit" 
            className="btn btn-primary w-100" 
            disabled={!file || uploading}
          >
            {uploading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Uploading...
              </>
            ) : 'Upload Image'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default UploadForm;