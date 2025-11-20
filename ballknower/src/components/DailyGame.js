import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { ensureAnonymousUser } from '../firebaseConfig';
import { doc, getDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import AutocompleteInput from './AutocompleteInput';
import { ArcadeButton, ArcadeCard } from './ArcadeUI';

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
  const { getPlayer, getTeam, searchPlayersByName, searchTeams, collegesList } = useGame();
  
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
  
  // Load the daily challenge when component mounts
  useEffect(() => {
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
  }, [dateParam, getPlayer, getTeam, navigate]);
  
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
      <div className="w-full max-w-2xl mb-8">
        <ArcadeCard className="relative overflow-hidden border-brand-pink/30" glow="pink">
             <div className="flex flex-col md:flex-row items-center justify-center text-center gap-4 md:gap-8 relative z-10">
                 <div>
                     <div className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-widest mb-1">START</div>
                     <div className="font-heading text-2xl sm:text-3xl text-white">{startElement?.name}</div>
                 </div>
                 <div className="hidden md:block w-16 h-1 bg-slate-700 rounded-full"></div>
                 <div className="md:hidden h-8 w-1 bg-slate-700 rounded-full"></div>
                 <div>
                     <div className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-widest mb-1">TARGET</div>
                     <div className="font-heading text-2xl sm:text-3xl text-brand-pink text-glow-pink">{endElement?.name}</div>
                 </div>
             </div>
        </ArcadeCard>
      </div>

      {/* Game Board */}
      <div className="w-full max-w-xl flex-grow flex flex-col">
          
          {/* History Chain */}
          <div className="space-y-2 mb-6">
              {/* Start Node */}
              <div className="flex items-center justify-center">
                  <div className="bg-slate-800 border border-slate-600 px-4 py-2 rounded-full text-slate-400 text-sm font-mono">
                      {startElement?.name}
                  </div>
              </div>
              <div className="flex justify-center"><div className="h-4 w-0.5 bg-slate-700"></div></div>
              
              {/* Moves */}
              {gameHistory.map((move, i) => (
                  <React.Fragment key={i}>
                    <div className="flex items-center justify-center animate-scale-in">
                        <div className={`px-6 py-3 rounded-xl border text-lg font-bold shadow-lg ${move.type === 'player' ? 'bg-slate-800 border-brand-blue text-white' : 'bg-slate-900 border-slate-700 text-brand-pink'}`}>
                            {move.display}
                        </div>
                    </div>
                    <div className="flex justify-center"><div className="h-4 w-0.5 bg-slate-700"></div></div>
                  </React.Fragment>
              ))}
          </div>

          {/* Input Area */}
          <div className="mt-auto bg-card-bg border border-slate-700 rounded-2xl p-4 sm:p-6 shadow-2xl relative z-20 mb-8 sm:mb-0">
              <div className="text-center mb-4">
                  <div className="text-xs text-slate-400 uppercase tracking-widest mb-1">Current Step: {moveCount + 1}</div>
                  <h2 className="font-heading text-xl sm:text-3xl text-white">
                      {nextInputType === 'player' ? 
                        `Name a player who matches...` : 
                        `How does ${getPlayer(lastPlayerId)?.name.split(' ')[0]} connect?`
                      }
                  </h2>
              </div>

              {error && <div className="text-red-500 text-center text-sm mb-4 font-bold animate-pulse">{error}</div>}

              <div className="space-y-3">
                  {nextInputType === 'attribute' && (
                       <div className="flex p-1 bg-slate-900/80 rounded-xl border border-slate-700">
                           {['number', 'team', 'college'].map(type => (
                               <button key={type} onClick={() => setSelectedAttributeType(type)} className={`flex-1 py-2 rounded-lg font-heading text-sm sm:text-lg transition-all ${selectedAttributeType === type ? 'bg-brand-pink text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>{type}</button>
                           ))}
                       </div>
                  )}
                  
                  <AutocompleteInput 
                       inputValue={inputValue}
                       onInputChange={handleInputChange}
                       onSelect={handleAnswerSelect}
                       suggestions={suggestions}
                       type={nextInputType === 'player' ? 'player' : selectedAttributeType}
                       displayAttribute="name" valueAttribute="id"
                       placeholder={nextInputType === 'player' ? "Search Player..." : "Enter Answer..."}
                       disabled={isSubmitting}
                       className="text-center font-heading text-xl sm:text-2xl"
                       autoFocus
                  />
                  
                  <ArcadeButton onClick={handleSubmit} disabled={!inputValue || isSubmitting} className="w-full text-lg sm:text-xl" variant="secondary" size="lg">
                      SUBMIT
                  </ArcadeButton>
              </div>
          </div>
      </div>

    </div>
  );
};

export default DailyGame;
