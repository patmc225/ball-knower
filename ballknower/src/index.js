import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { ensureAnonymousUser, logAnalyticsEvent } from './firebaseConfig'; // Import the functions

// Ensure the user is signed in before rendering the app
ensureAnonymousUser().then((user) => {
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  
  // Log app_loaded event with user info
  if (user) {
    logAnalyticsEvent('app_loaded', {
      is_anonymous: user.isAnonymous,
      user_id: user.uid
    });
  }
}).catch(error => {
  console.error("Failed to ensure anonymous user:", error);
  // Optionally render an error message to the user
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(
    <div>Error initializing application. Please try again later.</div>
  );
});

// Track performance metrics via Google Analytics
reportWebVitals(metric => {
});
