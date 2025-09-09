import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// Initialize auth store on app start
import { useAuthStore } from './store/authStore';

// Check if user is already authenticated
const initAuth = () => {
  const token = localStorage.getItem('authToken');
  if (token) {
    // Validate token and set user state
    useAuthStore.getState().checkAuth();
  }
};

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container missing in index.html');
}

const root = createRoot(container);

// Initialize authentication
initAuth();

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);