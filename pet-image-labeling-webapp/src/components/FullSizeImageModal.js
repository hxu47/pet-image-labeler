import React from 'react';

const FullSizeImageModal = ({ image, onClose }) => {
  if (!image) return null;

  return (
    <div 
      className="modal fade show" 
      style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div className="modal-dialog modal-xl modal-dialog-centered">
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h5 className="modal-title">Full Size Image</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body text-center p-0">
            {image.originalUrl ? (
              <img 
                src={image.originalUrl} 
                alt="Full size pet"
                className="img-fluid" 
                style={{ maxHeight: '80vh' }}
              />
            ) : (
              <div className="p-5">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <p className="mt-3">Loading full-size image...</p>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FullSizeImageModal;