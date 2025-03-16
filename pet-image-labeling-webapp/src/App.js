import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import DashboardPage from './pages/DashboardPage';
import LabelingPage from './pages/LabelingPage';
import UploadPage from './pages/UploadPage';
import ProfilePage from './pages/ProfilePage';
import Login from './components/Login';
import Register from './components/Register';
import UnauthorizedPage from './components/UnauthorizedPage';
import { AuthProvider } from './components/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './App.css';
import DevLogin from './components/DevLogin';  // for local testing


function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Header />
          <main className="container mt-4">
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/unauthorized" element={<UnauthorizedPage />} />
              {/*for local testing*/}
              {process.env.NODE_ENV === 'development' && (
                <Route path="/dev-login" element={<DevLogin />} />
              )}
              {/* Protected routes */}
              <Route 
                path="/" 
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/label" 
                element={
                  <ProtectedRoute requireLabeler={true}>
                    <LabelingPage />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/upload" 
                element={
                  <ProtectedRoute>
                    <UploadPage />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/profile" 
                element={
                  <ProtectedRoute>
                    <ProfilePage />
                  </ProtectedRoute>
                } 
              />
            </Routes>
          </main>
          <footer className="footer mt-auto py-3 bg-light">
            <div className="container text-center">
              <span className="text-muted">Pet Image Labeling System © 2025</span>
            </div>
          </footer>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;