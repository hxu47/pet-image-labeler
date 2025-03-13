import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import DashboardPage from './pages/DashboardPage';
import LabelingPage from './pages/LabelingPage';
import UploadPage from './pages/UploadPage';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Header />
        <main className="container mt-4">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/label" element={<LabelingPage />} />
            <Route path="/upload" element={<UploadPage />} />
          </Routes>
        </main>
        <footer className="footer mt-auto py-3 bg-light">
          <div className="container text-center">
            <span className="text-muted">Pet Image Labeling System © 2025</span>
          </div>
        </footer>
      </div>
    </Router>
  );
}

export default App;