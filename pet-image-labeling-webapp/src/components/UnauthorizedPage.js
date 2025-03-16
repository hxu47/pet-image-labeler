import React from 'react';
import { Link } from 'react-router-dom';

const UnauthorizedPage = () => {
  return (
    <div className="container mt-5 text-center">
      <div className="card">
        <div className="card-body">
          <h1 className="text-danger mb-4">
            <i className="bi bi-exclamation-triangle-fill"></i> Unauthorized Access
          </h1>
          <p className="lead">
            You don't have permission to access this page.
          </p>
          <p>
            Please contact an administrator if you believe this is a mistake.
          </p>
          <Link to="/" className="btn btn-primary mt-3">
            Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};

export default UnauthorizedPage;