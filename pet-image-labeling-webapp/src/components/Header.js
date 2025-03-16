import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, isAdmin, logout } = useAuth();
  
  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };
  
  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-primary">
      <div className="container">
        <Link className="navbar-brand" to="/">Pet Image Labeling System</Link>
        <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className="collapse navbar-collapse" id="navbarNav">
          {currentUser ? (
            <>
              <ul className="navbar-nav me-auto">
                <li className="nav-item">
                  <Link 
                    className={`nav-link ${location.pathname === '/' ? 'active' : ''}`} 
                    to="/"
                  >
                    Dashboard
                  </Link>
                </li>
                <li className="nav-item">
                  <Link 
                    className={`nav-link ${location.pathname === '/label' ? 'active' : ''}`} 
                    to="/label"
                  >
                    Label Images
                  </Link>
                </li>
                <li className="nav-item">
                  <Link 
                    className={`nav-link ${location.pathname === '/upload' ? 'active' : ''}`} 
                    to="/upload"
                  >
                    Upload Images
                  </Link>
                </li>
                {isAdmin && (
                  <li className="nav-item">
                    <Link 
                      className={`nav-link ${location.pathname === '/admin' ? 'active' : ''}`} 
                      to="/admin"
                    >
                      Admin Panel
                    </Link>
                  </li>
                )}
              </ul>
              
              <ul className="navbar-nav ms-auto">
                <li className="nav-item dropdown">
                  <a 
                    className="nav-link dropdown-toggle" 
                    href="#" 
                    id="navbarDropdown" 
                    role="button" 
                    data-bs-toggle="dropdown" 
                    aria-expanded="false"
                  >
                    {currentUser.attributes?.name || currentUser.username}
                    {isAdmin && <span className="badge bg-warning ms-2">Admin</span>}
                  </a>
                  <ul className="dropdown-menu dropdown-menu-end" aria-labelledby="navbarDropdown">
                    <li>
                      <Link className="dropdown-item" to="/profile">
                        Profile
                      </Link>
                    </li>
                    <li><hr className="dropdown-divider" /></li>
                    <li>
                      <button 
                        className="dropdown-item text-danger" 
                        onClick={handleLogout}
                      >
                        Logout
                      </button>
                    </li>
                  </ul>
                </li>
              </ul>
            </>
          ) : (
            <ul className="navbar-nav ms-auto">
              <li className="nav-item">
                <Link 
                  className={`nav-link ${location.pathname === '/login' ? 'active' : ''}`} 
                  to="/login"
                >
                  Login
                </Link>
              </li>
              <li className="nav-item">
                <Link 
                  className={`nav-link ${location.pathname === '/register' ? 'active' : ''}`} 
                  to="/register"
                >
                  Register
                </Link>
              </li>
            </ul>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Header;