import React from 'react';

const ImageCard = ({ image, onSelect, selected }) => {
  return (
    <div 
      className={`card mb-3 ${selected ? 'border-primary' : ''}`} 
      style={{ cursor: 'pointer' }}
      onClick={() => onSelect(image)}
    >
      <img 
        src={image.thumbnailUrl} 
        className="card-img-top" 
        alt="Pet"
        style={{ height: '200px', objectFit: 'cover' }} 
      />
      <div className="card-body">
        <h5 className="card-title">Pet ID: {image.imageId.substring(0, 8)}...</h5>
        <p className="card-text">
          <small className="text-muted">
            Uploaded: {new Date(image.uploadedAt).toLocaleDateString()}
          </small>
        </p>
        <span className={`badge ${image.labelStatus === 'labeled' ? 'bg-success' : 'bg-warning'}`}>
          {image.labelStatus === 'labeled' ? 'Labeled' : 'Unlabeled'}
        </span>
      </div>
    </div>
  );
};

export default ImageCard;