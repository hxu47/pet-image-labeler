import React, { useState, useEffect } from 'react';
import Dashboard from '../components/Dashboard';
import { dashboardApi } from '../services/api';

const DashboardPage = () => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchMetrics = async () => {
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
    };
    
    fetchMetrics();
    
    // Refresh metrics every 30 seconds
    const intervalId = setInterval(fetchMetrics, 30000);
    
    return () => {clearInterval(intervalId)};
  }, []);

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
      <h2 className="mb-4">Dashboard</h2>
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}
      <Dashboard metrics={metrics} />
    </div>
  );
};

export default DashboardPage;