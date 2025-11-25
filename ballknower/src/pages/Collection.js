import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { ensureAnonymousUser } from '../firebaseConfig';
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import RarityCard from '../components/RarityCard';

const Collection = () => {
  const navigate = useNavigate();
  const { userId } = useParams();
  const { getTeam, getPlayer, players, teamsList, collegesList, popularityData } = useGame();
  
  const [userProfile, setUserProfile] = useState(null);
  const [targetUserProfile, setTargetUserProfile] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [userGames, setUserGames] = useState([]);
  const [rarityCache, setRarityCache] = useState({});
  const [collectionSort, setCollectionSort] = useState('rarity_desc');
  const [collectionFilter, setCollectionFilter] = useState('all');
  const [isSelectingShowcase, setIsSelectingShowcase] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Determine if this is the current user's collection or another user's
  const isMyCollection = !userId || (currentUser && currentUser.uid === userId);

  // --- Initialization ---
  useEffect(() => {
    const init = async () => {
      try {
        const user = await ensureAnonymousUser();
        setCurrentUser(user);

        // Determine target user ID
        const targetUid = userId || user?.uid;

        if (!targetUid) {
          setIsLoading(false);
          return;
        }

        // Fetch target user profile
        const targetUserRef = doc(db, "users", targetUid);
        const targetUserSnap = await getDoc(targetUserRef);
        if (targetUserSnap.exists()) {
          setTargetUserProfile({ uid: targetUid, ...targetUserSnap.data() });
          fetchUserGames(targetUid);
        } else {
          console.error("Target user not found");
          setIsLoading(false);
        }

        // Fetch current user profile (for showcase functionality)
        if (user && user.uid === targetUid) {
          setUserProfile({ uid: user.uid, ...targetUserSnap.data() });
        } else if (user) {
          const userRef = doc(db, "users", user.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            setUserProfile(userSnap.data());
          }
        }
      } catch (error) {
        console.error("Error initializing:", error);
        setIsLoading(false);
      }
    };

    init();
  }, [userId]);

  const fetchUserGames = async (userId) => {
    try {
      const gamesRef = collection(db, "games");
      // Fetch more games for collection view - maybe limit 100 or logic for all if needed
      // For now sticking to a reasonable limit or just all finished games
      const qA = query(gamesRef, where("players.A.id", "==", userId), where("status", "==", "finished"), orderBy("updatedAt", "desc"), limit(100));
      const qB = query(gamesRef, where("players.B.id", "==", userId), where("status", "==", "finished"), orderBy("updatedAt", "desc"), limit(100));
      const [snapA, snapB] = await Promise.all([getDocs(qA), getDocs(qB)]);
      
      let allGames = [];
      const processGame = (doc, role) => {
          const g = doc.data();
          const endTime = g.updatedAt?.toDate ? g.updatedAt.toDate() : new Date(g.updatedAt);
          
          allGames.push({
              id: doc.id,
              history: g.history || [],
              userRole: role,
              timestamp: endTime.getTime()
          });
      };
      snapA.forEach(d => processGame(d, 'A'));
      snapB.forEach(d => processGame(d, 'B'));
      allGames.sort((a, b) => b.timestamp - a.timestamp);
      setUserGames(allGames);
      setIsLoading(false);
    } catch (e) { console.error(e); setIsLoading(false); }
  };

  const collectionData = React.useMemo(() => {
      if (!userGames.length) return [];
      const counts = {};
      
      userGames.forEach(game => {
          if (!game.history) return;
          game.history.forEach((move) => {
              if (move.player === game.userRole) {
                  if (['player', 'team', 'number', 'college'].includes(move.type)) {
                      const key = `${move.type}_${move.value}`;
                      if (!counts[key]) {
                          counts[key] = {
                              type: move.type,
                              value: move.value,
                              count: 0,
                              lastPlayed: game.timestamp
                          };
                      }
                      if (game.timestamp > counts[key].lastPlayed) {
                          counts[key].lastPlayed = game.timestamp;
                      }
                      counts[key].count++;
                  }
              }
          });
      });
      
      let items = Object.values(counts);

      if (collectionFilter !== 'all') {
          items = items.filter(item => item.type === collectionFilter);
      }

      items.sort((a, b) => {
          if (collectionSort === 'recent') {
              return b.lastPlayed - a.lastPlayed;
          } else if (collectionSort === 'amount') {
              return b.count - a.count;
          } else if (collectionSort === 'rarity_desc') {
              const scoreA = rarityCache[`${a.type}_${a.value}`] || 100;
              const scoreB = rarityCache[`${b.type}_${b.value}`] || 100;
              return scoreB - scoreA;
          } else if (collectionSort === 'rarity_asc') {
              const scoreA = rarityCache[`${a.type}_${a.value}`] || 100;
              const scoreB = rarityCache[`${b.type}_${b.value}`] || 100;
              return scoreA - scoreB;
          }
          return 0;
      });
      
      return items;
  }, [userGames, rarityCache, collectionSort, collectionFilter]);

  const totalAvailable = React.useMemo(() => {
      if (!players || !teamsList || !collegesList) return 0;
      
      if (collectionFilter === 'player') return players.length;
      if (collectionFilter === 'team') return teamsList.length;
      if (collectionFilter === 'college') return collegesList.length;
      if (collectionFilter === 'number') return 101;
      
      return players.length + teamsList.length + collegesList.length + 101; 
  }, [collectionFilter, players, teamsList, collegesList]);

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

  const handleToggleShowcase = async (item) => {
      if (!userProfile) return;
      
      const currentShowcase = userProfile.showcase || [];
      const isInShowcase = currentShowcase.some(i => i.type === item.type && i.value === item.value);
      
      let newShowcase;
      
      if (isInShowcase) {
          newShowcase = currentShowcase.filter(i => !(i.type === item.type && i.value === item.value));
      } else {
          if (currentShowcase.length >= 4) {
              alert("You can only showcase 4 cards at a time!");
              return;
          }
          newShowcase = [...currentShowcase, { type: item.type, value: item.value }];
      }
      
      // Optimistic update
      setUserProfile(prev => ({ ...prev, showcase: newShowcase }));
      
      try {
          const userRef = doc(db, "users", userProfile.uid);
          await updateDoc(userRef, { showcase: newShowcase });
      } catch (e) {
          console.error("Error updating showcase", e);
      }
  };

  return (
    <div className="min-h-screen bg-dark-bg text-arcade-text font-sans pb-4 flex flex-col">
        <div className="max-w-6xl mx-auto px-4 w-full flex-grow flex flex-col pt-4">
            <header className="mb-6 border-b border-slate-800 pb-4">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate(isMyCollection ? '/profile' : userId ? `/profile/${userId}` : '/profile')}
                            className="text-slate-400 hover:text-white transition-colors"
                        >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                        </button>
                        <h1 className="font-heading text-xl text-white">{isMyCollection ? 'My Collection' : `${targetUserProfile?.displayName || 'USER'}'s Collection`}</h1>
                    </div>
                    <div className="font-heading text-3xl text-white">
                        {collectionData.length} <span className="text-slate-500 text-xl">/ {totalAvailable.toLocaleString()}</span>
                    </div>
                </div>
            </header>

            <div className="flex items-center gap-4 mb-6 p-2">
                 {/* Filters */}
                <div className="relative">
                    <select
                        value={collectionFilter}
                        onChange={(e) => setCollectionFilter(e.target.value)}
                        className="appearance-none bg-slate-800 text-white text-xs font-heading uppercase tracking-wider pl-4 pr-8 py-2 rounded cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-blue"
                    >
                        <option value="all">All Cards</option>
                        <option value="player">Players</option>
                        <option value="team">Teams</option>
                        <option value="number">Numbers</option>
                        <option value="college">Colleges</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-white">
                        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                    </div>
                </div>
                
                {/* Sorts */}
                <div className="relative">
                     <select
                        value={collectionSort}
                        onChange={(e) => setCollectionSort(e.target.value)}
                        className="appearance-none bg-slate-800 text-white text-xs font-heading uppercase tracking-wider pl-4 pr-8 py-2 rounded cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-blue"
                     >
                         <option value="recent">Recent</option>
                         <option value="rarity_desc">Rarity &darr;</option>
                         <option value="rarity_asc">Rarity &uarr;</option>
                         <option value="amount">Count</option>
                     </select>
                     <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-white">
                        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                     </div>
                </div>

                {/* Favorites Button - Only show for own collection */}
                {isMyCollection && (
                    <button
                        onClick={() => setIsSelectingShowcase(!isSelectingShowcase)}
                        className={`ml-auto px-4 py-2 rounded-md text-xs font-heading uppercase tracking-wider transition-colors border ${isSelectingShowcase ? 'bg-yellow-500/20 border-yellow-500 text-yellow-500' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}
                    >
                        {isSelectingShowcase ? 'Done' : 'Favorites'}
                    </button>
                )}
            </div>
            
            <div className="flex-grow relative min-h-[50vh]">
                {isLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-12 h-12 border-4 border-brand-blue border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : collectionData.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-0 gap-y-0 justify-items-center pb-10">
                        {collectionData.map((item, i) => (
                            <div key={i} className="transform scale-90 hover:scale-105 transition-transform">
                                <RarityCard
                                    type={item.type}
                                    value={item.value}
                                    count={item.count}
                                    rarityScore={rarityCache[`${item.type}_${item.value}`]}
                                    playerData={item.type === 'player' ? getPlayer(item.value) : null}
                                    getTeam={getTeam}
                                    clickable={true}
                                    isShowcased={isMyCollection ? userProfile?.showcase?.some(s => s.type === item.type && s.value === item.value) : false}
                                    onToggleShowcase={isMyCollection && isSelectingShowcase ? () => handleToggleShowcase(item) : undefined}
                                    isSelectionMode={isMyCollection && isSelectingShowcase}
                                    allPlayersData={players}
                                    popularityData={popularityData}
                                />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500">
                        <p className="font-heading text-xl mb-2">NO CARDS FOUND</p>
                        <p className="text-sm">Try adjusting filters or play more games!</p>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default Collection;

