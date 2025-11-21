import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db, auth, ensureAnonymousUser } from '../firebaseConfig';
import { useGame } from '../context/GameContext';
import { getAssetPath } from '../config/basePath';
import {
    calculateSubmitAnswerUpdate,
    calculateInitiateChallengeUpdate,
    calculateResolveChallengeUpdate,
    calculateGiveUpUpdate,
    validateMoveForReversal,
    calculateReverseUpdateWithInput,
    trackSubmission,
    updatePlayerStats
} from '../utils/gameUtils';
import AutocompleteInput from './AutocompleteInput';
import { ArcadeButton, ArcadeCard } from './ArcadeUI';
import RulesModal from './RulesModal';

// --- Helpers ---
const getAttributeLabel = (attribute) => {
    switch (attribute) {
      case 'player': return 'Player';
      case 'number': return 'Number'; 
      case 'team': return 'Team';
      case 'college': return 'College';
      default: return attribute || 'N/A';
    }
};
  
const formatTeamName = (teamId, getTeam) => { 
    const team = getTeam(teamId);
    return team ? team.name : teamId || 'Unknown Team';
};

// --- Sub-Components ---

const WaitingScreen = ({ gameId }) => {
    const [copied, setCopied] = useState(false);
    const copyURL = () => {
        navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    
    return (
        <div className="min-h-screen bg-dark-bg flex flex-col justify-center items-center p-4 text-center relative overflow-hidden">
            {/* Background Pulse */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-96 h-96 bg-brand-blue rounded-full blur-[100px] opacity-10 animate-pulse-slow"></div>
            </div>

            <ArcadeCard className="max-w-md w-full relative z-10" glow="blue">
                <div className="mb-8 relative flex justify-center">
                    <div className="w-24 h-24 border-4 border-brand-blue border-t-transparent rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <img src={getAssetPath('ballknower.png')} className="w-10 h-10 opacity-50" alt="" />
                    </div>
                </div>
                <h2 className="text-5xl font-heading text-white mb-2 text-glow-blue">WAITING FOR OPPONENT</h2>
                <p className="text-slate-400 mb-8">Share this link to start the game.</p>
                
                <div className="bg-slate-900/80 rounded-xl border border-slate-700 p-2 mb-6 flex items-center gap-2">
                    <input readOnly value={window.location.href} className="bg-transparent text-slate-400 text-sm px-2 flex-grow outline-none font-mono" />
                    <ArcadeButton onClick={copyURL} size="sm" variant={copied ? 'success' : 'primary'}>
                        {copied ? 'COPIED!' : 'COPY'}
                    </ArcadeButton>
                </div>
                <p className="text-xs text-slate-600 font-mono">Game ID: {gameId}</p>
            </ArcadeCard>
        </div>
    );
};

const PlayerCard = ({ player, isTurn, isMe, timer }) => (
    <div className={`relative p-4 rounded-xl transition-all duration-500 border-2 overflow-hidden ${isTurn ? 'bg-slate-800/90 border-brand-blue shadow-neon-blue scale-105 z-10' : 'bg-slate-900/50 border-slate-800 opacity-60'}`}>
        <div className="flex items-center gap-4 relative z-10">
            <div className="flex-grow">
                <div className="flex items-center justify-between">
                    <h3 className="font-heading text-2xl text-white leading-none tracking-wide">{player?.name || 'Waiting...'}</h3>
                    {isMe && <span className="bg-slate-700 text-[10px] px-2 py-0.5 rounded text-slate-300 uppercase font-bold tracking-wider">You</span>}
                </div>
                <div className="flex justify-between items-end mt-1">
                    <p className="text-xs text-slate-400 font-mono uppercase">Rating: {player?.elo || 1000}</p>
                    {isTurn && <p className={`font-mono text-xl font-bold ${timer < 10 ? 'text-neon-red animate-pulse' : 'text-white'}`}>{timer}s</p>}
                </div>
            </div>
        </div>
        
        {/* Timer Progress Bar Background */}
        {isTurn && (
            <div className="absolute bottom-0 left-0 h-1 bg-slate-700 w-full">
                <div 
                    className={`h-full transition-all duration-1000 ease-linear ${timer < 10 ? 'bg-neon-red' : timer < 30 ? 'bg-yellow-500' : 'bg-neon-green'}`} 
                    style={{ width: `${(timer / 60) * 100}%` }}
                ></div>
            </div>
        )}
    </div>
);

const GameLog = ({ history, myRole, getPlayer, getTeam, className = "" }) => (
    <div className={`flex flex-col ${className}`}>
        <h3 className="font-heading text-sm text-slate-500 mb-2 px-2 uppercase tracking-widest text-center">Match History</h3>
        <div className="flex-grow overflow-y-auto custom-scrollbar space-y-2 pr-2 px-2 pb-2 flex flex-col-reverse min-h-0">
            {[...history].reverse().map((move, i) => {
                 const isMe = move.player === myRole;
                 return (
                    <div key={i} className={`p-2 rounded border text-xs relative ${isMe ? 'bg-blue-900/10 border-brand-blue/20 ml-8' : 'bg-slate-800/30 border-slate-700/50 mr-8'}`}>
                        <div className={`absolute top-2 ${isMe ? 'right-2' : 'left-2'} w-1.5 h-1.5 rounded-full ${isMe ? 'bg-brand-blue' : 'bg-slate-600'}`}></div>
                        <div className={`text-[10px] text-slate-500 mb-0.5 font-bold uppercase ${isMe ? 'text-right pr-3' : 'pl-3'}`}>
                             {isMe ? 'You' : 'Opponent'} • {getAttributeLabel(move.type)}
                        </div>
                        <div className={`text-slate-300 font-medium ${isMe ? 'text-right' : ''}`}>
                            {move.type === 'player' && getPlayer(move.value)?.name}
                            {move.type === 'team' && formatTeamName(move.value, getTeam)}
                            {move.type === 'number' && `#${move.value}`}
                            {move.type === 'college' && move.value}
                            {move.type.includes('game_end') && <span className="text-brand-pink font-bold uppercase">{move.value}</span>}
                            {move.type === 'reverse_success' && <span className="text-brand-blue italic">Reversed</span>}
                            {move.type === 'challenge_initiated' && <span className="text-yellow-500 font-bold">CHALLENGE</span>}
                        </div>
                    </div>
                 );
            })}
            {history.length === 0 && <div className="text-center text-slate-700 italic py-4 text-xs">Game started...</div>}
        </div>
    </div>
);

// --- Main Component ---

const OnlineGameBoard = () => {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { players: allPlayersData, teamsList, collegesList, getTeam, searchPlayersByName, searchTeams, getPlayer } = useGame(); 
  
  // Logic States
  const [gameData, setGameData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPlayerId, setCurrentPlayerId] = useState(null); 
  const [isSubmitting, setIsSubmitting] = useState(false); 
  const [userProfile, setUserProfile] = useState(null); 
  const [showRules, setShowRules] = useState(false); 
  const [timeLeft, setTimeLeft] = useState(60); 
  const timerRef = useRef(null); 

  // Input States
  const [inputValue, setInputValue] = useState('');
  const [finalSelectedValue, setFinalSelectedValue] = useState(''); 
  const [selectedAttributeType, setSelectedAttributeType] = useState('number'); 
  const [suggestions, setSuggestions] = useState([]);

  // Challenge States
  const [showConfirmGiveUp, setShowConfirmGiveUp] = useState(false);
  const [showConfirmChallenge, setShowConfirmChallenge] = useState(false);
  const [challengeResponseAttributeType, setChallengeResponseAttributeType] = useState(null); 
  const [challengeResponseInputValue, setChallengeResponseInputValue] = useState('');
  const [challengeResponseFinalValue, setChallengeResponseFinalValue] = useState('');
  const [challengeResponseSuggestions, setChallengeResponseSuggestions] = useState([]);
  
  const myRole = gameData?.players?.A?.id === currentPlayerId ? 'A' : (gameData?.players?.B?.id === currentPlayerId ? 'B' : null);
  const isMyTurn = gameData?.turn === myRole;

  // --- Initializers & Effects (Logic unchanged from previous plan) ---
  useEffect(() => {
    const initUser = async () => {
        const user = await ensureAnonymousUser();
        if (user) {
            setCurrentPlayerId(user.uid);
            const snap = await getDoc(doc(db, "users", user.uid));
            if (snap.exists()) {
                setUserProfile(snap.data());
                sessionStorage.setItem('pendingGamePlayerName', snap.data().displayName);
            }
        } else {
            let temp = sessionStorage.getItem('tempPlayerId');
            if (!temp) { temp = `temp_${Math.random()}`; sessionStorage.setItem('tempPlayerId', temp); }
            setCurrentPlayerId(temp);
        }
    };
    initUser();
    return () => auth.onAuthStateChanged(u => u && setCurrentPlayerId(u.uid));
  }, []);

  useEffect(() => {
    if (userProfile && gameData && gameData.status === 'waiting' && gameData.players.A?.id !== currentPlayerId) {
        sessionStorage.setItem('pendingGamePlayerName', userProfile.displayName || 'Player B');
    }
  }, [userProfile, gameData, currentPlayerId]);

  useEffect(() => {
    if (!currentPlayerId || !gameId) return;
    setLoading(true);
    const unsub = onSnapshot(doc(db, "games", gameId), (snap) => {
        if (snap.exists()) {
            const data = snap.data();
            setGameData(data);
            if (data.status === 'waiting' && data.players.B === null && data.players.A?.id !== currentPlayerId) {
                const name = sessionStorage.getItem('pendingGamePlayerName') || 'Player B';
                const deadline = new Date(); deadline.setMinutes(deadline.getMinutes() + 1);
                updateDoc(doc(db, "games", gameId), {
                    'players.B': { id: currentPlayerId, name, online: true, isTemporary: !auth.currentUser?.uid },
                    status: 'playing', turn: "A", turnDeadline: deadline, updatedAt: serverTimestamp()
                });
            }
            if (data.status === 'playing' && !data.turnDeadline) {
                const deadline = new Date(); deadline.setMinutes(deadline.getMinutes() + 1);
                updateDoc(doc(db, "games", gameId), { turnDeadline: deadline });
            }
        } else { setError('Game not found.'); }
        setLoading(false);
    });
    return () => unsub();
  }, [gameId, currentPlayerId]);

  useEffect(() => {
    if (!gameData || gameData.status !== 'playing') { clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(() => {
        if (gameData.turnDeadline) {
            const left = Math.max(0, Math.floor((gameData.turnDeadline.toDate().getTime() - Date.now()) / 1000));
            setTimeLeft(left);
            if (left <= 0) handleTimeOut();
        } else setTimeLeft(60);
    }, 500);
    return () => clearInterval(timerRef.current);
  }, [gameData, isMyTurn]);

  // Reset inputs on turn change
  useEffect(() => {
      if (gameData) {
          setInputValue(''); setFinalSelectedValue(''); setError(''); setIsSubmitting(false);
          // Only reset attribute type if switching back to attribute input
          if (gameData.nextInputType === 'attribute') setSelectedAttributeType('number'); 
          setSuggestions([]);
          setShowConfirmChallenge(false); setShowConfirmGiveUp(false);
      }
  }, [gameData?.turn, gameData?.challengeStatus]);

  // --- Handlers ---

  const handleTimeOut = async () => {
      if (!gameData || !myRole || gameData.status !== 'playing') return;
      if (isMyTurn) { // Only current turn player triggers the timeout write to avoid race conditions
        try {
            const gameRef = doc(db, "games", gameId);
            const winner = myRole === 'A' ? 'B' : 'A';
            await updateDoc(gameRef, {
                status: 'finished', winner, updatedAt: serverTimestamp(),
                history: [...gameData.history, { player: gameData.turn, type: 'game_end_timeout', value: 'Time ran out', timestamp: new Date().toISOString() }]
            });
            
            // Update Stats
            const winnerRole = winner;
            const loserRole = myRole; // I timed out
            const winnerId = gameData.players[winnerRole]?.id;
            const loserId = gameData.players[loserRole]?.id;
            if (winnerId && loserId) {
                updatePlayerStats(winnerId, loserId).catch(console.error);
            }
        } catch (e) { console.error(e); }
      }
  };

  const handleInputChange = (value) => {
      setInputValue(value);
      setFinalSelectedValue(''); // Clear selection if typing
      setError('');
      
      if (!value.trim()) { setSuggestions([]); return; }

      if (gameData.nextInputType === 'player') {
          const results = searchPlayersByName(value);
          setSuggestions(results.slice(0, 8));
      } else if (gameData.nextInputType === 'attribute') {
          if (selectedAttributeType === 'team') {
              const results = searchTeams(value);
              setSuggestions(results.slice(0, 8));
          } else if (selectedAttributeType === 'college') {
              const results = collegesList.filter(c => c.toLowerCase().includes(value.toLowerCase()));
              setSuggestions(results.slice(0, 8));
          } else {
              setSuggestions([]);
          }
      }
  };

  const handleAnswerSelect = (value, display) => {
      setInputValue(display);
      setFinalSelectedValue(value);
      setSuggestions([]);
  };

  const handleSubmitAnswer = async () => {
      if (isSubmitting || !inputValue) return;
      setIsSubmitting(true);
      
      let answer = finalSelectedValue || inputValue; // Use input value for numbers or raw text
      
      // Basic local checks before server call
      if (gameData.nextInputType === 'attribute' && selectedAttributeType === 'number') {
          if (!/^\d+$/.test(answer)) { setError("Please enter a valid number."); setIsSubmitting(false); return; }
      }
      
      const result = calculateSubmitAnswerUpdate(gameData, myRole, answer, selectedAttributeType, allPlayersData);
      
      if (result.success) {
          try {
              const gameRef = doc(db, "games", gameId);
              const deadline = new Date(); deadline.setMinutes(deadline.getMinutes() + 1);
              await updateDoc(gameRef, { ...result.update, turnDeadline: deadline });
              
              // Track submission stats
              if(gameData.nextInputType === 'player') trackSubmission(answer, 'player');
              
              // Update Stats if Game Over
              if (result.update.status === 'finished' && result.update.winner) {
                 const winnerRole = result.update.winner;
                 const loserRole = winnerRole === 'A' ? 'B' : 'A';
                 // Use updated data or current gameData? gameData should have players.
                 const winnerId = gameData.players[winnerRole]?.id;
                 const loserId = gameData.players[loserRole]?.id;
                 if (winnerId && loserId) {
                     updatePlayerStats(winnerId, loserId).catch(console.error);
                 }
              }
          } catch (e) { console.error(e); setError("Network error."); }
      } else {
          setError(result.error);
      }
      setIsSubmitting(false);
  };

  const confirmGiveUp = async () => {
      const result = calculateGiveUpUpdate(gameData, myRole);
      if(result.success) {
          await updateDoc(doc(db, "games", gameId), result.update);
          
          // Update Stats
          if (result.update.status === 'finished' && result.update.winner) {
             const winnerRole = result.update.winner;
             const loserRole = winnerRole === 'A' ? 'B' : 'A';
             const winnerId = gameData.players[winnerRole]?.id;
             const loserId = gameData.players[loserRole]?.id;
             if (winnerId && loserId) {
                 updatePlayerStats(winnerId, loserId).catch(console.error);
             }
          }
      }
      setShowConfirmGiveUp(false);
  };

  const confirmChallenge = async () => {
      const result = calculateInitiateChallengeUpdate(gameData, myRole, allPlayersData);
      if(result.success) {
          await updateDoc(doc(db, "games", gameId), result.update);
      } else { setError(result.error); }
      setShowConfirmChallenge(false);
  };
  
  // Challenge Response Handlers
  const handleChallengeResponseInputChange = (value) => {
      setChallengeResponseInputValue(value);
      setChallengeResponseFinalValue('');
      
      if(gameData.challengeType === 'player') {
         // Attribute search
         if (challengeResponseAttributeType === 'team') setChallengeResponseSuggestions(searchTeams(value).slice(0,5));
         else if (challengeResponseAttributeType === 'college') setChallengeResponseSuggestions(collegesList.filter(c => c.toLowerCase().includes(value.toLowerCase())).slice(0,5));
         else setChallengeResponseSuggestions([]);
      } else {
         // Player search
         setChallengeResponseSuggestions(searchPlayersByName(value).slice(0,5));
      }
  };

  const handleChallengeResponseSelect = (value, display) => {
      setChallengeResponseInputValue(display);
      setChallengeResponseFinalValue(value);
      setChallengeResponseSuggestions([]);
  };

  const handleChallengeResponse = async () => {
      let value = challengeResponseFinalValue || challengeResponseInputValue;
      const result = calculateResolveChallengeUpdate(gameData, myRole, value, challengeResponseAttributeType, allPlayersData);
      
      if(result.success) {
          await updateDoc(doc(db, "games", gameId), result.update);
          
          // Update Stats
          if (result.update.status === 'finished' && result.update.winner) {
             const winnerRole = result.update.winner;
             const loserRole = winnerRole === 'A' ? 'B' : 'A';
             const winnerId = gameData.players[winnerRole]?.id;
             const loserId = gameData.players[loserRole]?.id;
             if (winnerId && loserId) {
                 updatePlayerStats(winnerId, loserId).catch(console.error);
             }
          }
      } else { setError(result.error); }
  };
  
  const handleReverse = async () => {
      if (isSubmitting) return;
      
      // Use current input values
      // If nextInputType is 'player', we expect a player input.
      // If nextInputType is 'attribute', we expect an attribute input.
      
      let value = finalSelectedValue || inputValue;
      let attributeType = null;
      
      if (gameData.nextInputType === 'attribute') {
          attributeType = selectedAttributeType;
          // For attribute, value is just the string (or selected value if we had one, but usually typed)
      } 
      // If player, value is the ID (finalSelectedValue) or name (inputValue) - utils expects ID for player
      
      if (!value) {
          setError("Please enter an answer to reverse with.");
          return;
      }

      setIsSubmitting(true);
      
      const result = calculateReverseUpdateWithInput(gameData, myRole, value, attributeType, allPlayersData);
      
      if (result.success) {
          try {
              const gameRef = doc(db, "games", gameId);
              // Reset timer on reverse? The turn swaps, so usually yes. 
              // The update object should probably handle timestamp, but we need to reset the deadline here or in utils.
              // calculateReverseUpdateWithInput returns 'update' with history and turn change. 
              // We should add turnDeadline update here.
              const deadline = new Date(); deadline.setMinutes(deadline.getMinutes() + 1);
              
              await updateDoc(gameRef, { ...result.update, turnDeadline: deadline });
              setInputValue(''); setFinalSelectedValue(''); // Clear input
          } catch (e) { 
              console.error(e); 
              setError("Network error during reverse."); 
          }
      } else {
          setError(result.error);
      }
      setIsSubmitting(false);
  };


  // --- Render Logic ---
  if (loading) return <div className="min-h-screen bg-dark-bg flex items-center justify-center"><div className="w-16 h-16 border-4 border-brand-blue border-t-transparent rounded-full animate-spin"></div></div>;
  if (error && !gameData) return <div className="min-h-screen bg-dark-bg flex items-center justify-center text-white p-8 text-center"><div><h2 className="text-4xl font-heading mb-2 text-neon-red">ERROR</h2><p className="text-slate-400">{error}</p><ArcadeButton onClick={() => navigate('/')} className="mt-6">Home</ArcadeButton></div></div>;
  if (gameData && gameData.status === 'waiting') return <WaitingScreen gameId={gameId} />;
  if (gameData && (gameData.status === 'finished' || gameData.status === 'closed')) {
      // Simple Game Over Screen within the board
      const iWon = gameData.winner === myRole;
      
      // Calculate possible answers
      let possibleAnswers = [];
      let missedCondition = "";
      
      if (gameData.nextInputType === 'player' && gameData.lastAttribute?.type) {
          const attrType = gameData.lastAttribute.type;
          const attrValue = String(gameData.lastAttribute.value ?? '').toLowerCase();
          missedCondition = `Players who match ${getAttributeLabel(attrType)}: ${gameData.lastAttribute.display || gameData.lastAttribute.value}`;
          
          if (attrType === 'team') missedCondition = `Players who played for the ${formatTeamName(gameData.lastAttribute.value, getTeam)}`;
          else if (attrType === 'number') missedCondition = `Players who wore #${gameData.lastAttribute.value}`;
          else if (attrType === 'college') missedCondition = `Players who went to ${gameData.lastAttribute.value}`;

          allPlayersData.forEach(p => {
              const arr = p[attrType + 's'];
              if (arr && Array.isArray(arr) && arr.some(v => String(v).toLowerCase() === attrValue)) {
                  possibleAnswers.push(p.name);
              }
          });
      } else if (gameData.nextInputType === 'attribute' && gameData.lastPlayerId) {
          const p = getPlayer(gameData.lastPlayerId);
          if (p) {
              missedCondition = `Attributes for ${p.name}`;
              if (p.teams) p.teams.forEach(t => possibleAnswers.push(`${formatTeamName(t, getTeam)}`));
              if (p.numbers) p.numbers.forEach(n => possibleAnswers.push(`#${n}`));
              if (p.colleges) p.colleges.forEach(c => possibleAnswers.push(`${c}`));
          }
      }
      
      // Sort and limit
      possibleAnswers.sort();
      const displayAnswers = possibleAnswers.slice(0, 20);
      const remaining = possibleAnswers.length - 20;

      return (
          <div className="h-screen bg-dark-bg text-white font-sans overflow-hidden flex flex-col">
              {/* Header */}
              <header className="flex-none bg-card-bg/50 backdrop-blur border-b border-slate-800 p-2 md:p-4 flex justify-between items-center z-20">
                 <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
                    <span className="font-heading text-2xl tracking-wider hidden md:inline">BALL KNOWER</span>
                 </div>
              </header>

              <div className="flex-grow overflow-y-auto custom-scrollbar relative">
                  <div className="min-h-full flex flex-col p-6 items-center pb-20">
                      <ArcadeCard className="max-w-2xl w-full text-center mb-8" glow={iWon ? 'blue' : 'pink'}>
                          <h1 className={`font-heading text-6xl mb-2 ${iWon ? 'text-brand-blue text-glow-blue' : 'text-brand-pink text-glow-pink'}`}>
                              {iWon ? 'VICTORY' : 'DEFEAT'}
                          </h1>
                          <p className="text-slate-400 mb-8 text-xl">
                              {gameData.history[gameData.history.length-1]?.value || "Game Over"}
                          </p>
                          
                          <div className="grid grid-cols-2 gap-4 mb-8">
                              <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                                  <div className="text-xs text-slate-500 uppercase">Moves</div>
                                  <div className="font-heading text-3xl text-white">{gameData.history.length}</div>
                              </div>
                              <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                                  <div className="text-xs text-slate-500 uppercase">Rating</div>
                                  <div className="font-heading text-3xl text-white">{userProfile?.stats?.eloRating?.slice(-1)[0] || 1000}</div>
                              </div>
                          </div>

                          {/* Possible Answers Section */}
                          {possibleAnswers.length > 0 && (
                              <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 text-left max-h-60 overflow-y-auto custom-scrollbar">
                                  <h4 className="text-xs text-slate-500 uppercase mb-2 sticky top-0 bg-slate-900/90 py-1">
                                      Possible Answers ({possibleAnswers.length})
                                  </h4>
                                  <div className="flex flex-wrap gap-2">
                                      {displayAnswers.map((ans, i) => (
                                          <span key={i} className="bg-slate-800 text-slate-300 px-2 py-1 rounded text-xs border border-slate-700">
                                              {ans}
                                          </span>
                                      ))}
                                      {remaining > 0 && (
                                          <span className="text-slate-500 text-xs self-center">+{remaining} more...</span>
                                      )}
                                  </div>
                              </div>
                          )}
                          
                          <div className="mt-6">
                              <ArcadeButton onClick={() => navigate('/')} className="w-full">RETURN HOME</ArcadeButton>
                          </div>
                      </ArcadeCard>

                      {/* Log Section (In Flow) */}
                      <div className="w-full max-w-md opacity-60 hover:opacity-100 transition-opacity duration-300">
                         <div className="bg-slate-900/30 border border-slate-800/50 rounded-xl h-64 overflow-hidden">
                             <GameLog history={gameData.history} myRole={myRole} getPlayer={getPlayer} getTeam={getTeam} className="h-full" />
                         </div>
                      </div>
                  </div>
              </div>
          </div>
      );
  }

  const lastMove = gameData.history.length > 0 ? gameData.history[gameData.history.length - 1] : null;
  const promptPlayer = gameData.lastPlayerId ? getPlayer(gameData.lastPlayerId) : null;
  const promptAttribute = gameData.lastAttribute;

  // Determine Prompt Text
  let promptText = "Start the game!";
  if (lastMove && gameData.status === 'playing') {
      if (gameData.nextInputType === 'attribute') {
          promptText = `Name something that matches ${promptPlayer?.name || 'this player'}`;
      } else {
          const attrVal = promptAttribute.value;
          const attrType = promptAttribute.type;
          if (attrType === 'team') promptText = `Name someone who played for the ${formatTeamName(attrVal, getTeam)}.`;
          else if (attrType === 'number') promptText = `Name someone who wore #${attrVal}.`;
          else if (attrType === 'college') promptText = `Name someone who went to ${attrVal}.`;
      }
  }

  return (
    <div className="h-screen bg-dark-bg text-white font-sans overflow-hidden flex flex-col">
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
      
      {/* Top Bar */}
      <header className="flex-none bg-card-bg/50 backdrop-blur border-b border-slate-800 p-2 md:p-4 flex justify-between items-center z-20">
         <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <span className="font-heading text-2xl tracking-wider hidden md:inline">BALL KNOWER</span>
         </div>
         <div className="flex items-center gap-2 md:gap-4">
            <button onClick={() => setShowRules(true)} className="text-slate-400 hover:text-white px-3 py-1 rounded hover:bg-slate-800 transition-colors font-heading text-lg">RULES</button>
            <button onClick={() => setShowConfirmGiveUp(true)} className="text-red-500 hover:text-red-400 px-3 py-1 rounded hover:bg-red-500/10 transition-colors font-heading text-lg">GIVE UP</button>
         </div>
      </header>

      <div className="flex-grow overflow-y-auto custom-scrollbar relative bg-dark-bg">
          
          <div className="min-h-full flex flex-col p-6 max-w-4xl mx-auto w-full">
              
              {/* Player Cards */}
              <div className="grid grid-cols-2 gap-4 mb-8 w-full">
                 <PlayerCard player={gameData.players.A} isTurn={gameData.turn === 'A'} isMe={myRole === 'A'} timer={timeLeft} />
                 <PlayerCard player={gameData.players.B} isTurn={gameData.turn === 'B'} isMe={myRole === 'B'} timer={timeLeft} />
              </div>

              {/* Main Game Stage */}
              <div className="flex flex-col justify-center items-center w-full space-y-8 mb-12 min-h-[300px]">
         
                 {error && (
                    <div className="bg-red-500 text-white px-6 py-2 rounded-full shadow-lg animate-bounce-short z-50 font-bold flex items-center mb-4">
                       <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                       {error}
                    </div>
                 )}

                 {/* Prompt Display */}
                 <div className="text-center space-y-4">
            {gameData.challengeStatus === 'pending' ? (
                        <div className="animate-pulse-slow">
                            <h2 className="font-heading text-6xl text-brand-pink text-glow-pink mb-2">CHALLENGE ACTIVE</h2>
                            <p className="text-2xl text-slate-300">{gameData.challengedPlayer === myRole ? "PROVE YOUR ANSWER" : "OPPONENT RESPONDING..."}</p>
                </div>
            ) : (
                <>
                            <h2 className="font-heading text-4xl md:text-6xl leading-tight text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400 drop-shadow-2xl px-4">
                        {promptText}
                    </h2>
                        </>
                    )}
                 </div>

                 {/* Controls & Input Area */}
                 <div className="w-full max-w-xl bg-card-bg/50 backdrop-blur-md border border-slate-700/50 p-6 rounded-2xl shadow-2xl relative">
                    
                    {/* Turn Indicator Overlay (if not my turn) */}
                    {!isMyTurn && gameData.challengeStatus === 'none' && (
                        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] z-20 flex items-center justify-center rounded-2xl">
                            <div className="flex items-center space-x-3">
                                <div className="w-3 h-3 bg-slate-500 rounded-full animate-bounce"></div>
                                <div className="w-3 h-3 bg-slate-500 rounded-full animate-bounce delay-100"></div>
                                <div className="w-3 h-3 bg-slate-500 rounded-full animate-bounce delay-200"></div>
                                <span className="font-heading text-2xl text-slate-300 pl-2 tracking-widest">OPPONENT THINKING</span>
                            </div>
                        </div>
                    )}

                    {isMyTurn && gameData.challengeStatus === 'none' ? (
                        <div className="space-y-4 relative z-30 animate-scale-in">
                            {/* Attribute Toggles */}
                    {gameData.nextInputType === 'attribute' && (
                                <div className="flex p-1 bg-slate-900/80 rounded-xl border border-slate-700">
                            {['number', 'team', 'college'].map(type => (
                                <button
                                    key={type}
                                            onClick={() => setSelectedAttributeType(type)}
                                            className={`flex-1 py-2 rounded-lg font-heading text-lg transition-all ${selectedAttributeType === type ? 'bg-brand-blue text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                                >
                                            {type}
                                </button>
                            ))}
                        </div>
                    )}
                    
                            {/* Input */}
                    <AutocompleteInput 
                        inputValue={inputValue}
                        onInputChange={handleInputChange}
                        onSelect={handleAnswerSelect}
                        suggestions={suggestions}
                        type={gameData.nextInputType === 'player' ? 'player' : selectedAttributeType}
                        displayAttribute="name"
                        valueAttribute="id"
                                placeholder={gameData.nextInputType === 'player' ? "Type player name..." : "Type answer..."}
                        disabled={isSubmitting}
                                className="text-center text-2xl font-heading tracking-wide"
                                autoFocus
                    />
                    
                            {/* Submit */}
                            <ArcadeButton 
                        onClick={handleSubmitAnswer}
                        disabled={!inputValue || isSubmitting}
                                className="w-full"
                                size="lg"
                            >
                                SUBMIT MOVE
                            </ArcadeButton>
                            
                            {/* Action Row (Challenge/Reverse) */}
                            {gameData.history.length > 0 && (
                                <div className="flex justify-center gap-4 pt-2">
                                    <button onClick={() => setShowConfirmChallenge(true)} className="text-xs font-bold text-slate-500 hover:text-brand-pink uppercase tracking-wider transition-colors flex items-center">
                                        <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                        Challenge
                                    </button>
                                    <button onClick={handleReverse} className="text-xs font-bold text-slate-500 hover:text-brand-blue uppercase tracking-wider transition-colors flex items-center">
                                        <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                        Reverse
                                    </button>
                                </div>
                            )}
                </div>
            ) : gameData.challengeStatus === 'pending' && gameData.challengedPlayer === myRole ? (
                        <div className="space-y-4 relative z-30 animate-scale-in">
                    {gameData.challengeType === 'player' && (
                                <div className="flex p-1 bg-slate-900/80 rounded-xl border border-slate-700">
                             {['number', 'team', 'college'].map(type => (
                                        <button key={type} onClick={() => setChallengeResponseAttributeType(type)} className={`flex-1 py-2 rounded-lg font-heading text-lg ${challengeResponseAttributeType === type ? 'bg-brand-pink text-white' : 'text-slate-400'}`}>{type}</button>
                             ))}
                        </div>
                    )}
                    <AutocompleteInput 
                        inputValue={challengeResponseInputValue}
                        onInputChange={handleChallengeResponseInputChange}
                        onSelect={handleChallengeResponseSelect}
                        suggestions={challengeResponseSuggestions}
                        type={gameData.challengeType === 'player' ? challengeResponseAttributeType : 'player'}
                        displayAttribute="name" valueAttribute="id"
                        placeholder="Enter proof..."
                                className="text-center"
                            />
                            <ArcadeButton onClick={handleChallengeResponse} variant="secondary" className="w-full" size="lg">PROVE IT</ArcadeButton>
                        </div>
                    ) : null}
                 </div>
              </div>

              {/* Log Section (Scrollable Area) */}
              <div className="w-full max-w-md mx-auto mt-auto opacity-60 hover:opacity-100 transition-opacity duration-300 pb-8">
                 <div className="bg-slate-900/30 border border-slate-800/50 rounded-xl h-48 overflow-hidden">
                     <GameLog history={gameData.history} myRole={myRole} getPlayer={getPlayer} getTeam={getTeam} className="h-full" />
                 </div>
              </div>

          </div>
         </div>

      {/* Modals */}
      {showConfirmGiveUp && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-card-bg p-8 rounded-2xl border border-red-500/30 text-center max-w-sm w-full relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-red-500"></div>
                <h3 className="text-4xl font-heading text-white mb-2">GIVE UP?</h3>
                <p className="text-slate-400 mb-8">Surrendering will count as a loss and reduce your rating.</p>
                <div className="flex gap-4">
                    <ArcadeButton onClick={() => setShowConfirmGiveUp(false)} variant="ghost" className="flex-1">CANCEL</ArcadeButton>
                    <ArcadeButton onClick={confirmGiveUp} variant="danger" className="flex-1">SURRENDER</ArcadeButton>
                </div>
            </div>
        </div>
      )}
      
      {showConfirmChallenge && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-card-bg p-8 rounded-2xl border border-brand-pink/30 text-center max-w-sm w-full relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-brand-pink"></div>
                <h3 className="text-4xl font-heading text-white mb-2">CHALLENGE?</h3>
                <p className="text-slate-400 mb-8">If you challenge incorrectly, you will lose the game immediately.</p>
                <div className="flex gap-4">
                    <ArcadeButton onClick={() => setShowConfirmChallenge(false)} variant="ghost" className="flex-1">CANCEL</ArcadeButton>
                    <ArcadeButton onClick={confirmChallenge} variant="secondary" className="flex-1">CHALLENGE</ArcadeButton>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default OnlineGameBoard;
