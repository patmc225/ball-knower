import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { ensureAnonymousUser } from '../firebaseConfig';
import { doc, getDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import AutocompleteInput from './AutocompleteInput';
import { ArcadeCard } from './ArcadeUI';
import { updateRarity, getTeamLogoUrl, getCollegeLogoUrl } from '../utils/gameUtils'; 

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

const DailyGame = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { getPlayer, getTeam, searchPlayersByName, searchTeams, collegesList, loading: dataLoading } = useGame();
  
  // Get date from URL query or use current date
  const queryParams = new URLSearchParams(location.search);
  const dateParam = queryParams.get('date');
  
  // Game state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dailyDocId, setDailyDocId] = useState(dateParam || getCurrentDate());
  const [isPastChallenge, setIsPastChallenge] = useState(!!dateParam);
  const [dailyData, setDailyData] = useState(null);
  const [startElement, setStartElement] = useState(null);
  const [endElement, setEndElement] = useState(null);
  const [gameHistory, setGameHistory] = useState([]);
  const [nextInputType, setNextInputType] = useState('attribute');
  const [gameFinished, setGameFinished] = useState(false);
  const [moveCount, setMoveCount] = useState(0);
  const [currentPlayerId, setCurrentPlayerId] = useState(null);
  const [lastPlayerId, setLastPlayerId] = useState(null);
  const [lastAttribute, setLastAttribute] = useState({ type: null, value: null });
  const [usedPlayerIds, setUsedPlayerIds] = useState([]);
  
  // Input state
  const [inputValue, setInputValue] = useState('');
  const [finalSelectedValue, setFinalSelectedValue] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [selectedAttributeType, setSelectedAttributeType] = useState('number');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fallbackYears, setFallbackYears] = useState({});

  // Helper function to get image URL for a specific year
  const getImageUrlForYear = (playerId, league, year) => {
      if (league === 'NFL') {
          return `https://www.pro-football-reference.com/req/20230307/images/headshots/${playerId}_${year}.jpg`;
      } else if (league === 'NBA') {
          return `https://www.basketball-reference.com/req/202106291/images/headshots/${playerId}_${year}.jpg`;
      }
      return null;
  };
  
  // Load the daily challenge when component mounts
  useEffect(() => {
    if (dataLoading) return;

    const loadDailyChallenge = async () => {
      try {
        setLoading(true);
        setError('');
        
        const challengeDate = dateParam || getCurrentDate();
        setDailyDocId(challengeDate);
        setIsPastChallenge(!!dateParam);
        
        const dailyRef = doc(db, "daily", challengeDate);
        const dailySnap = await getDoc(dailyRef);
        
        if (dailySnap.exists()) {
          const data = dailySnap.data();
          setDailyData(data);
          
          // Setup Start Element
          if (data.startType === 'player') {
            const player = getPlayer(data.startId);
            setStartElement({ id: data.startId, type: 'player', name: player ? player.name : data.startId });
            setLastPlayerId(data.startId);
            setUsedPlayerIds([data.startId]);
            setNextInputType('attribute');
          } else {
            // For non-player starts, we set them as the 'lastAttribute' so the user must name a player first
            let name = data.startId;
            if (data.startType === 'team') { const t = getTeam(data.startId); name = t ? t.name : data.startId; }
            else if (data.startType === 'number') { name = `#${data.startId}`; }
            
            setStartElement({ id: data.startId, type: data.startType, name: name, value: data.startId });
            setLastAttribute({ type: data.startType, value: data.startId });
            setNextInputType('player');
          }
          
          // Setup End Element
          let endName = data.endId;
          if (data.endType === 'player') { const p = getPlayer(data.endId); endName = p ? p.name : data.endId; }
          else if (data.endType === 'team') { const t = getTeam(data.endId); endName = t ? t.name : data.endId; }
          else if (data.endType === 'number') { endName = `#${data.endId}`; }
          setEndElement({ id: data.endId, type: data.endType, name: endName });
          
          // Check if completed
          const user = await ensureAnonymousUser();
          if (user) {
            setCurrentPlayerId(user.uid);
            const userSnap = await getDoc(doc(db, "users", user.uid));
            if (userSnap.exists()) {
              const userData = userSnap.data();
              if (!dateParam && userData.stats?.daily && userData.stats.daily[challengeDate]) {
                navigate(`/daily-result?date=${encodeURIComponent(challengeDate)}&moves=${userData.stats.daily[challengeDate]}`);
                return;
              }
            }
          }
          
          setGameHistory([]);
          
        } else {
          setError('Challenge not found. Please try another date or check back later!');
        }
      } catch (err) {
        console.error("Error loading challenge:", err);
        setError('Failed to load challenge. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    loadDailyChallenge();
  }, [dateParam, getPlayer, getTeam, navigate, dataLoading]);
  
  // Input Handlers
  const handleInputChange = (value) => {
    setInputValue(value);
    setFinalSelectedValue('');
    setError('');
    
    if (!value.trim()) { setSuggestions([]); return; }
    
    if (nextInputType === 'player') {
        setSuggestions(searchPlayersByName(value).slice(0, 8));
    } else if (nextInputType === 'attribute') {
        if (selectedAttributeType === 'team') setSuggestions(searchTeams(value).slice(0, 8));
        else if (selectedAttributeType === 'college') setSuggestions(collegesList.filter(c => c.toLowerCase().includes(value.toLowerCase())).slice(0, 8));
        else setSuggestions([]);
    }
  };
  
  const handleAnswerSelect = (value, display) => {
      setInputValue(display);
      setFinalSelectedValue(value);
      setSuggestions([]);
  };

  // Simplified validation for this UI refactor (logic remains in gameUtils generally, but inlined here for daily)
  const validateMove = (value, type) => {
    if (!value) return { isValid: false, error: "Please enter a value." };
    
    if (nextInputType === 'player') {
      if (usedPlayerIds.includes(value)) return { isValid: false, error: "Player already used." };
      
      const player = getPlayer(value);
      if (!player) return { isValid: false, error: "Player not found." };
      
      // Check connection to last attribute
      let match = false;
      const attrVal = String(lastAttribute.value).toLowerCase();
      if (lastAttribute.type === 'team') match = player.teams?.some(t => String(t).toLowerCase() === attrVal);
      else if (lastAttribute.type === 'number') match = player.numbers?.some(n => String(n).toLowerCase() === attrVal);
      else if (lastAttribute.type === 'college') match = player.colleges?.some(c => String(c).toLowerCase() === attrVal);
      
      if (!match) return { isValid: false, error: `Player doesn't match the previous ${lastAttribute.type}.` };
      
      // Check win condition
      if (endElement.type === 'player' && value === endElement.id) return { isValid: true, endReached: true };
      
      return { isValid: true };
    } 
    
    if (nextInputType === 'attribute') {
        const player = getPlayer(lastPlayerId);
        const valLower = String(value).toLowerCase();
        let match = false;
        
        if (type === 'team') match = player.teams?.some(t => String(t).toLowerCase() === valLower);
        else if (type === 'number') match = player.numbers?.some(n => String(n).toLowerCase() === valLower);
        else if (type === 'college') match = player.colleges?.some(c => String(c).toLowerCase() === valLower);
        
        if (!match) return { isValid: false, error: `Player didn't have this ${type}.` };
        
        // Check win condition
        if (endElement.type === type && valLower === String(endElement.id).toLowerCase()) return { isValid: true, endReached: true };
        
        return { isValid: true };
    }
    return { isValid: false };
  };

  const handleSubmit = async () => {
    if (isSubmitting || !inputValue) return;
    setIsSubmitting(true);
    
    let val = finalSelectedValue || inputValue;
    let type = nextInputType === 'player' ? 'player' : selectedAttributeType;
    
    const validation = validateMove(val, type);
    
    if (!validation.isValid) {
        setError(validation.error);
        setIsSubmitting(false);
        return;
    }
    
    // Update Rarity (Fire and forget)
    updateRarity(val, type);
    
    // Display Value
    let display = val;
    if (type === 'player') display = getPlayer(val)?.name || val;
    else if (type === 'team') display = getTeam(val)?.name || val;
    else if (type === 'number') display = `#${val}`;
    
    const newHistory = [...gameHistory, { type, value: val, display, timestamp: new Date() }];
    setGameHistory(newHistory);
    setMoveCount(prev => prev + 1);
    
    if (type === 'player') {
        setLastPlayerId(val);
        setUsedPlayerIds(prev => [...prev, val]);
        setNextInputType('attribute');
        // Reset default attribute
        setSelectedAttributeType('number'); 
    } else {
        setLastAttribute({ type, value: val });
        setNextInputType('player');
    }
    
    setInputValue('');
    setFinalSelectedValue('');
    
    if (validation.endReached) {
        setGameFinished(true);
        const finalMoves = moveCount + 1;
        
        // Save stats
        const dailyRef = doc(db, "daily", dailyDocId);
        await updateDoc(dailyRef, { plays: increment(1), moves: increment(finalMoves) }); // simplified
        
        if (currentPlayerId && !isPastChallenge) {
            const userRef = doc(db, "users", currentPlayerId);
            await updateDoc(userRef, { [`stats.daily.${dailyDocId}`]: finalMoves, updatedAt: serverTimestamp() });
        }
        
        navigate(`/daily-result?date=${encodeURIComponent(dailyDocId)}&moves=${finalMoves}`);
    }
    
    setIsSubmitting(false);
  };

  // Render
  if (loading) return <div className="min-h-screen bg-dark-bg flex items-center justify-center"><div className="w-16 h-16 border-4 border-brand-pink border-t-transparent rounded-full animate-spin"></div></div>;
  
  return (
    <div className="min-h-screen bg-dark-bg text-white font-sans p-4 pb-24 sm:pb-4 flex flex-col items-center">
      
      {/* Header */}
      <header className="w-full max-w-2xl flex items-center justify-between mb-8">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <div>
                <h1 className="font-heading text-xl sm:text-2xl leading-none tracking-wide">DAILY CHALLENGE</h1>
                <p className="text-xs text-slate-500 font-mono">{dailyDocId}</p>
            </div>
         </div>
         <button onClick={() => navigate('/past-daily-challenges')} className="text-slate-400 hover:text-white text-sm font-bold uppercase">Archives</button>
      </header>

      {/* Goal Card */}
      <div className="w-full max-w-2xl mb-6 sm:mb-8">
        <ArcadeCard className="relative overflow-hidden border-brand-pink/30" glow="pink">
             <div className="flex flex-row items-center justify-between text-center gap-2 sm:gap-8 relative z-10">
                 <div className="flex-1 min-w-0 flex flex-col items-center">
                     <div className="text-[9px] sm:text-xs text-slate-500 uppercase tracking-widest mb-0.5">START</div>
                     <div className="font-heading text-lg sm:text-3xl text-white truncate px-1">{startElement?.name}</div>
                 </div>
                 
                 <div className="flex-shrink-0 flex flex-col items-center px-2 border-x border-slate-800/50">
                    <div className="text-[8px] sm:text-[10px] text-slate-500 uppercase tracking-widest mb-0.5">BEST</div>
                    <div className="font-heading text-base sm:text-xl text-neon-green whitespace-nowrap">{dailyData?.shortestPath || '?'}</div>
                 </div>

                 <div className="flex-1 min-w-0 flex flex-col items-center">
                     <div className="text-[9px] sm:text-xs text-slate-500 uppercase tracking-widest mb-0.5">TARGET</div>
                     <div className="font-heading text-lg sm:text-3xl text-brand-pink text-glow-pink truncate px-1">{endElement?.name}</div>
                 </div>
             </div>
        </ArcadeCard>
      </div>

      {/* Game Board */}
      <div className="w-full max-w-xl flex-grow flex flex-col">

          {/* Input Area - Moved to Top */}
          <div className="w-full max-w-xl relative z-50 mb-6">
              <div className="text-center mb-3">
                  <div className="text-xs text-slate-400 uppercase tracking-widest mb-1">Move {moveCount + 1}</div>
                  <h2 className="font-heading text-lg sm:text-xl text-white">
                      {nextInputType === 'player' ? 
                        `Name a player who matches...` : 
                        `How does ${getPlayer(lastPlayerId)?.name} connect?`
                      }
                  </h2>
              </div>

              {error && <div className="text-red-500 text-center text-xs mb-3 font-bold animate-pulse">{error}</div>}

              <div className="space-y-2">
                  {nextInputType === 'attribute' && (
                       <div className="flex p-1 bg-slate-900/80 rounded-xl border border-slate-700">
                           {['number', 'team', 'college'].map(type => (
                               <button key={type} onClick={() => setSelectedAttributeType(type)} className={`flex-1 py-1.5 uppercase rounded-lg font-heading text-sm sm:text-sm transition-all ${selectedAttributeType === type ? 'bg-brand-pink text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>{type}</button>
                           ))}
                       </div>
                  )}
                  
                  <AutocompleteInput 
                       inputValue={inputValue}
                       onInputChange={handleInputChange}
                       onSelect={handleAnswerSelect}
                       onSubmit={handleSubmit}
                       suggestions={suggestions}
                       type={nextInputType === 'player' ? 'player' : selectedAttributeType}
                       displayAttribute="name" valueAttribute="id"
                       placeholder={nextInputType === 'player' ? "Search Player..." : "Enter Answer..."}
                       disabled={isSubmitting}
                       className="text-center font-heading text-base text-sm sm:text-md"
                       autoFocus
                  />
              </div>
          </div>
          
          {/* History Chain */}
          <div className="space-y-2 mb-6 flex-grow">
              {/* Start Node */}
              <div className="flex items-center justify-center">
                  <div className="bg-slate-800 border border-slate-600 px-4 py-2 rounded-full text-slate-400 text-xs sm:text-sm font-mono">
                      {startElement?.name}
                  </div>
              </div>
              <div className="flex justify-center"><div className="h-4 w-0.5 bg-slate-700"></div></div>
              
              {/* Moves */}
              {gameHistory.map((move, i) => (
                  <React.Fragment key={i}>
                    <div className="flex items-center justify-center animate-scale-in">
                        <div className={`px-4 py-2 sm:px-6 sm:py-3 rounded-xl border text-sm sm:text-lg font-bold shadow-lg flex items-center gap-3 ${move.type === 'player' ? 'bg-slate-800 border-brand-blue text-white' : 'bg-slate-900 border-slate-700 text-brand-pink'}`}>
                            {move.type === 'player' && (
                                <div className="w-8 h-8 rounded-full overflow-hidden">
                                    <img
                                        src={
                                            (() => {
                                                const player = getPlayer(move.value);
                                                const currentFallbackYear = fallbackYears[move.value];
                                                if (player?.league === 'NFL') {
                                                    return currentFallbackYear ?
                                                        getImageUrlForYear(move.value, 'NFL', currentFallbackYear) :
                                                        `https://www.pro-football-reference.com/req/20230307/images/headshots/${move.value}.jpg`;
                                                } else {
                                                    return currentFallbackYear ?
                                                        getImageUrlForYear(move.value, 'NBA', currentFallbackYear) :
                                                        `https://www.basketball-reference.com/req/202106291/images/headshots/${move.value}.jpg`;
                                                }
                                            })()
                                        }
                                        alt=""
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            const player = getPlayer(move.value);
                                            const currentYear = fallbackYears[move.value] || (player?.end_year || new Date().getFullYear());
                                            const startYear = player?.start_year || currentYear;

                                            if (currentYear > startYear) {
                                                setFallbackYears(prev => ({ ...prev, [move.value]: currentYear - 1 }));
                                            } else {
                                                e.target.style.display = 'none';
                                            }
                                        }}
                                    />
                                </div>
                            )}
                            {move.type === 'team' && (
                                <div className="w-8 h-8 rounded-full overflow-hidden p-0.5 flex items-center justify-center">
                                    <img src={getTeamLogoUrl(move.value)} alt="" className="w-full h-full object-contain" />
                                </div>
                            )}
                            {move.type === 'college' && (
                                <div className="w-8 h-8 rounded-full overflow-hidden p-0.5 flex items-center justify-center">
                                    {getCollegeLogoUrl(move.value) ? (
                                        <img src={getCollegeLogoUrl(move.value)} alt="" className="w-full h-full object-contain" onError={(e) => {e.target.style.display='none'; e.target.nextSibling.style.display='block'}} />
                                    ) : null}
                                    <svg style={{display: getCollegeLogoUrl(move.value) ? 'none' : 'block'}} width="800px" height="800px" viewBox="0 0 15 15" className="w-1/2 h-1/2 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                                        <path d="M7.5,1L0,4.5l2,0.9v1.7C1.4,7.3,1,7.9,1,8.5s0.4,1.2,1,1.4V10l-0.9,2.1&#xA; C0.8,13,1,14,2.5,14s1.7-1,1.4-1.9L3,10c0.6-0.3,1-0.8,1-1.5S3.6,7.3,3,7.1V5.9L7.5,8L15,4.5L7.5,1z M11.9,7.5l-4.5,2L5,8.4v0.1&#xA; c0,0.7-0.3,1.3-0.8,1.8l0.6,1.4v0.1C4.9,12.2,5,12.6,4.9,13c0.7,0.3,1.5,0.5,2.5,0.5c3.3,0,4.5-2,4.5-3L11.9,7.5L11.9,7.5z"/>
                                    </svg>
                                </div>
                            )}
                            {move.display}
                        </div>
                    </div>
                    <div className="flex justify-center"><div className="h-4 w-0.5 bg-slate-700"></div></div>
                  </React.Fragment>
              ))}
          </div>
      </div>

    </div>
  );
};

export default DailyGame;
