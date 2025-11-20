
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { auth, ensureAnonymousUser } from '../firebaseConfig';
import { doc, setDoc, serverTimestamp, getDoc, collection, query, where, getDocs, updateDoc, onSnapshot, limit, orderBy, deleteDoc, getCountFromServer, runTransaction } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Line } from 'react-chartjs-2';
import { getAssetPath } from '../config/basePath';
import ProfileTab from '../components/ProfileTab';
import Footer from '../components/Footer';
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

// Icon Components for Navigation
const PlayIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const StatsIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const LeaderboardIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6m12 0h1.5a2.5 2.5 0 0 1 0 5H18m-2 13H8m2-7.34V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22m7-7.34V17c0 .55.47.98.97 1.21.83.54 1.68 2.03 1.68 3.79M18 2H6v7a6 6 0 0 0 12 0V2Z" />
  </svg>
);

const ProfileIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const Home = () => {
  const navigate = useNavigate();
  const { startNewGame, getTeam, getPlayer } = useGame();
  
  // State
  const [activeView, setActiveView] = useState('play'); // 'play', 'stats', 'leaderboard'
  const [rulesTab, setRulesTab] = useState('game'); 
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [statsLoaded, setStatsLoaded] = useState(false);
  
  // Data States
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [isLeaderboardLoading, setIsLeaderboardLoading] = useState(true);
  const [topUsageData, setTopUsageData] = useState({
    players: [], teams: [], numbers: [], colleges: []
  });
  const [isUsageLoading, setIsUsageLoading] = useState(true);
  const [usageDataSource, setUsageDataSource] = useState("all");
  const [userRank, setUserRank] = useState(null);
  const [userGames, setUserGames] = useState([]);
  const [isGamesLoading, setIsGamesLoading] = useState(false);
  const [expandedGameId, setExpandedGameId] = useState(null);
  const [showAllGames, setShowAllGames] = useState(false);
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
      } catch (error) {
        console.error("Error initializing user:", error);
      }
    };
    
    initUser();
    fetchWaitingPlayersCount();
    startWaitingPlayersCounter();
    fetchDailyChallenge();
    
    return () => {
      if (waitingPlayersTimerRef.current) clearInterval(waitingPlayersTimerRef.current);
      if (presenceTimerRef.current) clearInterval(presenceTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if ((activeView === 'stats' || activeView === 'leaderboard') && !statsLoaded) {
      setStatsLoaded(true);
      fetchLeaderboard();
      fetchMostUsedAnswers("all");
    }
  }, [activeView, statsLoaded]);

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

  // Stats Fetching
  const fetchLeaderboard = async () => {
    try {
      setIsLeaderboardLoading(true);
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
          uid: userData.uid,
          displayName: userData.displayName || 'Anonymous Player',
          eloRating: eloRating,
          wins: wins,
          losses: losses
        });
      });
      
      leaderboard.sort((a, b) => b.eloRating - a.eloRating);
      setLeaderboardData(leaderboard);
      setIsLeaderboardLoading(false);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      setIsLeaderboardLoading(false);
    }
  };

  const fetchMostUsedAnswers = async (source = "all") => {
      try {
        setIsUsageLoading(true);
        setUsageDataSource(source);
        
        const counters = { players: {}, teams: {}, numbers: {}, colleges: {} };
        const cutoffDate = new Date('2025-05-11T00:00:00');
        const gamesRef = collection(db, "games");
        
        let querySnapshot;
        
        if (source === "personal" && auth.currentUser) {
          const qA = query(gamesRef, where("createdAt", ">=", cutoffDate), where("status", "==", "finished"), where("players.A.id", "==", auth.currentUser.uid), orderBy("createdAt", "desc"));
          const qB = query(gamesRef, where("createdAt", ">=", cutoffDate), where("status", "==", "finished"), where("players.B.id", "==", auth.currentUser.uid), orderBy("createdAt", "desc"));
          const [snapshotA, snapshotB] = await Promise.all([getDocs(qA), getDocs(qB)]);
          
          const processSnapshot = (snapshot, role) => {
              snapshot.forEach(doc => {
                  const gameData = doc.data();
                  if (gameData.history && Array.isArray(gameData.history)) {
                      gameData.history.forEach(move => {
                          if (move.player === role) {
                              if (move.type === 'player') {
                                  if (!counters.players[move.value]) counters.players[move.value] = { count: 0, id: move.value };
                                  counters.players[move.value].count++;
                              } else if (move.type === 'team') {
                                  if (!counters.teams[move.value]) counters.teams[move.value] = { count: 0, id: move.value };
                                  counters.teams[move.value].count++;
                              } else if (move.type === 'number') {
                                  if (!counters.numbers[move.value]) counters.numbers[move.value] = { count: 0, value: move.value };
                                  counters.numbers[move.value].count++;
                              } else if (move.type === 'college') {
                                  if (!counters.colleges[move.value]) counters.colleges[move.value] = { count: 0, name: move.value };
                                  counters.colleges[move.value].count++;
                              }
                          }
                      });
                  }
              });
          };
          processSnapshot(snapshotA, 'A');
          processSnapshot(snapshotB, 'B');

        } else {
          const q = query(gamesRef, where("status", "==", "finished"), where("createdAt", ">=", cutoffDate), orderBy("createdAt", "desc"));
          querySnapshot = await getDocs(q);
          querySnapshot.forEach((doc) => {
            const gameData = doc.data();
            if (gameData.history && Array.isArray(gameData.history)) {
              gameData.history.forEach(move => {
                 if (move.type === 'player') {
                    if (!counters.players[move.value]) counters.players[move.value] = { count: 0, id: move.value };
                    counters.players[move.value].count++;
                 } else if (move.type === 'team') {
                    if (!counters.teams[move.value]) counters.teams[move.value] = { count: 0, id: move.value };
                    counters.teams[move.value].count++;
                 } else if (move.type === 'number') {
                    if (!counters.numbers[move.value]) counters.numbers[move.value] = { count: 0, value: move.value };
                    counters.numbers[move.value].count++;
                 } else if (move.type === 'college') {
                    if (!counters.colleges[move.value]) counters.colleges[move.value] = { count: 0, name: move.value };
                    counters.colleges[move.value].count++;
                 }
              });
            }
          });
        }
        
        // Helper to process and sort
        const processTop = (obj, limit = 3, type) => {
            return Object.values(obj).sort((a, b) => b.count - a.count).slice(0, limit).map((item, i) => {
                let extra = {};
                if (type === 'player') {
                    const p = getPlayer ? getPlayer(item.id) : null;
                    extra = { name: p ? p.name : item.id, league: p ? p.league : '', years: p ? `${p.start_year}-${p.end_year}` : '' };
                } else if (type === 'team') {
                    const t = getTeam ? getTeam(item.id) : null;
                    extra = { name: t ? t.name : item.id };
                }
                return { ...item, ...extra, rank: i + 1 };
            });
        };

        setTopUsageData({
          players: processTop(counters.players, 3, 'player'),
          teams: processTop(counters.teams, 3, 'team'),
          numbers: processTop(counters.numbers, 3),
          colleges: processTop(counters.colleges, 3)
        });
        
        setIsUsageLoading(false);
      } catch (error) {
        console.error("Error fetching usage:", error);
        setIsUsageLoading(false);
      }
  };

  const calculateUserRankFromAllUsers = async () => {
      if (!userProfile?.uid) return;
      try {
        const userElo = getLatestElo(userProfile.stats?.eloRating);
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("stats.eloRating", ">", userElo), where("stats.wins", ">", 0));
        const snapshot = await getCountFromServer(q);
        setUserRank(snapshot.data().count + 1);
      } catch (error) { console.error("Error calculating rank:", error); }
  };

  useEffect(() => {
      if (leaderboardData.length > 0 && userProfile?.uid) {
          const idx = leaderboardData.findIndex(p => p.uid === userProfile.uid);
          if (idx !== -1) setUserRank(idx + 1);
          else calculateUserRankFromAllUsers();
      }
  }, [leaderboardData, userProfile]);

  const fetchUserGames = async (userId) => {
    try {
      setIsGamesLoading(true);
      const gamesRef = collection(db, "games");
      // Simplified fetch for brevity - fetching A and B roles
      const qA = query(gamesRef, where("players.A.id", "==", userId), where("status", "==", "finished"), orderBy("updatedAt", "desc"), limit(20));
      const qB = query(gamesRef, where("players.B.id", "==", userId), where("status", "==", "finished"), orderBy("updatedAt", "desc"), limit(20));
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

  useEffect(() => {
      if (userProfile?.uid && activeView === 'stats') {
          fetchUserGames(userProfile.uid);
      }
  }, [userProfile, activeView]);

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

  // Daily Challenge
  const fetchDailyChallenge = async () => {
    try {
      setIsDailyLoading(true);
          const options = { timeZone: 'America/New_York', year: 'numeric', month: 'long', day: 'numeric' };
      const today = new Date().toLocaleDateString('en-US', options);
          const snap = await getDoc(doc(db, "daily", today));
          
          if (snap.exists()) {
              const data = snap.data();
              // Resolve names logic...
              let startName = data.startId, endName = data.endId;
              if (data.startType === 'player') { const p = getPlayer(data.startId); startName = p ? p.name : data.startId; }
              else if (data.startType === 'team') { const t = getTeam(data.startId); startName = `the ${t ? t.name : data.startId}`; }
              else if (data.startType === 'number') startName = `#${data.startId}`;
              
              if (data.endType === 'player') { const p = getPlayer(data.endId); endName = p ? p.name : data.endId; }
              else if (data.endType === 'team') { const t = getTeam(data.endId); endName = `the ${t ? t.name : data.endId}`; }
              else if (data.endType === 'number') endName = `#${data.endId}`;
              
              setDailyChallenge({ ...data, startName, endName });
          }
      } catch (e) { console.error(e); } finally { setIsDailyLoading(false); }
  };
  
  // Utils
  const getLatestElo = (elo) => Array.isArray(elo) ? (elo.length > 0 ? elo[elo.length-1] : 1000) : (elo || 1000);
  const formatTimeDisplay = (s) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;
  
  // --- RENDER ---
  return (
    <div className="min-h-screen bg-dark-bg text-arcade-text font-sans pb-4">
      <div className="max-w-4xl mx-auto px-6 sm:px-8 pt-4 sm:pt-8">
        
      {/* Header */}
        <header className="mb-6 sm:mb-10">
           <div className="flex justify-between items-center">
              <h1 
                className="font-heading text-3xl sm:text-4xl md:text-5xl lg:text-6xl leading-none tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 whitespace-nowrap cursor-pointer"
                onClick={() => setActiveView('play')}
              >
                BALL KNOWER
              </h1>

              <div className="flex items-center justify-end space-x-1 sm:space-x-2 bg-slate-800/50 px-3 py-1.5 rounded-full border border-slate-700">
                  <div className={`w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full ${activeUsersCount > 0 ? 'bg-neon-green animate-pulse' : 'bg-slate-500'}`}></div>
                  <span className="text-[0.65rem] sm:text-xs font-medium text-slate-300 whitespace-nowrap">{activeUsersCount} ONLINE</span>
              </div>
           </div>
           
           <div className="text-slate-400 text-[10px] sm:text-sm tracking-widest uppercase font-bold flex items-center gap-1 sm:gap-2 mt-1 sm:mt-2 overflow-x-auto scrollbar-hide">
              <span className="whitespace-nowrap">THE ULTIMATE</span>
              <img src={getAssetPath('nba.png')} alt="NBA" className="h-3 sm:h-4 w-auto flex-shrink-0" />
              <span className="flex-shrink-0">+</span>
              <img src={getAssetPath('nfl.png')} alt="NFL" className="h-3 sm:h-4 w-auto flex-shrink-0" />
              <span className="whitespace-nowrap">TRIVIA CHALLENGE</span>
           </div>
        </header>
        
        {/* Navigation Tabs - Desktop (Hidden on Mobile) */}
        <nav className="hidden sm:flex w-full mb-8 border-b border-slate-800 pb-1">
           {['play', 'stats', 'leaderboard', 'profile'].map((tab) => (
                  <button
               key={tab}
               onClick={() => setActiveView(tab)}
               className={`flex-1 px-1 sm:px-6 py-2 sm:py-3 font-heading text-sm sm:text-2xl uppercase tracking-wider transition-all border-b-4 ${
                 activeView === tab 
                 ? 'border-brand-pink text-white' 
                 : 'border-transparent text-slate-500 hover:text-slate-300'
               }`}
             >
               {tab}
                </button>
           ))}
        </nav>

        {/* Navigation Tabs - Mobile (Fixed Bottom) */}
        <nav className="sm:hidden fixed bottom-0 left-0 w-full bg-slate-900/95 backdrop-blur border-t border-slate-800 pb-safe-area z-50 flex justify-around items-center px-2 py-3">
            {[
                { id: 'play', icon: PlayIcon, label: 'Play' },
                { id: 'stats', icon: StatsIcon, label: 'Stats' },
                { id: 'leaderboard', icon: LeaderboardIcon, label: 'Rank' },
                { id: 'profile', icon: ProfileIcon, label: 'Profile' }
            ].map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.id;
                return (
                    <button
                        key={item.id}
                        onClick={() => setActiveView(item.id)}
                        className={`flex flex-col items-center justify-center w-full space-y-1 ${isActive ? 'text-brand-pink' : 'text-slate-500 hover:text-slate-400'}`}
                    >
                        <Icon />
                        <span className="text-[10px] font-heading tracking-widest uppercase">{item.label}</span>
                    </button>
                );
            })}
        </nav>
        
        {/* Main Content */}
        <main className="animate-fade-in pb-7 sm:pb-0">
          
          {/* PLAY VIEW */}
          {activeView === 'play' && (
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
                           <span>Current Rating: <span className="text-white font-bold">{getLatestElo(userProfile?.stats?.eloRating)}</span></span>
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
      )}
      
          {/* LEADERBOARD VIEW */}
          {activeView === 'leaderboard' && (
            <div className="bg-card-bg rounded-xl shadow-lg border border-slate-700 overflow-hidden">
              <div className="p-4 sm:p-6 border-b border-slate-700">
                 <h2 className="font-heading text-2xl sm:text-3xl text-white">GLOBAL RANKINGS</h2>
          </div>
              {isLeaderboardLoading ? (
                 <div className="p-12 text-center"><div className="inline-block w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div></div>
        ) : (
          <div className="overflow-x-auto">
                   <table className="w-full text-left">
                     <thead className="bg-slate-900/50 text-slate-400 text-[8px] sm:text-xs uppercase tracking-wider">
                       <tr>
                         <th className="p-1 sm:p-4 font-medium">Rank</th>
                         <th className="p-1 sm:p-4 font-medium">Player</th>
                         <th className="p-1 sm:p-4 font-medium">Rating</th>
                         <th className="p-1 sm:p-4 font-medium">Record</th>
                </tr>
              </thead>
                     <tbody className="divide-y divide-slate-700/50 text-[10px] sm:text-sm">
                       {leaderboardData.slice(0, 50).map((player, i) => (
                         <tr key={player.uid} className={`hover:bg-slate-800/50 transition-colors ${userProfile && player.uid === userProfile.uid ? 'bg-brand-blue/10 border-l-2 border-brand-blue' : ''}`}>
                           <td className="p-1 sm:p-4 font-heading text-sm sm:text-xl text-slate-300">#{i + 1}</td>
                           <td className="p-1 sm:p-4 font-bold text-white max-w-[80px] truncate sm:max-w-none">{player.displayName}</td>
                           <td className="p-1 sm:p-4 font-mono text-brand-blue">{player.eloRating}</td>
                           <td className="p-1 sm:p-4 text-slate-400">{player.wins} - {player.losses}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
          )}
          
          {/* STATS VIEW */}
          {activeView === 'stats' && (
          <div className="space-y-6">
                {/* Overview Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                   <div className="bg-card-bg p-5 rounded-xl border border-slate-700">
                      <div className="text-slate-500 text-xs uppercase tracking-wider mb-1">Rating</div>
                      <div className="font-heading text-4xl text-brand-blue">{getLatestElo(userProfile?.stats?.eloRating)}</div>
                    </div>
                   <div className="bg-card-bg p-5 rounded-xl border border-slate-700">
                      <div className="text-slate-500 text-xs uppercase tracking-wider mb-1">Global Rank</div>
                      <div className="font-heading text-4xl text-white">#{userRank || '-'}</div>
                        </div>
                   <div className="bg-card-bg p-5 rounded-xl border border-slate-700">
                      <div className="text-slate-500 text-xs uppercase tracking-wider mb-1">Games Played</div>
                      <div className="font-heading text-4xl text-white">{(userProfile?.stats?.wins || 0) + (userProfile?.stats?.losses || 0)}</div>
                      </div>
                   <div className="bg-card-bg p-5 rounded-xl border border-slate-700">
                      <div className="text-slate-500 text-xs uppercase tracking-wider mb-1">Win Rate</div>
                      <div className="font-heading text-4xl text-neon-green">
                        {(() => {
                           const w = userProfile?.stats?.wins || 0;
                           const l = userProfile?.stats?.losses || 0;
                           return (w + l) > 0 ? Math.round((w / (w + l)) * 100) + '%' : '-';
                        })()}
                    </div>
              </div>
            </div>
            
                {/* Chart */}
                <div className="bg-card-bg p-6 rounded-xl border border-slate-700">
                   <h3 className="font-heading text-2xl text-white mb-4">RATING HISTORY</h3>
                   <div className="h-64 w-full">
                      {userProfile?.stats?.eloRating ? (
                         <Line 
                           data={{
                              labels: (Array.isArray(userProfile.stats.eloRating) ? userProfile.stats.eloRating : [userProfile.stats.eloRating]).map((_, i) => `Game ${i+1}`),
                              datasets: [{
                                 label: 'Rating',
                                 data: Array.isArray(userProfile.stats.eloRating) ? userProfile.stats.eloRating : [userProfile.stats.eloRating],
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
                                  {/* Expanded view logic would go here if needed, for now simplified list */}
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
      )}

      {/* PROFILE VIEW */}
      {activeView === 'profile' && (
        <ProfileTab onProfileUpdate={(updatedProfile) => setUserProfile(prev => ({ ...prev, ...updatedProfile }))} />
      )}
          
        </main>
      
      <Footer withTabBar={true} />
      </div>
    </div>
  );
};

export default Home; 
