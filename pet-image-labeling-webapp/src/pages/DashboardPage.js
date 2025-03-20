import React, { useState, useEffect, useCallback } from 'react';
import Dashboard from '../components/Dashboard';
import { dashboardApi } from '../services/api';

const DashboardPage = () => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0); // Used to force refreshes

  // Extract fetchMetrics to a callback so it can be called manually
  const fetchMetrics = useCallback(async () => {
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
      
      // If we don't have metrics yet, set an empty structure
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
    console.log("Manual refresh requested");
    setRefreshKey(prevKey => prevKey + 1); // Increment refresh key to force re-render
  };

  useEffect(() => {
    console.log("Dashboard page effect running, fetching metrics...");
    fetchMetrics();
    
    // No automatic refresh interval - removed
    
    return () => {
      // No cleanup needed since we removed the interval
    };
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