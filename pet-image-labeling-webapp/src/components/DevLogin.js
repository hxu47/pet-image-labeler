import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

const DevLogin = () => {
  const navigate = useNavigate();
  const { setCurrentUser, setIsAdmin, setIsLabeler } = useAuth();
  
  const handleDevLogin = () => {
    const mockUser = {
      username: 'dev@example.com',
      attributes: {
        name: 'Developer',
        email: 'dev@example.com'
      }
    };
    
    setCurrentUser(mockUser);
    setIsAdmin(true);
    setIsLabeler(true);
    
    // Navigate to the dashboard
    navigate('/');
  };
  
  return (
    <div className="container mt-5">
      <div className="row justify-content-center">
        <div className="col-md-6">
          <div className="card">
            <div className="card-header bg-warning">
              <h4 className="mb-0">Development Login</h4>
            </div>
            <div className="card-body">
              <p>This login bypasses authentication for local development.</p>
              <button 
                className="btn btn-warning" 
                onClick={handleDevLogin}
              >
                Log in as Developer (Bypass Auth)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DevLogin;