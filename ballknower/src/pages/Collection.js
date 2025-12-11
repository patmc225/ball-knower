import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { ensureAnonymousUser } from '../firebaseConfig';
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import RarityCard from '../components/RarityCard';
import AutocompleteInput from '../components/AutocompleteInput';

const Collection = () => {
  const navigate = useNavigate();
  const { userId } = useParams();
  const { getTeam, getPlayer, players, teamsList, collegesList, popularityData, searchPlayersByName, searchTeams } = useGame();
  
  const [userProfile, setUserProfile] = useState(null);
  const [targetUserProfile, setTargetUserProfile] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [userGames, setUserGames] = useState([]);
  const [rarityCache, setRarityCache] = useState({});
  const [isSelectingShowcase, setIsSelectingShowcase] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // New filter system state
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [favoritesFirst, setFavoritesFirst] = useState(false);
  const [collectionSort, setCollectionSort] = useState('rarity');
  const [sortDirection, setSortDirection] = useState('desc');
  const [typeFilters, setTypeFilters] = useState({ player: false, team: false, number: false, college: false });
  const [activeFilters, setActiveFilters] = useState({ players: [], teams: [], numbers: [], colleges: [] });
  
  // Attribute search state
  const [attributeSearchType, setAttributeSearchType] = useState('player');
  const [attributeSearchValue, setAttributeSearchValue] = useState('');
  const [attributeSuggestions, setAttributeSuggestions] = useState([]);
  
  const filterMenuRef = useRef(null);

  // Determine if this is the current user's collection or another user's
  const isMyCollection = !userId || (currentUser && currentUser.uid === userId);

  // Close filter menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target)) {
        setIsFilterMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update attribute suggestions based on search type and value
  useEffect(() => {
    if (!attributeSearchValue.trim()) {
      setAttributeSuggestions([]);
      return;
    }
    
    const query = attributeSearchValue.toLowerCase();
    
    if (attributeSearchType === 'player') {
      const results = searchPlayersByName(query).slice(0, 10);
      setAttributeSuggestions(results);
    } else if (attributeSearchType === 'team') {
      const results = searchTeams(query).slice(0, 10);
      setAttributeSuggestions(results);
    } else if (attributeSearchType === 'college') {
      const results = collegesList?.filter(c => c.toLowerCase().includes(query)).slice(0, 10) || [];
      setAttributeSuggestions(results);
    } else if (attributeSearchType === 'number') {
      const numbers = Array.from({ length: 100 }, (_, i) => String(i));
      const results = numbers.filter(n => n.startsWith(query)).slice(0, 10);
      setAttributeSuggestions(results);
    }
  }, [attributeSearchValue, attributeSearchType, searchPlayersByName, searchTeams, collegesList]);

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

  // Helper function to get display name for an item
  const getDisplayName = (item) => {
    if (item.type === 'player') {
      const playerData = getPlayer(item.value);
      return playerData?.name || item.value;
    } else if (item.type === 'team') {
      const teamData = getTeam(item.value);
      return teamData?.name || item.value;
    } else if (item.type === 'number') {
      return `#${item.value}`;
    } else if (item.type === 'college') {
      return item.value;
    }
    return item.value;
  };

  // Check if any filters are active
  const hasActiveFilters = () => {
    const hasTypeFilters = Object.values(typeFilters).some(v => v);
    const hasAttrFilters = activeFilters.players.length > 0 || activeFilters.teams.length > 0 || 
                          activeFilters.numbers.length > 0 || activeFilters.colleges.length > 0;
    return hasTypeFilters || hasAttrFilters;
  };

  // Get all active filter tags for display
  const getActiveFilterTags = () => {
    const tags = [];
    
    // Type filters
    if (typeFilters.player) tags.push({ type: 'type', value: 'player', label: 'Players' });
    if (typeFilters.team) tags.push({ type: 'type', value: 'team', label: 'Teams' });
    if (typeFilters.number) tags.push({ type: 'type', value: 'number', label: 'Numbers' });
    if (typeFilters.college) tags.push({ type: 'type', value: 'college', label: 'Colleges' });
    
    // Attribute filters
    activeFilters.players.forEach(p => tags.push({ type: 'player', value: p.id, label: p.name }));
    activeFilters.teams.forEach(t => tags.push({ type: 'team', value: t.id, label: t.name }));
    activeFilters.numbers.forEach(n => tags.push({ type: 'number', value: n, label: `#${n}` }));
    activeFilters.colleges.forEach(c => tags.push({ type: 'college', value: c, label: c }));
    
    return tags;
  };

  // Remove a filter tag
  const removeFilterTag = (tag) => {
    if (tag.type === 'type') {
      setTypeFilters(prev => ({ ...prev, [tag.value]: false }));
    } else if (tag.type === 'player') {
      setActiveFilters(prev => ({ ...prev, players: prev.players.filter(p => p.id !== tag.value) }));
    } else if (tag.type === 'team') {
      setActiveFilters(prev => ({ ...prev, teams: prev.teams.filter(t => t.id !== tag.value) }));
    } else if (tag.type === 'number') {
      setActiveFilters(prev => ({ ...prev, numbers: prev.numbers.filter(n => n !== tag.value) }));
    } else if (tag.type === 'college') {
      setActiveFilters(prev => ({ ...prev, colleges: prev.colleges.filter(c => c !== tag.value) }));
    }
  };

  // Handle adding an attribute filter
  // Handle adding an attribute filter - value is the full suggestion object for players/teams
  const handleAddAttributeFilter = (value, displayValue) => {
    if (attributeSearchType === 'player') {
      // value is the player object with id and name
      const playerId = typeof value === 'object' ? value.id : value;
      const playerName = typeof value === 'object' ? value.name : displayValue;
      if (!activeFilters.players.some(p => p.id === playerId)) {
        setActiveFilters(prev => ({ ...prev, players: [...prev.players, { id: playerId, name: playerName }] }));
      }
    } else if (attributeSearchType === 'team') {
      // value is the team object with id and name
      const teamId = typeof value === 'object' ? value.id : value;
      const teamName = typeof value === 'object' ? value.name : displayValue;
      if (!activeFilters.teams.some(t => t.id === teamId)) {
        setActiveFilters(prev => ({ ...prev, teams: [...prev.teams, { id: teamId, name: teamName }] }));
      }
    } else if (attributeSearchType === 'number') {
      if (!activeFilters.numbers.includes(value)) {
        setActiveFilters(prev => ({ ...prev, numbers: [...prev.numbers, value] }));
      }
    } else if (attributeSearchType === 'college') {
      if (!activeFilters.colleges.includes(value)) {
        setActiveFilters(prev => ({ ...prev, colleges: [...prev.colleges, value] }));
      }
    }
    setAttributeSearchValue('');
  };

  // Clear all filters
  const clearAllFilters = () => {
    setTypeFilters({ player: false, team: false, number: false, college: false });
    setActiveFilters({ players: [], teams: [], numbers: [], colleges: [] });
    setSearchQuery('');
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

      // Apply type filters
      const activeTypeFilters = Object.entries(typeFilters).filter(([_, v]) => v).map(([k]) => k);
      if (activeTypeFilters.length > 0) {
          items = items.filter(item => activeTypeFilters.includes(item.type));
      }

      // Apply attribute filters (AND logic - must match ALL specific filters)
      const hasAttrFilters = activeFilters.players.length > 0 || activeFilters.teams.length > 0 || 
                            activeFilters.numbers.length > 0 || activeFilters.colleges.length > 0;
      
      if (hasAttrFilters) {
          items = items.filter(item => {
              // For player cards: must match ALL selected teams, numbers, AND colleges
              if (item.type === 'player') {
                  const playerData = getPlayer(item.value);
                  if (!playerData) return false;
                  
                  // Must match ALL selected teams (AND)
                  if (activeFilters.teams.length > 0) {
                      const hasAllTeams = activeFilters.teams.every(t => playerData.teams?.includes(t.id));
                      if (!hasAllTeams) return false;
                  }
                  
                  // Must match ALL selected numbers (AND)
                  if (activeFilters.numbers.length > 0) {
                      const hasAllNumbers = activeFilters.numbers.every(n => playerData.numbers?.includes(String(n)));
                      if (!hasAllNumbers) return false;
                  }
                  
                  // Must match ALL selected colleges (AND)
                  if (activeFilters.colleges.length > 0) {
                      const hasAllColleges = activeFilters.colleges.every(c => playerData.colleges?.includes(c));
                      if (!hasAllColleges) return false;
                  }
                  
                  // If we have team/number/college filters and player passed all checks, show it
                  if (activeFilters.teams.length > 0 || activeFilters.numbers.length > 0 || activeFilters.colleges.length > 0) {
                      return true;
                  }
              }
              
              // For non-player cards: must be in ALL selected players' attributes (AND)
              if (activeFilters.players.length > 0) {
                  // Card must exist in ALL selected players' attributes
                  const allPlayersHaveIt = activeFilters.players.every(p => {
                      const playerData = getPlayer(p.id);
                      if (!playerData) return false;
                      
                      if (item.type === 'team') {
                          return playerData.teams?.includes(item.value);
                      }
                      if (item.type === 'number') {
                          return playerData.numbers?.includes(String(item.value));
                      }
                      if (item.type === 'college') {
                          return playerData.colleges?.includes(item.value);
                      }
                      return false;
                  });
                  
                  if (allPlayersHaveIt) return true;
              }
              
              return false;
          });
      }

      // Apply search query
      if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase();
          items = items.filter(item => {
              const displayName = getDisplayName(item).toLowerCase();
              return displayName.includes(query);
          });
      }

      // Apply sorting
      items.sort((a, b) => {
          let comparison = 0;
          
          if (collectionSort === 'recent') {
              comparison = b.lastPlayed - a.lastPlayed;
          } else if (collectionSort === 'amount') {
              comparison = b.count - a.count;
          } else if (collectionSort === 'rarity') {
              const scoreA = rarityCache[`${a.type}_${a.value}`] || 100;
              const scoreB = rarityCache[`${b.type}_${b.value}`] || 100;
              comparison = scoreB - scoreA;
          }
          
          return sortDirection === 'asc' ? -comparison : comparison;
      });
      
      // Apply favorites first
      if (favoritesFirst && userProfile?.showcase) {
          const showcased = items.filter(item => 
              userProfile.showcase.some(s => s.type === item.type && s.value === item.value)
          );
          const notShowcased = items.filter(item => 
              !userProfile.showcase.some(s => s.type === item.type && s.value === item.value)
          );
          items = [...showcased, ...notShowcased];
      }
      
      return items;
  }, [userGames, rarityCache, collectionSort, sortDirection, typeFilters, activeFilters, searchQuery, favoritesFirst, userProfile, getPlayer, getDisplayName]);

  const totalAvailable = React.useMemo(() => {
      if (!players || !teamsList || !collegesList) return 0;
      
      const activeTypeFilters = Object.entries(typeFilters).filter(([_, v]) => v).map(([k]) => k);
      const hasAttrFilters = activeFilters.players.length > 0 || activeFilters.teams.length > 0 || 
                            activeFilters.numbers.length > 0 || activeFilters.colleges.length > 0;
      
      // If specific filters are active, count matching items from all available data
      if (hasAttrFilters) {
          let total = 0;
          
          // Count players that match ALL specific filters
          if (activeFilters.teams.length > 0 || activeFilters.numbers.length > 0 || activeFilters.colleges.length > 0) {
              const matchingPlayers = players.filter(p => {
                  if (activeFilters.teams.length > 0 && !activeFilters.teams.every(t => p.teams?.includes(t.id))) return false;
                  if (activeFilters.numbers.length > 0 && !activeFilters.numbers.every(n => p.numbers?.includes(String(n)))) return false;
                  if (activeFilters.colleges.length > 0 && !activeFilters.colleges.every(c => p.colleges?.includes(c))) return false;
                  return true;
              });
              total += matchingPlayers.length;
          }
          
          // Count team/number/college cards that ALL selected players share
          if (activeFilters.players.length > 0) {
              // Find attributes that ALL selected players have in common
              let commonTeams = null;
              let commonNumbers = null;
              let commonColleges = null;
              
              activeFilters.players.forEach(p => {
                  const playerData = getPlayer(p.id);
                  if (!playerData) return;
                  
                  const pTeams = new Set(playerData.teams || []);
                  const pNumbers = new Set(playerData.numbers || []);
                  const pColleges = new Set(playerData.colleges || []);
                  
                  if (commonTeams === null) {
                      commonTeams = pTeams;
                      commonNumbers = pNumbers;
                      commonColleges = pColleges;
                  } else {
                      commonTeams = new Set([...commonTeams].filter(x => pTeams.has(x)));
                      commonNumbers = new Set([...commonNumbers].filter(x => pNumbers.has(x)));
                      commonColleges = new Set([...commonColleges].filter(x => pColleges.has(x)));
                  }
              });
              
              total += (commonTeams?.size || 0) + (commonNumbers?.size || 0) + (commonColleges?.size || 0);
          }
          
          return total;
      }
      
      // Type filters only (no specific filters)
      if (activeTypeFilters.length === 0) {
          return players.length + teamsList.length + collegesList.length + 101; 
      }
      
      let total = 0;
      if (activeTypeFilters.includes('player')) total += players.length;
      if (activeTypeFilters.includes('team')) total += teamsList.length;
      if (activeTypeFilters.includes('college')) total += collegesList.length;
      if (activeTypeFilters.includes('number')) total += 101;
      
      return total;
  }, [typeFilters, activeFilters, players, teamsList, collegesList, getPlayer]);

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

            {/* Top Row: Filter, Search, Favorites */}
            <div className="flex items-center gap-3 mb-4">
                {/* Filter Button */}
                <div className="relative" ref={filterMenuRef}>
                    <button
                        onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
                        className={`p-3 rounded-lg transition-colors border ${
                            isFilterMenuOpen || hasActiveFilters()
                                ? 'bg-brand-blue/20 border-brand-blue text-brand-blue' 
                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
                        }`}
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                        </svg>
                    </button>

                    {/* Filter Menu Dropdown */}
                    {isFilterMenuOpen && (
                        <div className="absolute top-full left-0 mt-2 w-80 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 p-4">
                            {/* Type Filters */}
                            <div className="mb-4">
                                <h3 className="text-xs font-heading uppercase tracking-wider text-slate-400 mb-2">Filter by Type</h3>
                                <div className="flex flex-wrap gap-2">
                                    {['player', 'team', 'number', 'college'].map(type => (
                                        <button
                                            key={type}
                                            onClick={() => setTypeFilters(prev => ({ ...prev, [type]: !prev[type] }))}
                                            className={`px-3 py-1.5 rounded-md text-xs font-heading uppercase tracking-wider transition-colors ${
                                                typeFilters[type]
                                                    ? 'bg-brand-blue text-white'
                                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                            }`}
                                        >
                                            {type}s
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Attribute Search */}
                            <div className="mb-4">
                                <h3 className="text-xs font-heading uppercase tracking-wider text-slate-400 mb-2">Add Specific Filter</h3>
                                <div className="flex gap-2 mb-2">
                                    <select
                                        value={attributeSearchType}
                                        onChange={(e) => {
                                            setAttributeSearchType(e.target.value);
                                            setAttributeSearchValue('');
                                        }}
                                        className="bg-slate-700 text-white text-xs px-2 py-1.5 rounded-md border border-slate-600 focus:outline-none focus:border-brand-blue"
                                    >
                                        <option value="player">Player</option>
                                        <option value="team">Team</option>
                                        <option value="number">Number</option>
                                        <option value="college">College</option>
                                    </select>
                                </div>
                                <div className="relative">
                                    <AutocompleteInput
                                        inputValue={attributeSearchValue}
                                        onInputChange={setAttributeSearchValue}
                                        onSelect={handleAddAttributeFilter}
                                        suggestions={attributeSuggestions}
                                        displayAttribute={attributeSearchType === 'player' || attributeSearchType === 'team' ? 'name' : undefined}
                                        placeholder={`Search ${attributeSearchType}s...`}
                                        type={attributeSearchType}
                                        className="!py-2 !text-sm !bg-slate-700"
                                    />
                                </div>
                            </div>

                            {/* Selected Attribute Filters */}
                            {(activeFilters.players.length > 0 || activeFilters.teams.length > 0 || 
                              activeFilters.numbers.length > 0 || activeFilters.colleges.length > 0) && (
                                <div className="mb-4">
                                    <h3 className="text-xs font-heading uppercase tracking-wider text-slate-400 mb-2">Active Attribute Filters</h3>
                                    <div className="flex flex-wrap gap-1.5">
                                        {activeFilters.players.map(p => (
                                            <span key={p.id} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/20 text-blue-400 rounded-md text-xs">
                                                {p.name}
                                                <button onClick={() => removeFilterTag({ type: 'player', value: p.id })} className="hover:text-white">×</button>
                                            </span>
                                        ))}
                                        {activeFilters.teams.map(t => (
                                            <span key={t.id} className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 rounded-md text-xs">
                                                {t.name}
                                                <button onClick={() => removeFilterTag({ type: 'team', value: t.id })} className="hover:text-white">×</button>
                                            </span>
                                        ))}
                                        {activeFilters.numbers.map(n => (
                                            <span key={n} className="inline-flex items-center gap-1 px-2 py-1 bg-purple-500/20 text-purple-400 rounded-md text-xs">
                                                #{n}
                                                <button onClick={() => removeFilterTag({ type: 'number', value: n })} className="hover:text-white">×</button>
                                            </span>
                                        ))}
                                        {activeFilters.colleges.map(c => (
                                            <span key={c} className="inline-flex items-center gap-1 px-2 py-1 bg-orange-500/20 text-orange-400 rounded-md text-xs">
                                                {c}
                                                <button onClick={() => removeFilterTag({ type: 'college', value: c })} className="hover:text-white">×</button>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Sort Options */}
                            <div className="mb-4">
                                <h3 className="text-xs font-heading uppercase tracking-wider text-slate-400 mb-2">Sort By</h3>
                                <div className="flex gap-2">
                                    <select
                                        value={collectionSort}
                                        onChange={(e) => setCollectionSort(e.target.value)}
                                        className="flex-1 bg-slate-700 text-white text-xs px-3 py-2 rounded-md border border-slate-600 focus:outline-none focus:border-brand-blue"
                                    >
                                        <option value="rarity">Rarity</option>
                                        <option value="recent">Recent</option>
                                        <option value="amount">Count</option>
                                    </select>
                                    <button
                                        onClick={() => setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc')}
                                        className="px-3 py-2 bg-slate-700 text-white rounded-md border border-slate-600 hover:bg-slate-600 transition-colors"
                                    >
                                        {sortDirection === 'desc' ? (
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        ) : (
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Clear All Button */}
                            {hasActiveFilters() && (
                                <button
                                    onClick={clearAllFilters}
                                    className="w-full py-2 text-xs font-heading uppercase tracking-wider text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-md transition-colors"
                                >
                                    Clear All Filters
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Search Input */}
                <div className="flex-1 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search cards..."
                        className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-brand-blue transition-colors text-sm"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>

                {/* Favorites Button - Combined show favorites + edit mode */}
                {isMyCollection && (
                    <button
                        onClick={() => {
                            const newState = !favoritesFirst;
                            setFavoritesFirst(newState);
                            setIsSelectingShowcase(newState);
                        }}
                        className={`p-3 rounded-lg transition-colors border ${
                            favoritesFirst
                                ? 'bg-yellow-500/20 border-yellow-500 text-yellow-500' 
                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
                        }`}
                        title="Show favorites first & edit"
                    >
                        {favoritesFirst ? (
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                            </svg>
                        ) : (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                            </svg>
                        )}
                    </button>
                )}
            </div>

            {/* Active Filters Display */}
            {!isFilterMenuOpen && hasActiveFilters() && (
                <div className="flex flex-wrap items-center gap-2 mb-4 p-2 bg-slate-800/50 rounded-lg">
                    <span className="text-xs text-slate-500 uppercase tracking-wider">Filters:</span>
                    {getActiveFilterTags().map((tag, i) => (
                        <span 
                            key={`${tag.type}-${tag.value}-${i}`}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs ${
                                tag.type === 'type' ? 'bg-slate-700 text-slate-300' :
                                tag.type === 'player' ? 'bg-blue-500/20 text-blue-400' :
                                tag.type === 'team' ? 'bg-green-500/20 text-green-400' :
                                tag.type === 'number' ? 'bg-purple-500/20 text-purple-400' :
                                'bg-orange-500/20 text-orange-400'
                            }`}
                        >
                            {tag.label}
                            <button 
                                onClick={() => removeFilterTag(tag)}
                                className="hover:text-white transition-colors"
                            >
                                ×
                            </button>
                        </span>
                    ))}
                    <button
                        onClick={clearAllFilters}
                        className="text-xs text-red-400 hover:text-red-300 ml-2"
                    >
                        Clear all
                    </button>
                </div>
            )}
            
            <div className="flex-grow relative min-h-[50vh]">
                {isLoading || !players?.length ? (
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
                                    rarityScore={rarityCache[`${item.type}_${item.value}`] || 100}
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
