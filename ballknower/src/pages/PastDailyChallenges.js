import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import Footer from '../components/Footer';

const PastDailyChallenges = () => {
  const navigate = useNavigate();
  const { getPlayer, getTeam } = useGame();
  
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Get current date in EST timezone for comparison
  const getCurrentDate = () => {
    const options = { 
      timeZone: 'America/New_York',
      year: 'numeric', 
      month: 'long', 
      day: 'numeric'
    };
    return new Date().toLocaleDateString('en-US', options);
  };
  
  // Convert date string (Month Day, Year) to a Date object
  const parseDate = (dateString) => {
    try {
      return new Date(dateString);
    } catch (err) {
      console.error("Error parsing date:", dateString, err);
      return null;
    }
  };
  
  // Handle click on a challenge to play it
  const handlePlayChallenge = (date) => {
    navigate(`/daily?date=${encodeURIComponent(date)}`);
  };
  
  // Format display name for challenge item
  const formatElementName = (type, id) => {
    if (type === 'player') {
      const player = getPlayer(id);
      return player ? player.name : id;
    } else if (type === 'team') {
      const team = getTeam(id);
      return team ? team.name : id;
    } else if (type === 'number') {
      return `#${id}`;
    } else if (type === 'college') {
      return id;
    }
    return id;
  };
  
  // Fetch past challenges
  useEffect(() => {
    const fetchPastChallenges = async () => {
      try {
        setLoading(true);
        
        // Current date (today's challenge should be excluded)
        const today = getCurrentDate();
        const todayDate = parseDate(today);
        
        // Get all challenges from Firestore
        const challengesRef = collection(db, "daily");
        const q = query(
          challengesRef,
          orderBy("__name__", "desc") // Order by document ID (date) descending
        );
        
        const querySnapshot = await getDocs(q);
        
        const fetchedChallenges = [];
        querySnapshot.forEach((doc) => {
          const dateString = doc.id;
          const dateObj = parseDate(dateString);
          
          // Skip this document if:
          // 1. It's today's challenge
          // 2. It's a future date
          // 3. Failed to parse the date
          if (dateString === today || !dateObj || (dateObj > todayDate)) {
            return;
          }
          
          const data = doc.data();
          fetchedChallenges.push({
            date: dateString,
            startId: data.startId,
            startType: data.startType,
            endId: data.endId,
            endType: data.endType,
            plays: data.plays || 0,
            dateObj: dateObj // Store the Date object for sorting
          });
        });
        
        // Sort by date (newest first)
        fetchedChallenges.sort((a, b) => b.dateObj - a.dateObj);
        
        setChallenges(fetchedChallenges);
      } catch (err) {
        console.error("Error fetching past challenges:", err);
        setError("Failed to load past challenges. Please try again later.");
      } finally {
        setLoading(false);
      }
    };
    
    fetchPastChallenges();
  }, []);
  
  return (
    <div className="min-h-screen bg-dark-bg text-arcade-text font-sans pb-4">
      <div className="max-w-4xl mx-auto px-6 sm:px-8 pt-4 sm:pt-8">
      {/* Header */}
      <div className="flex items-center mb-4 sm:mb-8 border-b border-slate-800 pb-3 sm:pb-6">
          <button
            onClick={() => navigate('/')}
            className="p-1.5 sm:p-2 rounded-full hover:bg-slate-800 transition-colors mr-2 sm:mr-4 text-slate-400 hover:text-white flex-shrink-0"
            title={"Back to Home"}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="font-heading text-2xl sm:text-3xl md:text-4xl leading-none tracking-wide text-white">
                PAST CHALLENGES
            </h1>
            <p className="text-slate-500 text-xs sm:text-sm font-mono mt-0.5">Play challenges you missed</p>
          </div>
        </div>
      
      {/* Content */}
      <div className="bg-card-bg rounded-lg sm:rounded-xl shadow-lg border border-slate-700 overflow-hidden">
        {loading ? (
          <div className="text-center py-8 sm:py-12">
            <div className="w-10 h-10 sm:w-12 sm:h-12 border-4 border-brand-blue border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="mt-3 sm:mt-4 text-slate-500 font-heading text-lg sm:text-xl">LOADING...</p>
          </div>
        ) : error ? (
          <div className="bg-red-900/20 border border-red-500/50 text-red-200 px-3 py-3 sm:px-6 sm:py-4 m-3 sm:m-6 rounded-lg font-mono text-xs sm:text-sm" role="alert">
            {error}
          </div>
        ) : challenges.length === 0 ? (
          <div className="text-center py-8 sm:py-12 px-4">
            <p className="text-slate-500 font-heading text-base sm:text-xl">NO ARCHIVED CHALLENGES FOUND</p>
          </div>
        ) : (
          <div className="max-h-[calc(100vh-12rem)] sm:max-h-[70vh] overflow-y-auto custom-scrollbar">
            <ul className="divide-y divide-slate-700/50">
              {challenges.map((challenge) => (
                <li key={challenge.date}>
                  <button 
                    onClick={() => handlePlayChallenge(challenge.date)}
                    className="w-full text-left transition-all hover:bg-slate-800/50 p-3 sm:p-6 group active:bg-slate-800/70"
                  >
                    <div className="flex justify-between items-start sm:items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-heading text-base sm:text-lg md:text-xl text-white group-hover:text-brand-blue transition-colors truncate">
                          {challenge.date}
                        </p>
                        <div className="flex flex-col sm:flex-row sm:items-center mt-1 sm:mt-2 gap-1 sm:gap-2 text-xs sm:text-sm text-slate-400">
                          <span className="font-mono truncate">{formatElementName(challenge.startType, challenge.startId)}</span>
                          <span className="text-brand-pink font-bold hidden sm:inline">→</span>
                          <span className="text-brand-pink font-bold sm:hidden">↓</span>
                          <span className="font-mono truncate">{formatElementName(challenge.endType, challenge.endId)}</span>
                        </div>
                      </div>
                      <div className="flex items-center flex-shrink-0">
                        <span className="text-slate-600 group-hover:text-brand-blue transition-colors font-heading text-base sm:text-xl md:text-2xl whitespace-nowrap">
                        PLAY →
                        </span>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      </div>
      <Footer />
    </div>
  );
};

export default PastDailyChallenges;
