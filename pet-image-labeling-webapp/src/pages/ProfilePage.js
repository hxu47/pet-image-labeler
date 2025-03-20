import React, { useState, useEffect } from 'react';
import { useAuth } from '../components/AuthContext';
import { userApi } from '../services/api';

const ProfilePage = () => {
  const { currentUser, isAdmin, isLabeler } = useAuth();
  const [userData, setUserData] = useState({
    name: '',
    email: ''
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true);
        
        // Use the authenticated user data from Cognito
        if (currentUser) {
          setUserData({
            name: currentUser.attributes?.name || currentUser.username,
            email: currentUser.attributes?.email || '',
          });
        }
        
        // Try to get additional user data from our API
        try {
          const apiUserData = await userApi.getUserProfile();
          if (apiUserData) {
            // Merge any additional data from API with Cognito data
            setUserData(prevData => ({
              ...prevData,
              ...apiUserData
            }));
          }

          // Fetch user statistics
          const stats = await userApi.getUserStatistics();
          setUserData(prevData => ({
            ...prevData,
            stats
          }));
          
          // Fetch user activity
          const activity = await userApi.getUserActivity();
          setUserData(prevData => ({
            ...prevData,
            recentActivity: activity
          }));

        } catch (err) {
          console.warn('Could not fetch additional user data from API', err);
          // Set default values for stats and activity
          setUserData(prevData => ({
            ...prevData,
            stats: {
              imagesUploaded: 0,
              imagesLabeled: 0
            },
            recentActivity: []
          }));        
        }
        
        setError(null);
      } catch (err) {
        console.error('Error loading user profile:', err);
        setError('Failed to load profile data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserData();
  }, [currentUser]);

  // Function to display role badges
  const renderRoleBadges = () => {
    const badges = [];
    
    if (isAdmin) {
      badges.push(
        <span key="admin" className="badge bg-danger me-2">Administrator</span>
      );
    }
    
    if (isLabeler) {
      badges.push(
        <span key="labeler" className="badge bg-success me-2">Labeler</span>
      );
    }
    
    if (!isAdmin && !isLabeler) {
      badges.push(
        <span key="viewer" className="badge bg-secondary me-2">Viewer</span>
      );
    }
    
    return badges;
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
    <div className="container">
      <div className="row">
        <div className="col-lg-8 mx-auto">
          <div className="card">
            <div className="card-header">
              <h2 className="mb-0">User Profile</h2>
            </div>
            <div className="card-body">
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
              
              <div className="row mb-4">
                <div className="col-md-4 text-center">
                  <div className="profile-image mb-3">
                    <i className="bi bi-person-circle" style={{ fontSize: '6rem', color: '#0d6efd' }}></i>
                  </div>
                  <div>
                    {renderRoleBadges()}
                  </div>
                </div>
                <div className="col-md-8">
                  <h4 className="mb-3">{userData.name}</h4>
                  <p className="text-muted">
                    <i className="bi bi-envelope me-2"></i>
                    {userData.email}
                  </p>
                  
                  <hr />
                  
                  <div className="user-stats">
                    <h5>Statistics</h5>
                    <div className="row">
                      <div className="col-md-6">
                        <div className="card text-center mb-3">
                          <div className="card-body">
                            <h6 className="card-title">Images Uploaded</h6>
                            <p className="card-text fs-4">{userData.stats?.imagesUploaded || 0}</p>
                          </div>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="card text-center mb-3">
                          <div className="card-body">
                            <h6 className="card-title">Images Labeled</h6>
                            <p className="card-text fs-4">{userData.stats?.imagesLabeled || 0}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <hr />
              
              <h5 className="mb-3">Recent Activity</h5>
              <div className="recent-activity">
                {userData.recentActivity && userData.recentActivity.length > 0 ? (
                  <ul className="list-group">
                    {userData.recentActivity.map((activity, index) => (
                      <li key={index} className="list-group-item">
                        <div className="d-flex justify-content-between align-items-center">
                          <div>
                            <strong>{activity.type}</strong>
                            <p className="text-muted mb-0">{activity.details}</p>
                          </div>
                          <span className="badge bg-primary rounded-pill">{activity.timeAgo}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-center py-3">
                    <i className="bi bi-hourglass text-muted" style={{ fontSize: '2rem' }}></i>
                    <p className="mt-2 text-muted">No recent activity found</p>
                  </div>
                )}
              </div>
              
              <div className="mt-4">
                <button className="btn btn-secondary">
                  <i className="bi bi-pencil me-2"></i>
                  Edit Profile
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;