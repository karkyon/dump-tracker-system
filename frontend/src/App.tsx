import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import UserManagement from './pages/UserManagement';
import VehicleManagement from './pages/VehicleManagement';
import InspectionItemManagement from './pages/InspectionItemManagement';
import LocationManagement from './pages/LocationManagement';
import CargoTypeManagement from './pages/CargoTypeManagement';
import OperationRecords from './pages/OperationRecords';
import GPSMonitoring from './pages/GPSMonitoring';
import ReportOutput from './pages/ReportOutput';
import SystemSettings from './pages/SystemSettings';

// Private Route Component
const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuthStore();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

// Public Route Component (redirect if already authenticated)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuthStore();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <>{children}</>;
};

const App: React.FC = () => {
  return (
    <Router>
      <div className="App">
        <Routes>
          {/* Public Routes */}
          <Route 
            path="/login" 
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            } 
          />

          {/* Private Routes */}
          <Route 
            path="/dashboard" 
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            } 
          />
          
          <Route 
            path="/users" 
            element={
              <PrivateRoute>
                <UserManagement />
              </PrivateRoute>
            } 
          />
          
          <Route 
            path="/vehicles" 
            element={
              <PrivateRoute>
                <VehicleManagement />
              </PrivateRoute>
            } 
          />
          
          <Route 
            path="/inspection-items" 
            element={
              <PrivateRoute>
                <InspectionItemManagement />
              </PrivateRoute>
            } 
          />
          
          <Route 
            path="/locations" 
            element={
              <PrivateRoute>
                <LocationManagement />
              </PrivateRoute>
            } 
          />
          
          <Route 
            path="/cargo-types" 
            element={
              <PrivateRoute>
                <CargoTypeManagement />
              </PrivateRoute>
            } 
          />
          
          <Route 
            path="/operations" 
            element={
              <PrivateRoute>
                <OperationRecords />
              </PrivateRoute>
            } 
          />
          
          <Route 
            path="/gps-monitoring" 
            element={
              <PrivateRoute>
                <GPSMonitoring />
              </PrivateRoute>
            } 
          />
          
          <Route 
            path="/reports" 
            element={
              <PrivateRoute>
                <ReportOutput />
              </PrivateRoute>
            } 
          />
          
          <Route 
            path="/settings" 
            element={
              <PrivateRoute>
                <SystemSettings />
              </PrivateRoute>
            } 
          />

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          
          {/* 404 Page */}
          <Route 
            path="*" 
            element={
              <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                  <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
                  <p className="text-lg text-gray-600 mb-8">ページが見つかりません</p>
                  <a 
                    href="/dashboard" 
                    className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
                  >
                    ダッシュボードに戻る
                  </a>
                </div>
              </div>
            } 
          />
        </Routes>

        {/* Global Toast Notifications */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              style: {
                background: '#10B981',
              },
            },
            error: {
              style: {
                background: '#EF4444',
              },
            },
          }}
        />
      </div>
    </Router>
  );
};

export default App;