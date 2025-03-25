import React, { useState, useEffect } from 'react';
import { adminApi } from '../services/api';
import { useAuth } from '../components/AuthContext';

const AdminPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const { isAdmin } = useAuth();

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const data = await adminApi.getAllUsers();
        
        // For each user, fetch their statistics
        const usersWithStats = await Promise.all(data.map(async (user) => {
          try {
            const stats = await adminApi.getUserStatistics(user.userId);
            return { ...user, stats };
          } catch (err) {
            console.error(`Failed to fetch stats for user ${user.userId}:`, err);
            return { 
              ...user, 
              stats: { imagesUploaded: 0, imagesLabeled: 0 } 
            };
          }
        }));
        
        setUsers(usersWithStats);
        setError(null);
      } catch (err) {
        setError('Failed to load users. Please try again later.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchUsers();
  }, []);

  const handleRoleChange = async (userId, newRole) => {
    try {
      setLoading(true);
      await adminApi.updateUserRole(userId, newRole);
      
      // Update local state
      setUsers(users.map(user => 
        user.userId === userId ? { ...user, role: newRole } : user
      ));
      
      setSuccess(`Role updated successfully for user ${userId}`);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to update user role. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) {
    return <div>You do not have permission to view this page.</div>;
  }

  return (
    <div>
      <h2 className="mb-4">Admin Panel</h2>
      
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
      
      <div className="card">
        <div className="card-header">
          <h5 className="mb-0">User Management</h5>
        </div>
        <div className="card-body">
          {loading ? (
            <div className="text-center">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-striped">
                <thead>
                  <tr>
                    <th>User ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Images Uploaded</th>
                    <th>Images Labeled</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length > 0 ? (
                    users.map((user) => (
                      <tr key={user.userId}>
                        <td>{user.userId}</td>
                        <td>{user.name}</td>
                        <td>{user.email}</td>
                        <td>
                          <span className={`badge ${
                            user.role === 'Admin' ? 'bg-danger' : 
                            user.role === 'Labeler' ? 'bg-success' : 
                            'bg-secondary'
                          }`}>
                            {user.role}
                          </span>
                        </td>
                        <td>{user.stats?.imagesUploaded || 0}</td>
                        <td>{user.stats?.imagesLabeled || 0}</td>
                        <td>
                          <div className="dropdown">
                            <button className="btn btn-sm btn-outline-primary dropdown-toggle" type="button" data-bs-toggle="dropdown">
                              Change Role
                            </button>
                            <ul className="dropdown-menu">
                              <li>
                                <button 
                                  className="dropdown-item" 
                                  onClick={() => handleRoleChange(user.userId, 'Admin')}
                                  disabled={user.role === 'Admin'}
                                >
                                  Admin
                                </button>
                              </li>
                              <li>
                                <button 
                                  className="dropdown-item" 
                                  onClick={() => handleRoleChange(user.userId, 'Labeler')}
                                  disabled={user.role === 'Labeler'}
                                >
                                  Labeler
                                </button>
                              </li>
                              <li>
                                <button 
                                  className="dropdown-item" 
                                  onClick={() => handleRoleChange(user.userId, 'Viewer')}
                                  disabled={user.role === 'Viewer'}
                                >
                                  Viewer
                                </button>
                              </li>
                            </ul>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="text-center">No users found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPage;