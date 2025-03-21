import React, { useState, useEffect } from 'react';
import { imageApi } from '../services/api';
import ImageCard from '../components/ImageCard';
import LabelForm from '../components/LabelForm';
import { useAuth } from '../components/AuthContext';

const LabelingPage = () => {
  const [images, setImages] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showOnlyMine, setShowOnlyMine] = useState(false);
  const { currentUser } = useAuth();

  useEffect(() => {
    const fetchImages = async () => {
      try {
        setLoading(true);
        // If showing only user's uploads, pass the userId parameter
        const userId = showOnlyMine ? currentUser?.username : null;
        const data = await imageApi.getImages('unlabeled', 12, userId);
        
        // Log the first image to check if originalUrl is included
        if (data.length > 0) {
          console.log('First image data:', {
            imageId: data[0].imageId,
            hasThumbnailUrl: !!data[0].thumbnailUrl,
            hasOriginalUrl: !!data[0].originalUrl
          });
        }

        setImages(data);
        setError(null);
      } catch (err) {
        setError('Failed to load images. Please try again later.');
        console.error(err);
        
        setImages([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchImages();
  }, [showOnlyMine, currentUser]);

  const handleSelectImage = (image) => {
    setSelectedImage(image);
    setSuccess(null);
  };

  const handleSubmitLabels = async (imageId, labels) => {
    try {
      await imageApi.submitLabels(imageId, labels);
      setSuccess('Labels submitted successfully!');
      
      // Update local state to reflect the change
      setImages(prevImages => 
        prevImages.map(img => 
          img.imageId === imageId 
            ? { ...img, labelStatus: 'labeled' } 
            : img
        )
      );
      
      // Clear selection after successful submission
      setSelectedImage(null);
    } catch (err) {
      setError('Failed to submit labels. Please try again.');
      console.error(err);
    }
  };

  const handleCancelLabeling = () => {
    setSelectedImage(null);
    setSuccess(null);
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Label Images</h2>
        <button 
          className={`btn ${showOnlyMine ? 'btn-primary' : 'btn-outline-primary'}`}
          onClick={() => setShowOnlyMine(!showOnlyMine)}
        >
          <i className="bi bi-person-fill me-1"></i> 
          {showOnlyMine ? 'My Uploads' : 'All Images'}
        </button>
      </div>
      
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
        <div className="col-md-8">
          <div className="row">
            {images.length > 0 ? (
              images.map(image => (
                <div className="col-md-4" key={image.imageId}>
                  <ImageCard 
                    image={image} 
                    onSelect={handleSelectImage}
                    selected={selectedImage && selectedImage.imageId === image.imageId}
                  />
                </div>
              ))
            ) : (
              <div className="col-12">
                <div className="alert alert-info" role="alert">
                  {showOnlyMine ? 
                    "You haven't uploaded any images that need labeling." : 
                    "No images available for labeling. All caught up!"}
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="col-md-4">
          <LabelForm 
            image={selectedImage}
            onSubmit={handleSubmitLabels}
            onCancel={handleCancelLabeling}
          />
        </div>
      </div>
    </div>
  );
};

export default LabelingPage;