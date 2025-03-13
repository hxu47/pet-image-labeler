import React from 'react';

const Dashboard = ({ metrics }) => {
  if (!metrics) {
    return <div className="text-center">Loading metrics...</div>;
  }

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
              {Object.keys(metrics.labelTypeDistribution || {}).map(labelType => (
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
              ))}
            </div>
          </div>
        </div>
        <div className="col-md-6">
          <div className="card mb-4">
            <div className="card-header">
              Recent Activity
            </div>
            <div className="card-body">
              <p className="card-text">This panel would display recent activity logs.</p>
              <ul className="list-group">
                <li className="list-group-item d-flex justify-content-between align-items-center">
                  10 new images uploaded
                  <span className="badge bg-primary rounded-pill">2 mins ago</span>
                </li>
                <li className="list-group-item d-flex justify-content-between align-items-center">
                  15 images labeled
                  <span className="badge bg-primary rounded-pill">10 mins ago</span>
                </li>
                <li className="list-group-item d-flex justify-content-between align-items-center">
                  New user registered
                  <span className="badge bg-primary rounded-pill">30 mins ago</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;