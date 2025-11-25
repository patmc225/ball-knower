import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { auth, ensureAnonymousUser } from '../firebaseConfig';
import { doc, getDoc, collection, query, where, getDocs, limit, orderBy, getCountFromServer } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Line } from 'react-chartjs-2';
import Header from '../components/Header';
import RarityCard from '../components/RarityCard';
import { useGame } from '../context/GameContext';
import { ArcadeButton } from '../components/ArcadeUI';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const Profile = () => {
  const navigate = useNavigate();
  const { userId } = useParams();
  const { getTeam, getPlayer, players, popularityData } = useGame();
  
  // State
  const [profileUser, setProfileUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userGames, setUserGames] = useState([]);
  const [isGamesLoading, setIsGamesLoading] = useState(false);
  const [userRank, setUserRank] = useState(null);
  const [rarityCache, setRarityCache] = useState({});
  const [expandedGameId, setExpandedGameId] = useState(null);
  const [showAllGames, setShowAllGames] = useState(false);
  const [activeUsersCount, setActiveUsersCount] = useState(0);

  // Utils
  const getLatestElo = (elo) => Array.isArray(elo) ? (elo.length > 0 ? elo[elo.length-1] : 1000) : (elo || 1000);

  // Determine if we are viewing our own profile
  const isMyProfile = !userId || (currentUser && currentUser.uid === userId);

  // Initial Data Load
  useEffect(() => {
    const init = async () => {
      setLoading(true);

      // 1. Get Current User (for auth state)
      let authUser = auth.currentUser;
      if (!authUser) {
         authUser = await ensureAnonymousUser();
      }
      setCurrentUser(authUser);

      // 2. Determine Target User ID
      const targetUid = userId || authUser?.uid;

      if (!targetUid) {
          setLoading(false);
          return;
      }

      const calculateUserRank = async (uid, userData) => {
        try {
          const userElo = getLatestElo(userData.stats?.eloRating);
          // Query for users with higher ELO rating
          // Since eloRating can be an array or single value, we need to check the latest value
          const snapshot = await getDocs(collection(db, "users"));
          let rank = 1; // Start at 1, will be incremented for each user with higher rating

          snapshot.forEach((doc) => {
            const data = doc.data();
            if (data.stats?.eloRating) {
              const theirElo = getLatestElo(data.stats.eloRating);
              if (theirElo > userElo) {
                rank++;
              }
            }
          });

          setUserRank(rank);
        } catch (error) { console.error("Error calculating rank:", error); }
      };

      // 3. Fetch Target User Profile
      try {
          const userRef = doc(db, "users", targetUid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
              setProfileUser({ uid: targetUid, ...userSnap.data() });
              fetchUserGames(targetUid);
              calculateUserRank(targetUid, userSnap.data());
          } else {
              console.error("User not found");
          }
      } catch (e) {
          console.error("Error loading profile:", e);
      } finally {
          setLoading(false);
      }
    };

    init();
  }, [userId]);

  // Fetch active users count
  useEffect(() => {
    const fetchActiveUsersCount = async () => {
      try {
        const usersRef = collection(db, "users");
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
        const q = query(usersRef, where("lastActive", ">=", twoMinutesAgo));
        const snapshot = await getCountFromServer(q);
        setActiveUsersCount(snapshot.data().count);
      } catch (err) {
        console.error("Error fetching active users:", err);
      }
    };

    fetchActiveUsersCount();
    // Refresh every 30 seconds
    const interval = setInterval(fetchActiveUsersCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchUserGames = async (targetUid) => {
    try {
      setIsGamesLoading(true);
      const gamesRef = collection(db, "games");
      const qA = query(gamesRef, where("players.A.id", "==", targetUid), where("status", "==", "finished"), orderBy("updatedAt", "desc"), limit(20));
      const qB = query(gamesRef, where("players.B.id", "==", targetUid), where("status", "==", "finished"), orderBy("updatedAt", "desc"), limit(20));
      const [snapA, snapB] = await Promise.all([getDocs(qA), getDocs(qB)]);
      
      let allGames = [];
      const processGame = (doc, role) => {
          const g = doc.data();
          const userWon = g.winner === role;
          const opponent = role === 'A' ? g.players.B : g.players.A;
          const endTime = g.updatedAt?.toDate ? g.updatedAt.toDate() : new Date(g.updatedAt);
          const moveCount = g.history?.filter(m => ['player','number','team','college'].includes(m.type)).length || 0;
          
          allGames.push({
              id: doc.id,
              opponentName: opponent?.name || 'Unknown',
              opponentElo: opponent?.elo || '?',
              date: endTime,
              userWon,
              moveCount,
              history: g.history || [],
              userRole: role,
              timestamp: endTime.getTime()
          });
      };
      snapA.forEach(d => processGame(d, 'A'));
      snapB.forEach(d => processGame(d, 'B'));
      allGames.sort((a, b) => b.timestamp - a.timestamp);
      setUserGames(allGames);
      setIsGamesLoading(false);
    } catch (e) { console.error(e); setIsGamesLoading(false); }
  };


  // Calculate Top Rarities
  const topRarityCards = React.useMemo(() => {
    if (!userGames.length) return [];
    const uniqueCards = {};
    userGames.forEach(game => {
        if (!game.history) return;
        game.history.forEach(move => {
            if (move.player === game.userRole && ['player', 'team', 'number', 'college'].includes(move.type)) {
                const key = `${move.type}_${move.value}`;
                if (!uniqueCards[key]) {
                    uniqueCards[key] = { type: move.type, value: move.value, count: 0 };
                }
                uniqueCards[key].count++;
            }
        });
    });

    // Check for showcase (if implemented in future)
    if (profileUser?.showcase && profileUser.showcase.length > 0) {
        return profileUser.showcase.map(item => {
            const key = `${item.type}_${item.value}`;
            const existing = uniqueCards[key] || { ...item, count: 0 };
            return {
                ...existing,
                score: rarityCache[`${item.type}_${item.value}`] || 0
            };
        });
    }

    return Object.values(uniqueCards)
        .map(item => ({ ...item, score: rarityCache[`${item.type}_${item.value}`] || 0 }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 4);
  }, [userGames, rarityCache, profileUser]);

  // Fetch rarity for collected items
  useEffect(() => {
    if (!userGames.length) return; 
    
    const allItems = [];
    userGames.forEach(game => {
        if (!game.history) return;
        game.history.forEach(move => {
            if (move.player === game.userRole && ['player', 'team', 'number', 'college'].includes(move.type)) {
                allItems.push({ type: move.type, value: move.value });
            }
        });
    });

    const fetchMissingRarity = async () => {
        const missingItems = allItems.filter(item => rarityCache[`${item.type}_${item.value}`] === undefined);
        if (missingItems.length === 0) return;

        const uniqueMissing = [];
        const seen = new Set();
        missingItems.forEach(item => {
            const key = `${item.type}_${item.value}`;
            if(!seen.has(key)) { seen.add(key); uniqueMissing.push(item); }
        });

        const newUpdates = {};
        
        await Promise.all(uniqueMissing.map(async (item) => {
            const key = `${item.type}_${item.value}`;
            const safeVal = String(item.value).replace(/\//g, '_');
            const docId = `${item.type}_${safeVal}`;
            try {
                const snap = await getDoc(doc(db, "rarity", docId));
                if (snap.exists()) {
                    newUpdates[key] = snap.data().score ?? snap.data().rarity ?? 100;
                } else {
                    newUpdates[key] = 100;
                }
            } catch (e) {
                console.error("Rarity fetch error", e);
                newUpdates[key] = 100;
            }
        }));
        
        setRarityCache(prev => ({ ...prev, ...newUpdates }));
    };
    
    fetchMissingRarity();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userGames]);

  if (loading) {
      return <div className="min-h-screen bg-dark-bg flex items-center justify-center"><div className="w-12 h-12 border-4 border-brand-blue border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (!profileUser) {
      return (
        <div className="min-h-screen bg-dark-bg text-white flex items-center justify-center flex-col p-4">
            <h2 className="font-heading text-3xl mb-4">User not found</h2>
            <ArcadeButton onClick={() => navigate('/')}>Home</ArcadeButton>
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-dark-bg text-arcade-text font-sans pb-4">
      <div className="max-w-4xl mx-auto px-6 sm:px-8 pt-4 sm:pt-8">

      {isMyProfile && <Header activeTab="profile" activeUsersCount={activeUsersCount} />}

      {/* Username Section */}
      {isMyProfile ? (
        <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                </div>
                <div>
                    <h1 className="font-heading text-xl text-white">{profileUser.displayName || 'Anonymous'}</h1>
                    {isMyProfile && currentUser?.isAnonymous && (
                        <p className="text-xs text-yellow-500/80">Temporary account - may not save</p>
                    )}
                </div>
            </div>

            {isMyProfile && (
                <button
                    onClick={() => navigate('/edit-account')}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors border border-slate-600"
                    title="Settings"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                </button>
            )}
        </div>
      ) : (
        /* Public Profile Header */
        <div className="flex items-center gap-4 mb-8 border-b border-slate-800 pb-6">
            <button
                onClick={() => navigate('/leaderboard')}
                className="text-slate-400 hover:text-white transition-colors"
            >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
            </button>
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                </div>
                <h1 className="font-heading text-2xl text-white">{profileUser.displayName || 'Anonymous'}</h1>
            </div>
        </div>
      )}

        {/* Card Preview */}
        <div className="mb-10">
            <div className="flex justify-between items-center mb-8 px-4">
                <h3 className="font-heading text-md text-white">FAVORITES</h3>
                <button onClick={() => navigate(userId ? `/collection/${userId}` : '/collection')} className=" Cre hover:text-brand-blue transition-colors text-xs text-slate-500">Full Collection &rarr;</button>
            </div>
            {isGamesLoading ? (
                <div className="flex items-center justify-center py-16">
                    <div className="w-12 h-12 border-4 border-brand-blue border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : topRarityCards.length > 0 ? (
                <div className="grid grid-cols-4">
                    {topRarityCards.map((item, i) => (
                        <div key={i} className="flex justify-center items-center">
                            <div className="transform scale-[0.55] sm:scale-75 md:scale-90 lg:scale-100 -my-[72px] sm:-my-12 md:-my-6 lg:my-0">
                                <RarityCard 
                                    type={item.type} 
                                    value={item.value} 
                                    count={item.count}
                                    rarityScore={item.score}
                                    playerData={item.type === 'player' ? getPlayer(item.value) : null}
                                    getTeam={getTeam}
                                    clickable={true}
                                    // Disable "You/Opp" indicator for profile preview
                                    isMe={undefined}
                                    allPlayersData={players}
                                    popularityData={popularityData}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center text-slate-500 py-16 bg-slate-900/30 rounded-xl border border-slate-800 border-dashed">
                    No cards collected yet.
                </div>
            )}
        </div>

        {/* Stats Section */}
        <div>
                <div className="space-y-6 animate-fade-in">
                    {/* Overview Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-card-bg p-5 rounded-xl border border-slate-700">
                            <div className="text-slate-500 text-xs uppercase tracking-wider mb-1">Rating</div>
                            <div className="font-heading text-4xl text-brand-blue">{getLatestElo(profileUser.stats?.eloRating)}</div>
                        </div>
                        <div className="bg-card-bg p-5 rounded-xl border border-slate-700">
                            <div className="text-slate-500 text-xs uppercase tracking-wider mb-1">Global Rank</div>
                            <div className="font-heading text-4xl text-white">#{userRank || '-'}</div>
                        </div>
                        <div className="bg-card-bg p-5 rounded-xl border border-slate-700">
                            <div className="text-slate-500 text-xs uppercase tracking-wider mb-1">Games Played</div>
                            <div className="font-heading text-4xl text-white">{(profileUser.stats?.wins || 0) + (profileUser.stats?.losses || 0)}</div>
                        </div>
                        <div className="bg-card-bg p-5 rounded-xl border border-slate-700">
                            <div className="text-slate-500 text-xs uppercase tracking-wider mb-1">Win Rate</div>
                            <div className="font-heading text-4xl text-neon-green">
                                {(() => {
                                    const w = profileUser.stats?.wins || 0;
                                    const l = profileUser.stats?.losses || 0;
                                    return (w + l) > 0 ? Math.round((w / (w + l)) * 100) + '%' : '-';
                                })()}
                            </div>
                        </div>
                    </div>

                    {/* See Rankings Button */}
                    <div className="flex justify-end">
                        <button 
                            onClick={() => navigate('/leaderboard')}
                            className="text-brand-blue hover:text-white font-heading text-sm uppercase tracking-wider transition-colors flex items-center gap-2"
                        >
                            See Top 25 Rankings
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                        </button>
                    </div>

                    {/* Chart */}
                    <div className="bg-card-bg p-6 rounded-xl border border-slate-700">
                        <h3 className="font-heading text-2xl text-white mb-4">RATING HISTORY</h3>
                        <div className="h-64 w-full">
                            {profileUser.stats?.eloRating ? (
                                <Line 
                                data={{
                                    labels: (Array.isArray(profileUser.stats.eloRating) ? profileUser.stats.eloRating : [profileUser.stats.eloRating]).map((_, i) => `Game ${i+1}`),
                                    datasets: [{
                                        label: 'Rating',
                                        data: Array.isArray(profileUser.stats.eloRating) ? profileUser.stats.eloRating : [profileUser.stats.eloRating],
                                        borderColor: '#3b82f6',
                                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                        tension: 0.1,
                                        fill: true
                                    }]
                                }}
                                options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: { legend: { display: false } },
                                    scales: {
                                        x: { display: false },
                                        y: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' } }
                                    }
                                }}
                                />
                            ) : <div className="text-slate-500 text-center pt-20">No history available</div>}
                        </div>
                    </div>

                    {/* Recent Games */}
                    <div className="bg-card-bg rounded-xl border border-slate-700 overflow-hidden">
                        <div className="p-6 border-b border-slate-700 flex justify-between items-center">
                            <h3 className="font-heading text-2xl text-white">RECENT MATCHES</h3>
                        </div>
                        <div>
                            {isGamesLoading ? (
                                <div className="p-8 text-center text-slate-500">Loading history...</div>
                            ) : userGames.length === 0 ? (
                                <div className="p-8 text-center text-slate-500">No matches played yet.</div>
                            ) : (
                                <div className="divide-y divide-slate-700/50">
                                    {(showAllGames ? userGames : userGames.slice(0, 5)).map((game) => (
                                        <div key={game.id} className="p-4 hover:bg-slate-800/50 transition-colors flex items-center justify-between group cursor-pointer" onClick={() => setExpandedGameId(expandedGameId === game.id ? null : game.id)}>
                                            <div className="flex items-center space-x-4">
                                                <div className={`w-1 h-12 rounded-full ${game.userWon ? 'bg-neon-green' : 'bg-brand-pink'}`}></div>
                                                <div>
                                                    <div className="font-bold text-white">{game.opponentName}</div>
                                                    <div className="text-xs text-slate-500">{game.date ? new Date(game.date).toLocaleDateString() : '-'}</div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className={`font-heading text-xl ${game.userWon ? 'text-neon-green' : 'text-brand-pink'}`}>{game.userWon ? 'VICTORY' : 'DEFEAT'}</div>
                                                <div className="text-xs text-slate-500">{game.moveCount} Moves</div>
                                            </div>
                                        </div>
                                    ))}
                                    {userGames.length > 5 && (
                                        <button onClick={() => setShowAllGames(!showAllGames)} className="w-full py-3 text-sm text-brand-blue hover:text-white bg-slate-800/30 hover:bg-slate-800 transition-colors">
                                            {showAllGames ? 'SHOW LESS' : 'VIEW ALL HISTORY'}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
        </div>

      </div>
    </div>
  );
};

export default Profile;
