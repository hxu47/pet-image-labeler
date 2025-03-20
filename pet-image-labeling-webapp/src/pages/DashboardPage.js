import React, { useState, useEffect, useCallback } from 'react';
import Dashboard from '../components/Dashboard';
import { dashboardApi } from '../services/api';

const DashboardPage = () => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0); // Add this to force refreshes

  // Extract fetchMetrics to a callback so it can be called manually
  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true);
      const data = await dashboardApi.getMetrics();

      // Fetch recent activity
      try {
        const activityData = await dashboardApi.getRecentActivity();
        data.recentActivity = activityData;
      } catch (err) {
        console.warn('Failed to load activity data', err);
        data.recentActivity = [];
      }

      setMetrics(data);
      setError(null);
    } catch (err) {
      setError('Failed to load dashboard metrics. Please try again later.');
      console.error(err);
      
      // Remove the mock data or clearly mark it as fallback data
      // Instead of using mock data, keep the previous metrics if any
      if (!metrics) {
        setMetrics({
          totalImages: 0,
          labeledImages: 0,
          unlabeledImages: 0,
          completionPercentage: 0,
          labelTypeDistribution: {},
          recentActivity: []
        });
      }
    } finally {
      setLoading(false);
    }
  }, [metrics]); // Include metrics in the dependency array

  // Manual refresh function
  const handleRefresh = () => {
    setRefreshKey(prevKey => prevKey + 1); // Increment refresh key to force re-render
  };

  useEffect(() => {
    fetchMetrics();
    
    // Refresh metrics every 30 seconds (uncommented)
    const intervalId = setInterval(fetchMetrics, 30000);
    
    return () => clearInterval(intervalId);
  }, [fetchMetrics, refreshKey]); // Add refreshKey as a dependency to force re-fetching

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Dashboard</h2>
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
        <Dashboard metrics={metrics} />
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