import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useGame } from '../context/GameContext';
import { ArcadeButton, ArcadeCard } from '../components/ArcadeUI';
import Footer from '../components/Footer';

const DailyResult = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { getPlayer, getTeam } = useGame();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dailyData, setDailyData] = useState(null);
  const [userMoves, setUserMoves] = useState(0);
  const [averageMoves, setAverageMoves] = useState(0);
  const [shareMessage, setShareMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [isPastChallenge, setIsPastChallenge] = useState(false);
  
  // Get query parameters
  const queryParams = new URLSearchParams(location.search);
  const date = queryParams.get('date');
  const userMoveCount = queryParams.get('moves');
  
  // Helper function to get current date in "Month Day, Year" format (Eastern Time)
  const getCurrentDate = () => {
    const options = { 
      timeZone: 'America/New_York',
      year: 'numeric', 
      month: 'long', 
      day: 'numeric'
    };
    return new Date().toLocaleDateString('en-US', options);
  };
  
  // Load data when component mounts
  useEffect(() => {
    const loadDailyData = async () => {
      if (!date) {
        setError('No date provided');
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        setError(null);
        
        // Check if this is a past challenge
        const today = getCurrentDate();
        setIsPastChallenge(date !== today);
        
        // Load the daily challenge data
        const dailyRef = doc(db, "daily", date);
        const dailySnap = await getDoc(dailyRef);
        
        if (dailySnap.exists()) {
          const data = dailySnap.data();
          setDailyData(data);
          
          // Set user's move count
          setUserMoves(parseInt(userMoveCount) || 0);
          
          // Calculate average moves
          const totalMoves = data.moves || 0;
          const totalPlays = data.plays || 0;
          const avg = totalPlays > 0 ? (totalMoves / totalPlays).toFixed(1) : 0;
          setAverageMoves(avg);
          
          // Get start and end element names for share message
          let startName = '';
          let endName = '';
          
          if (data.startType === 'player') {
            const player = getPlayer(data.startId);
            startName = player ? player.name : data.startId;
          } else if (data.startType === 'team') {
            const team = getTeam(data.startId);
            startName = `the ${team ? team.name : data.startId}`;
          } else if (data.startType === 'number') {
            startName = `the #${data.startId}`;
          } else if (data.startType === 'college') {
            startName = data.startId;
          }
          
          if (data.endType === 'player') {
            const player = getPlayer(data.endId);
            endName = player ? player.name : data.endId;
          } else if (data.endType === 'team') {
            const team = getTeam(data.endId);
            endName = `the ${team ? team.name : data.endId}`;
          } else if (data.endType === 'number') {
            endName = `the #${data.endId}`;
          } else if (data.endType === 'college') {
            endName = data.endId;
          }
          
          // Create share message
          const shareMsg = `I connected ${startName} to ${endName} in ${userMoveCount} moves. Play the Ball Knower Daily Challenge today: https://ballknower.co`;
          setShareMessage(shareMsg);
        } else {
          setError('Daily challenge data not found');
        }
      } catch (err) {
        console.error("Error loading daily result data:", err);
        setError('Failed to load results. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    loadDailyData();
  }, [date]);
  
  // Format date for display
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return dateStr; // Already in format "Month Day, Year"
  };
  
  // Handle copy share message
  const handleCopyShareMessage = () => {
    navigator.clipboard.writeText(shareMessage)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(err => {
        console.error('Failed to copy: ', err);
      });
  };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-dark-bg">
        <div className="w-12 h-12 border-4 border-brand-pink border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-dark-bg p-4">
        <div className="max-w-md w-full bg-card-bg border border-red-500/30 rounded-2xl p-8 text-center shadow-2xl">
          <div className="text-red-500 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-3xl font-heading text-white mb-2">ERROR</h2>
          <p className="text-slate-400 mb-6">{error}</p>
          <ArcadeButton onClick={() => navigate('/')} className="w-full">
            RETURN HOME
          </ArcadeButton>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-dark-bg text-arcade-text font-sans pb-4 flex flex-col">
      <div className="flex-grow flex items-center justify-center">
        <div className="max-w-xl w-full px-6 pt-4 sm:pt-8">
        
        <ArcadeCard glow="pink" className="w-full text-center">
          <div className="mb-4 sm:mb-8">
              <h1 className="font-heading text-3xl md:text-6xl text-white mb-2 tracking-wide text-glow-pink">
                COMPLETED
              </h1>
              <p className="text-slate-400 text-xs sm:text-sm uppercase tracking-widest font-mono">
                {formatDate(date)}
              </p>
          </div>
          
          {/* Main Stats */}
          <div className="bg-gradient-to-b from-brand-pink/20 to-transparent p-4 sm:p-6 rounded-xl border border-brand-pink/30 mb-4 sm:mb-8">
            <div className="text-slate-300 text-xs sm:text-sm uppercase tracking-widest mb-2">Your Path</div>
            <div className="text-4xl md:text-8xl font-heading text-white leading-none mb-2">
              {userMoves}
            </div>
            <div className="text-brand-pink font-bold text-sm sm:text-lg">MOVES</div>
            
            <div className="mt-4 pt-4 border-t border-white/10 text-sm text-slate-400">
              {userMoves === dailyData?.shortestPath 
                ? <span className="text-neon-green font-bold flex items-center justify-center gap-2">🏆 Perfect Run! That's the shortest path.</span> 
                : `The shortest path was ${dailyData?.shortestPath} moves.`}
            </div>
          </div>
          
          {/* Comparison Grid */}
          <div className="grid grid-cols-1 gap-4 mb-8">
              <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                  <div className="text-slate-500 text-xs uppercase tracking-widest mb-1">Community Average</div>
                  <div className="font-heading text-3xl text-white">{averageMoves}</div>
              </div>
          </div>
            
          {/* Actions */}
          <div className="space-y-4">
            <ArcadeButton
              onClick={handleCopyShareMessage}
              variant={copied ? 'success' : 'secondary'}
              className="w-full"
              size="lg"
            >
              {copied ? 'COPIED TO CLIPBOARD!' : 'SHARE RESULT'}
            </ArcadeButton>
            
            <button
              onClick={() => navigate('/')}
              className="w-full py-3 sm:py-4 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 font-heading text-lg sm:text-xl transition-colors"
            >
              BACK TO HOME
            </button>
          </div>
          
          <div className="mt-8 text-slate-600 text-xs">
            New challenge available tomorrow at midnight EST.
          </div>
        </ArcadeCard>
     
      </div>
      </div>
      <Footer />
    </div>
  );
};

export default DailyResult;
