import React, { useState, useEffect } from 'react';
import Dashboard from '../components/Dashboard';
import { dashboardApi } from '../services/api';

const DashboardPage = () => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showOnlyMine, setShowOnlyMine] = useState(false);
  const [error, setError] = useState(null);

  // Function to fetch metrics
  const fetchMetrics = async () => {
    try {
      setLoading(true);
      console.log("Fetching dashboard metrics...");
      
      const data = await dashboardApi.getMetrics();
      console.log("Metrics received:", data);
      
      // Check if recentActivity exists and has data
      if (!data.recentActivity) {
        console.log("No recent activity data found in the response");
        data.recentActivity = [];
      } else {
        console.log(`Received ${data.recentActivity.length} activity entries`);
      }

      setMetrics(data);
      setError(null);
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
      setError('Failed to load dashboard metrics. Please try again later.');
      
      // Keep any previously loaded metrics
    } finally {
      setLoading(false);
    }
  };

  // Manual refresh function
  const handleRefresh = () => {
    console.log("Manual refresh requested");
    fetchMetrics();
  };

  // Initial load
  useEffect(() => {
    console.log("Dashboard page effect running, fetching metrics...");
    fetchMetrics();
    
    // No automatic refresh
  }, []); // Empty dependency array means this only runs on mount

  return (
    <div>
      {/* Dashboard */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Dashboard</h2>
        <div>
          <button 
            className={`btn ${showOnlyMine ? 'btn-primary' : 'btn-outline-primary'} me-2`}
            onClick={() => setShowOnlyMine(!showOnlyMine)}
          >
            <i className="bi bi-person-fill me-1"></i> 
            {showOnlyMine ? 'My Activity' : 'All Activity'}
          </button>
          <button 
            className="btn btn-outline-primary" 
            onClick={handleRefresh}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Refreshing...
              </>
            ) : (
              <>
                <i className="bi bi-arrow-clockwise me-1"></i> Refresh
              </>
            )}
          </button>
        </div>
      </div>
      
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}
      
      {loading && !metrics ? (
        <div className="d-flex justify-content-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : (
        <Dashboard metrics={metrics} showOnlyMine={showOnlyMine} />
      )}
      
      {/* Display timestamp of last refresh */}
      {metrics && (
        <div className="text-end mt-3 text-muted">
          <small>Last refreshed: {new Date().toLocaleTimeString()}</small>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;