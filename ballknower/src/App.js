import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { GameProvider } from './context/GameContext';
import Home from './pages/Home';
import OnlineGameBoard from './components/OnlineGameBoard';
import GameOver from './pages/GameOver';
import Profile from './pages/Profile';
import DailyGame from './components/DailyGame';
import DailyResult from './pages/DailyResult';
import PastDailyChallenges from './pages/PastDailyChallenges';
import { trackPageView } from './utils/analytics';
import { BASE_PATH } from './config/basePath';
import './App.css';

// Analytics wrapper component to track page views
const AnalyticsTracker = () => {
  const location = useLocation();
  
  React.useEffect(() => {
    // Get the page name from the pathname
    const pageName = location.pathname === '/' 
      ? 'home' 
      : location.pathname.substring(1).replace(/\//g, '_');
    
    // Track the page view
    trackPageView(pageName);
  }, [location]);
  
  return null;
};

// Placeholder removed
// const OnlineGameBoardPlaceholder = () => (
//   <div>Loading Online Game Board... Component needs to be created!</div>
// );

// Route wrapper with analytics tracking
const AppRoutes = () => {
  return (
    <>
      <AnalyticsTracker />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/game/:gameId" element={<OnlineGameBoard />} />
        <Route path="/game-over" element={<GameOver />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/daily" element={<DailyGame />} />
        <Route path="/daily-result" element={<DailyResult />} />
        <Route path="/past-daily-challenges" element={<PastDailyChallenges />} />
      </Routes>
    </>
  );
};

function App() {
  return (
    <GameProvider>
      <Router basename={BASE_PATH}>
        <div className="min-h-screen bg-gray-100">
          <AppRoutes />
        </div>
      </Router>
    </GameProvider>
  );
}

export default App;
