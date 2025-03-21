import React, { useState } from 'react';
import { config } from '../config';
import FullSizeImageModal from './FullSizeImageModal';

const LabelForm = ({ image, onSubmit, onCancel }) => {
  const [labels, setLabels] = useState({
    breed: '',
    age: '',
    coat: '',
    health: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [showFullSizeImage, setShowFullSizeImage] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      // Convert form data to the format expected by the API
      const formattedLabels = Object.keys(labels).map(key => ({
        type: key,
        value: labels[key]
      })).filter(label => label.value); // Only include labels with values
      
      await onSubmit(image.imageId, formattedLabels);
    } catch (error) {
      console.error('Error submitting labels:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setLabels(prev => ({ ...prev, [name]: value }));
  };

  if (!image) {
    return <p className="text-center">Select an image to label</p>;
  }

  return (
    <>
      <div className="card">
        <div className="card-header">
          <h5 className="mb-0">Label Image</h5>
        </div>
        <div className="card-body">
          <div className="text-center mb-3">
            <img 
              src={image.thumbnailUrl} 
              alt="Pet to label"
              className="img-fluid" 
              style={{ maxHeight: '300px' }}
            />
            <div className="mt-2">
              <button 
                type="button" 
                className="btn btn-sm btn-outline-primary"
                onClick={() => setShowFullSizeImage(true)}
              >
                <i className="bi bi-search"></i> View Full Size
              </button>
            </div>
          </div>
          
          <form onSubmit={handleSubmit}>
            {config.labelTypes.map(labelType => (
              <div className="mb-3" key={labelType.id}>
                <label htmlFor={labelType.id} className="form-label">{labelType.name}</label>
                <select 
                  id={labelType.id}
                  name={labelType.id}
                  className="form-select"
                  value={labels[labelType.id]}
                  onChange={handleChange}
                >
                  <option value="">Select {labelType.name}</option>
                  {labelType.options.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
            ))}
            
            <div className="d-flex justify-content-end gap-2">
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={onCancel}
                disabled={submitting}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn btn-primary" 
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Submitting...
                  </>
                ) : 'Submit Labels'}
              </button>
            </div>
          </form>
        </div>
      </div>
      
      {showFullSizeImage && (
        <FullSizeImageModal 
          image={image} 
          onClose={() => setShowFullSizeImage(false)} 
        />
      )}
    </>
  );
};

export default LabelForm;