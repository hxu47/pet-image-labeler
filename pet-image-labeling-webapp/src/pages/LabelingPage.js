import React, { useState, useEffect } from 'react';
import { imageApi } from '../services/api';
import ImageCard from '../components/ImageCard';
import LabelForm from '../components/LabelForm';

const LabelingPage = () => {
  const [images, setImages] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    const fetchImages = async () => {
      try {
        setLoading(true);
        const data = await imageApi.getImages('unlabeled', 12);
        setImages(data);
        setError(null);
      } catch (err) {
        setError('Failed to load images. Please try again later.');
        console.error(err);
        
        // For demo purposes, set some mock data
        setImages([
          {
            imageId: 'img123456789',
            thumbnailUrl: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1',
            uploadedAt: '2023-01-15T14:30:00Z',
            labelStatus: 'unlabeled'
          },
          {
            imageId: 'img987654321',
            thumbnailUrl: 'https://images.unsplash.com/photo-1592194996308-7b43878e84a6',
            uploadedAt: '2023-01-16T10:20:00Z',
            labelStatus: 'unlabeled'
          },
          {
            imageId: 'img456789123',
            thumbnailUrl: 'https://images.unsplash.com/photo-1561948955-570b270e7c36',
            uploadedAt: '2023-01-17T09:15:00Z',
            labelStatus: 'unlabeled'
          }
        ]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchImages();
  }, []);

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
      <h2 className="mb-4">Label Images</h2>
      
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
                  No images available for labeling. All caught up!
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