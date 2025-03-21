import React from 'react';

const ImageCard = ({ image, onSelect, selected }) => {
  // Format the imageId for display - remove all the extra text
  const displayId = image.imageId.substring(0, 8);
  
  // Format the date
  const formattedDate = new Date(image.uploadedAt).toLocaleDateString();
  
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
        <h5 className="card-title">{displayId}...</h5>
        <p className="card-text">
          <small className="text-muted">
            <i className="bi bi-calendar me-1"></i> {formattedDate}
          </small>
          {image.uploadedByName && (
            <small className="text-muted d-block">
              <i className="bi bi-person me-1"></i> {image.uploadedByName}
            </small>
          )}
        </p>
        <span className={`badge ${image.labelStatus === 'labeled' ? 'bg-success' : 'bg-warning'}`}>
          {image.labelStatus === 'labeled' ? 'Labeled' : 'Unlabeled'}
        </span>
      </div>
    </div>
  );
};

export default ImageCard;