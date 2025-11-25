
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { auth, ensureAnonymousUser } from '../firebaseConfig';
import { doc, setDoc, serverTimestamp, getDoc, collection, query, where, getDocs, updateDoc, onSnapshot, orderBy, deleteDoc, getCountFromServer, runTransaction } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import Footer from '../components/Footer';
import Header from '../components/Header';
import RulesModal from '../components/RulesModal';

const Home = () => {
  const navigate = useNavigate();
  const { getTeam, getPlayer, loading: dataLoading } = useGame();
  
  // State
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [showRules, setShowRules] = useState(false);
  
  // Data States
  const [dailyChallenge, setDailyChallenge] = useState(null);
  const [isDailyLoading, setIsDailyLoading] = useState(true);
  
  // Matchmaking States
  const [isMatchmaking, setIsMatchmaking] = useState(false);
  const [matchmakingTime, setMatchmakingTime] = useState(0);
  const matchmakingTimerRef = useRef(null);
  const matchmakingListenerRef = useRef(null);
  const [waitingPlayersCount, setWaitingPlayersCount] = useState(0);
  const [activeUsersCount, setActiveUsersCount] = useState(0);
  const waitingPlayersTimerRef = useRef(null);
  const presenceTimerRef = useRef(null);
  const [matchmakingTimedOut, setMatchmakingTimedOut] = useState(false);
  
  // --- Initialization ---
  useEffect(() => {
    const initUser = async () => {
      try {
        const user = await ensureAnonymousUser();
        if (user) {
          const userRef = doc(db, "users", user.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            setUserProfile(userSnap.data());
          }
        }

        // Check if first visit
        const hasSeenRules = localStorage.getItem('hasSeenRules');
        if (!hasSeenRules) {
          setShowRules(true);
          localStorage.setItem('hasSeenRules', 'true');
        }
      } catch (error) {
        console.error("Error initializing user:", error);
      }
    };
    
    initUser();
    fetchWaitingPlayersCount();
    startWaitingPlayersCounter();
    
    return () => {
      if (waitingPlayersTimerRef.current) clearInterval(waitingPlayersTimerRef.current);
      if (presenceTimerRef.current) clearInterval(presenceTimerRef.current);
    };
  }, []);

  // Fetch daily challenge once data is loaded
  useEffect(() => {
    if (dataLoading) return;

    const fetchDailyChallenge = async () => {
      try {
        setIsDailyLoading(true);
        const options = { timeZone: 'America/New_York', year: 'numeric', month: 'long', day: 'numeric' };
        const today = new Date().toLocaleDateString('en-US', options);
        const snap = await getDoc(doc(db, "daily", today));
        
        if (snap.exists()) {
            const data = snap.data();
            let startName = data.startId, endName = data.endId;
            if (data.startType === 'player') { const p = getPlayer(data.startId); startName = p ? p.name : data.startId; }
            else if (data.startType === 'team') { const t = getTeam(data.startId); startName = `${t ? t.name : data.startId}`; }
            else if (data.startType === 'number') startName = `#${data.startId}`;
            
            if (data.endType === 'player') { const p = getPlayer(data.endId); endName = p ? p.name : data.endId; }
            else if (data.endType === 'team') { const t = getTeam(data.endId); endName = `${t ? t.name : data.endId}`; }
            else if (data.endType === 'number') endName = `#${data.endId}`;
            
            setDailyChallenge({ ...data, startName, endName });
        }
      } catch (e) { console.error(e); } finally { setIsDailyLoading(false); }
    };

    fetchDailyChallenge();
  }, [dataLoading, getPlayer, getTeam]);

  useEffect(() => {
    if (userProfile?.uid) {
      startPresenceTracking();
    }
  }, [userProfile?.uid]);

  // --- Logic Helpers ---

  // Presence
  const updateUserPresence = async () => {
    try {
      if (!userProfile?.uid) return;
      const userRef = doc(db, "users", userProfile.uid);
      await updateDoc(userRef, { lastActive: serverTimestamp() });
    } catch (err) { console.error("Error updating presence:", err); }
  };
  
  const fetchActiveUsersCount = async () => {
    try {
      const usersRef = collection(db, "users");
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
      const q = query(usersRef, where("lastActive", ">=", twoMinutesAgo));
      const snapshot = await getCountFromServer(q);
      setActiveUsersCount(snapshot.data().count);
    } catch (err) { console.error("Error fetching active users:", err); }
  };
  
  const startPresenceTracking = () => {
    if (presenceTimerRef.current) clearInterval(presenceTimerRef.current);
    updateUserPresence();
    fetchActiveUsersCount();
    presenceTimerRef.current = setInterval(() => {
      updateUserPresence();
      fetchActiveUsersCount();
    }, 30000);
  };

  const fetchWaitingPlayersCount = async () => {
    try {
      const lobbyRef = collection(db, "lobby");
      const q = query(lobbyRef, where("status", "==", "waiting"));
      const snapshot = await getCountFromServer(q);
      setWaitingPlayersCount(snapshot.data().count);
    } catch (err) { console.error("Error fetching waiting players:", err); }
  };

  const startWaitingPlayersCounter = () => {
    if (waitingPlayersTimerRef.current) clearInterval(waitingPlayersTimerRef.current);
    fetchWaitingPlayersCount();
    waitingPlayersTimerRef.current = setInterval(fetchWaitingPlayersCount, 5000);
  };

  // Matchmaking Logic (Simplified for this rewrite)
  const startMatchmaking = async () => {
    try {
      setMatchmakingTime(0);
      setIsMatchmaking(true);
          setMatchmakingTimedOut(false);
      setError('');
      
      const user = await ensureAnonymousUser();
          if (!user) throw new Error("Auth failed");
      
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.data();
      const userElo = getLatestElo(userData.stats?.eloRating);
      
          const requestRef = doc(db, "lobby", user.uid);
      await setDoc(requestRef, {
              uid: user.uid, displayName: userData.displayName, elo: userElo, status: "waiting", createdAt: serverTimestamp()
          });
          
      listenForMatches(requestRef, userElo);
      
      matchmakingTimerRef.current = setInterval(() => {
              setMatchmakingTime(t => {
                  if (t >= 60) {
            clearInterval(matchmakingTimerRef.current);
            cancelMatchmakingRequest();
            setMatchmakingTimedOut(true);
            setIsMatchmaking(false);
                      return t;
          }
                  return t + 1;
        });
      }, 1000);
      startWaitingPlayersCounter();
      } catch (e) {
          console.error(e);
          setError(e.message);
      setIsMatchmaking(false);
    }
  };
  
  const listenForMatches = (requestRef, userElo) => {
      matchmakingListenerRef.current = onSnapshot(requestRef, (snap) => {
          if (!snap.exists()) { cancelMatchmaking(); return; }
          const data = snap.data();
          if (data.status === "matched" && data.gameId) {
              cleanupMatchmaking();
              navigate(`/game/${data.gameId}`);
      } else {
        findMatch(userElo);
      }
    });
  };
  
  const findMatch = async (userElo) => {
      // Logic from original: search for waiting players, pick closest ELO
    try {
      const user = auth.currentUser;
      if (!user) return;
      const lobbyRef = collection(db, "lobby");
          const oneMinuteAgo = new Date(Date.now() - 60000);
          const q = query(lobbyRef, where("uid", "!=", user.uid), where("status", "==", "waiting"), where("createdAt", ">=", oneMinuteAgo), orderBy("createdAt"));
          const snaps = await getDocs(q);
          
          let bestMatch = null;
          let minDiff = Infinity;
          snaps.forEach(d => {
              const m = d.data();
              const diff = Math.abs(m.elo - userElo);
              if (diff < minDiff) { minDiff = diff; bestMatch = { id: d.id, ...m }; }
          });
          
          if (bestMatch) {
              await matchWith(bestMatch.uid);
          }
      } catch (e) { console.error("Find match error:", e); }
  };
  
  const matchWith = async (opponentUid) => {
      // Transaction logic
    try {
      const user = auth.currentUser;
          const gameId = `game_${Math.random().toString(36).substring(2, 9)}`;
          await runTransaction(db, async (tx) => {
      const meRef = doc(db, "lobby", user.uid);
      const themRef = doc(db, "lobby", opponentUid);
              const meSnap = await tx.get(meRef);
              const themSnap = await tx.get(themRef);
              const userSnap = await tx.get(doc(db, "users", user.uid));
              
              if (!meSnap.exists() || !themSnap.exists()) throw new Error("Lobby missing");
              if (meSnap.data().status !== 'waiting' || themSnap.data().status !== 'waiting') throw new Error("Not waiting");
        
        const userData = userSnap.data();
              const oppData = themSnap.data();
        
              const gameData = {
                  gameId,
          players: {
                      A: { id: user.uid, name: userData.displayName, online: true, isTemporary: false, elo: getLatestElo(userData.stats?.eloRating) },
                      B: { id: opponentUid, name: oppData.displayName, online: true, isTemporary: false, elo: getLatestElo(oppData.elo) }
                  },
                  turn: "A", nextInputType: "player", lastPlayerId: null, lastAttribute: { type: null, value: null },
                  usedPlayerIds: [], status: "playing", lastSubmittedAttributeMove: { type: null, value: null },
                  challengeStatus: 'none', challengeType: 'none', challengedPlayer: null, challengeAttributeOptions: [],
                  history: [], createdAt: serverTimestamp(), updatedAt: serverTimestamp(), winner: null, matchmade: true
              };
              
              tx.set(doc(db, "games", gameId), gameData);
              tx.update(meRef, { status: "matched", matchedWith: opponentUid, gameId });
              tx.update(themRef, { status: "matched", matchedWith: user.uid, gameId });
          });
          return gameId;
      } catch (e) { console.warn("Match transaction failed:", e.message); return null; }
  };
  
  const cancelMatchmakingRequest = async () => {
    try {
      const user = auth.currentUser;
          if (user) await deleteDoc(doc(db, "lobby", user.uid));
      } catch (e) { console.error(e); }
  };
  
  const cleanupMatchmaking = () => {
      if (matchmakingTimerRef.current) clearInterval(matchmakingTimerRef.current);
      if (matchmakingListenerRef.current) matchmakingListenerRef.current();
      setIsMatchmaking(false);
  };
  
  const cancelMatchmaking = async () => {
      cleanupMatchmaking();
      setMatchmakingTime(0);
      setMatchmakingTimedOut(false);
      await cancelMatchmakingRequest();
  };
  
  const handleStartOnlineGame = async () => {
      // Create friendly game
      setIsLoading(true);
      try {
          const user = await ensureAnonymousUser();
          const userSnap = await getDoc(doc(db, "users", user.uid));
          const userData = userSnap.data();
          const newGameId = `game_${Math.random().toString(36).substring(2, 9)}`;
          
          const initialData = {
              gameId: newGameId,
              players: {
                  A: { id: user.uid, name: userData.displayName, online: true, isTemporary: false },
                  B: null
              },
              turn: "A", nextInputType: "player", lastPlayerId: null, lastAttribute: { type: null, value: null },
              usedPlayerIds: [], status: "waiting", lastSubmittedAttributeMove: { type: null, value: null },
              challengeStatus: 'none', challengeType: 'none', challengedPlayer: null, challengeAttributeOptions: [],
              history: [], createdAt: serverTimestamp(), updatedAt: serverTimestamp(), winner: null, disconnectTimeout: null
          };
          
          await setDoc(doc(db, "games", newGameId), initialData);
          sessionStorage.setItem('pendingGamePlayerName', userData.displayName);
          navigate(`/game/${newGameId}`);
      } catch (e) { console.error(e); setError(e.message); setIsLoading(false); }
  };

  
  // Utils
  const getLatestElo = (elo) => Array.isArray(elo) ? (elo.length > 0 ? elo[elo.length-1] : 1000) : (elo || 1000);
  const formatTimeDisplay = (s) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;
  
  // --- RENDER ---
  return (
    <div className="min-h-screen bg-dark-bg text-arcade-text font-sans pb-4">
      <div className="max-w-4xl mx-auto px-6 sm:px-8 pt-4 sm:pt-8">
        
      <Header activeTab="play" activeUsersCount={activeUsersCount} />
        
        {/* Main Content */}
        <main className="animate-fade-in pb-7 sm:pb-0">
          
          {/* PLAY VIEW */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Competitive Card */}
              <div className="bg-card-bg rounded-xl p-1 shadow-lg border border-slate-700 relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-blue to-transparent"></div>
                <div className="p-6 h-full flex flex-col relative z-10">
                  <div className="flex justify-between items-start mb-6">
                     <div>
                       <h2 className="font-heading text-2xl sm:text-4xl text-white mb-1">COMPETITIVE</h2>
                       <p className="text-slate-400 text-xs sm:text-sm">Matchmake against players worldwide.</p>
            </div>
            <div className="bg-slate-800 p-2 rounded-lg">
                 <svg className="w-6 h-6 text-brand-blue animate-pulse-slow" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                 </svg>
            </div>
                  </div>
                  
                  {error && <div className="bg-red-900/30 border border-red-500/50 text-red-200 p-3 rounded mb-4 text-sm">{error}</div>}
                  
                  <div className="mt-auto space-y-4">
                    {isMatchmaking ? (
                       <div className="bg-slate-900/50 rounded-lg p-6 text-center border border-slate-700">
                          <div className="inline-block w-8 h-8 border-4 border-brand-blue border-t-transparent rounded-full animate-spin mb-3"></div>
                          <h3 className="font-heading text-2xl mb-1">SEARCHING...</h3>
                          <p className="font-mono text-xl text-brand-blue mb-4">{formatTimeDisplay(matchmakingTime)}</p>
                          <button onClick={cancelMatchmaking} className="text-sm text-slate-400 hover:text-white underline decoration-slate-600 underline-offset-4">Cancel Search</button>
        </div>
                    ) : matchmakingTimedOut ? (
                       <div className="bg-slate-900/50 rounded-lg p-6 text-center border border-brand-pink/30">
                          <p className="text-brand-pink mb-4 font-bold">No opponent found.</p>
                          <div className="flex gap-3 justify-center">
                             <button onClick={startMatchmaking} className="bg-brand-blue hover:bg-blue-600 text-white px-4 py-2 rounded font-heading text-lg">TRY AGAIN</button>
                             <button onClick={() => setMatchmakingTimedOut(false)} className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded font-heading text-lg">BACK</button>
      </div>
      </div>
                    ) : (
                       <>
          <button
                          onClick={startMatchmaking}
                          disabled={isLoading}
                          className="w-full group relative bg-brand-blue hover:bg-blue-500 text-white font-heading text-xl sm:text-3xl py-3 sm:py-4 rounded-lg shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] transition-all transform hover:-translate-y-1"
                        >
                          <span className="relative z-10">FIND MATCH</span>
          </button>
                        
                        <div className="flex items-center justify-between text-xs text-slate-500 pt-2">
                           <span>Rating: <span className="text-white font-bold">{getLatestElo(userProfile?.stats?.eloRating)}</span></span>
                           <button onClick={handleStartOnlineGame} className="hover:text-brand-blue transition-colors">Play with a Friend &rarr;</button>
      </div>
        </>
      )}
            </div>
            </div>
          </div>
          
              {/* Daily Challenge Card */}
              <div className="bg-card-bg rounded-xl p-1 shadow-lg border border-slate-700 relative overflow-hidden">
                 <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-pink to-transparent"></div>
                 <div className="p-6 h-full flex flex-col">
                    <div className="flex justify-between items-start mb-6">
                          <div>
                         <h2 className="font-heading text-2xl sm:text-4xl text-white mb-1">DAILY CHALLENGE</h2>
                         <p className="text-slate-400 text-xs sm:text-sm">New puzzle every 24 hours.</p>
                            </div>
                       <div className="bg-slate-800 p-2 rounded-lg">
                         <svg className="w-6 h-6 text-brand-pink" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                      </div>
                      
                    {isDailyLoading ? (
                      <div className="flex-grow flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-brand-pink border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    ) : dailyChallenge ? (
                      <div className="mt-auto">
                        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700 mb-4 text-center">
                           <div className="text-xs text-slate-500 uppercase tracking-widest mb-2">Connect</div>
                           <div className="font-heading text-2xl text-white leading-none mb-1">{dailyChallenge.startName}</div>
                           <div className="text-brand-pink text-sm font-bold">TO</div>
                           <div className="font-heading text-2xl text-white leading-none mt-1">{dailyChallenge.endName}</div>
                                    </div>
                            <button 
                           onClick={() => navigate('/daily')}
                           className="w-full bg-brand-pink hover:bg-pink-500 text-white font-heading text-xl sm:text-3xl py-3 rounded-lg shadow-[0_0_20px_rgba(236,72,153,0.3)] hover:shadow-[0_0_30px_rgba(236,72,153,0.5)] transition-all"
                            >
                           PLAY DAILY
                            </button>
                        <div className="text-center mt-3">
                           <button onClick={() => navigate('/past-daily-challenges')} className="text-xs text-slate-500 hover:text-white">Play Past Challenges</button>
                          </div>
                        </div>
                    ) : (
                       <div className="text-center text-slate-500 mt-auto">Failed to load daily challenge.</div>
                      )}
                    </div>
          </div>
        </div>
          
        </main>
      
      <Footer withTabBar={true} />

      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
      </div>
    </div>
  );
};

export default Home; 
