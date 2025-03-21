import React from 'react';
import { useAuth } from './AuthContext';

const Dashboard = ({ metrics, showOnlyMine }) => {
  const { currentUser } = useAuth();
  
  if (!metrics) {
    return <div className="text-center">Loading metrics...</div>;
  }

  console.log("Rendering Dashboard with metrics:", metrics);
  console.log("Activity data:", metrics.recentActivity);

  return (
    <div className="dashboard">
      <div className="row mb-4">
        <div className="col-md-4">
          <div className="card text-white bg-primary">
            <div className="card-body">
              <h5 className="card-title">Total Images</h5>
              <p className="card-text display-4">{metrics.totalImages}</p>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card text-white bg-success">
            <div className="card-body">
              <h5 className="card-title">Labeled Images</h5>
              <p className="card-text display-4">{metrics.labeledImages}</p>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card text-white bg-warning">
            <div className="card-body">
              <h5 className="card-title">Completion</h5>
              <p className="card-text display-4">{metrics.completionPercentage}%</p>
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-md-6">
          <div className="card mb-4">
            <div className="card-header">
              Label Distribution by Type
            </div>
            <div className="card-body">
              {Object.keys(metrics.labelTypeDistribution || {}).length > 0 ? (
                Object.keys(metrics.labelTypeDistribution).map(labelType => (
                  <div key={labelType} className="mb-3">
                    <h6>{labelType} ({metrics.labelTypeDistribution[labelType].total} labels)</h6>
                    {Object.keys(metrics.labelTypeDistribution[labelType].values || {}).map(value => (
                      <div key={value} className="mb-2">
                        <div className="d-flex justify-content-between">
                          <span>{value}</span>
                          <span>{metrics.labelTypeDistribution[labelType].values[value]}</span>
                        </div>
                        <div className="progress">
                          <div 
                            className="progress-bar" 
                            role="progressbar" 
                            style={{ width: `${(metrics.labelTypeDistribution[labelType].values[value] / metrics.labelTypeDistribution[labelType].total) * 100}%` }}
                            aria-valuenow={(metrics.labelTypeDistribution[labelType].values[value] / metrics.labelTypeDistribution[labelType].total) * 100}
                            aria-valuemin="0" 
                            aria-valuemax="100"
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              ) : (
                <div className="text-center py-3 text-muted">
                  <i className="bi bi-bar-chart" style={{ fontSize: '2rem' }}></i>
                  <p className="mt-2">No label data available yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="col-md-6">
          <div className="card mb-4">
            <div className="card-header">
              System Activity
            </div>
            <div className="card-body">
              {metrics.recentActivity && metrics.recentActivity.length > 0 ? (
                <ul className="list-group">
                  {metrics.recentActivity
                    .filter(activity => !showOnlyMine || activity.userId === currentUser?.username) // Filter by current user if showOnlyMine is true
                    .map((activity, index) => (
                      <li key={index} className="list-group-item d-flex justify-content-between align-items-center">
                        <div>
                          <span className={`badge me-2 ${activity.type === 'upload' ? 'bg-info' : 'bg-success'}`}>
                            {activity.type === 'upload' ? 'UPLOAD' : 'LABEL'}
                          </span>
                          {activity.description}
                          <div className="text-muted small">
                            {activity.details && (
                              <span className="me-2">{activity.details}</span>
                            )}
                            {activity.userName && (
                              <span><i className="bi bi-person me-1"></i>{activity.userName}</span>
                            )}
                          </div>
                        </div>
                        <span className="badge bg-primary rounded-pill">{activity.timeAgo}</span>
                      </li>
                  ))}
                </ul>
              ) : (
                <div className="text-center py-3">
                  <i className="bi bi-clock-history text-muted" style={{ fontSize: '2rem' }}></i>
                  <p className="mt-2 text-muted">No recent activity to display</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;