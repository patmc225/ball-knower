import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db, ensureAnonymousUser } from '../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';

const Leaderboard = () => {
  const navigate = useNavigate();
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);

  const getLatestElo = (elo) => Array.isArray(elo) ? (elo.length > 0 ? elo[elo.length-1] : 1000) : (elo || 1000);

  useEffect(() => {
    const initUser = async () => {
      try {
        const user = await ensureAnonymousUser();
        if (user) {
          const userRef = doc(db, "users", user.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            setUserProfile({ uid: user.uid, ...userSnap.data() });
          }
        }
      } catch (error) {
        console.error("Error initializing user:", error);
      }
    };
    initUser();
  }, []);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        setLoading(true);
        const usersRef = collection(db, "users");
        const q = query(usersRef, orderBy("stats.eloRating", "desc"));
        const querySnapshot = await getDocs(q);
        const leaderboard = [];
        
        querySnapshot.forEach((doc) => {
          const userData = doc.data();
          const eloRating = getLatestElo(userData.stats?.eloRating);
          const wins = userData.stats?.wins || 0;
          const losses = userData.stats?.losses || 0;
          leaderboard.push({
            uid: doc.id,
            displayName: userData.displayName || 'Anonymous Player',
            eloRating: eloRating,
            wins: wins,
            losses: losses
          });
        });
        
        leaderboard.sort((a, b) => b.eloRating - a.eloRating);
        setLeaderboardData(leaderboard);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching leaderboard:", error);
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  return (
    <div className="min-h-screen bg-dark-bg text-arcade-text font-sans pb-4">
      <div className="max-w-4xl mx-auto px-6 sm:px-8 pt-4 sm:pt-8">
        
        <div className="flex items-center gap-4 mb-8 border-b border-slate-800 pb-4">
            <button
                onClick={() => navigate('/profile')}
                className="text-slate-400 hover:text-white transition-colors"
            >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
            </button>
            <h1 className="font-heading text-3xl sm:text-4xl text-white tracking-wide">LEADERBOARD</h1>
        </div>

        <div className="bg-card-bg rounded-xl shadow-lg border border-slate-700 overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-slate-700">
                <h2 className="font-heading text-2xl sm:text-3xl text-white">TOP 25 BALL KNOWERS</h2>
            </div>
            {loading ? (
                <div className="p-12 text-center"><div className="inline-block w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div></div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-900/50 text-slate-400 text-[8px] sm:text-xs uppercase tracking-wider">
                            <tr>
                                <th className="p-3 sm:p-4 font-medium">Rank</th>
                                <th className="p-3 sm:p-4 font-medium">Player</th>
                                <th className="p-3 sm:p-4 font-medium">Rating</th>
                                <th className="p-3 sm:p-4 font-medium">Record</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50 text-[10px] sm:text-sm">
                            {leaderboardData.slice(0, 25).map((player, i) => (
                                <tr key={player.uid} className={`hover:bg-slate-800/50 transition-colors ${userProfile && player.uid === userProfile.uid ? 'bg-brand-blue/10 border-l-2 border-brand-blue' : ''}`}>
                                    <td className="p-3 sm:p-4 font-heading text-sm sm:text-xl text-slate-300">#{i + 1}</td>
                                    <td className="p-3 sm:p-4 text-white underline max-w-[120px] truncate sm:max-w-none">
                                        <button 
                                            onClick={() => navigate(`/profile/${player.uid}`)}
                                            className="underline hover:text-brand-blue transition-all text-left"
                                        >
                                            {player.displayName}
                                        </button>
                                    </td>
                                    <td className="p-3 sm:p-4 font-mono text-brand-blue">{player.eloRating}</td>
                                    <td className="p-3 sm:p-4 text-slate-400">{player.wins} - {player.losses}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;

