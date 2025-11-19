import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as api from '../services/api';
import { createNewGame, submitAnswer, endGame, initiateChallenge as initiateChallengeUtil, resolveChallenge as resolveChallengeUtil, validateMoveForReversal } from '../utils/gameUtils';
import { ensureAnonymousUser } from '../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

// Create context
const GameContext = createContext();

// Custom hook to use the context
export const useGame = () => useContext(GameContext);

// Provider component
export const GameProvider = ({ children }) => {
  const [players, setPlayers] = useState([]);
  const [games, setGames] = useState([]);
  const [users, setUsers] = useState([]);
  const [currentGame, setCurrentGame] = useState(null);
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [popularityData, setPopularityData] = useState({});
  const [teamsList, setTeamsList] = useState([]);
  const [collegesList, setCollegesList] = useState([]);
  const [userProfile, setUserProfile] = useState(null);

  // Initialize anonymous user and get profile
  useEffect(() => {
    const initUser = async () => {
      try {
        const user = await ensureAnonymousUser();
        if (user) {
          // Get the user's profile from Firestore
          const userRef = doc(db, "users", user.uid);
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
            const userData = userSnap.data();
            setUserProfile(userData);
            setCurrentPlayer({
              userId: user.uid,
              nickname: userData.displayName,
              rating: userData.stats?.eloRating || 1000,
              gamesPlayed: userData.stats?.gamesPlayed || 0
            });
          }
        }
      } catch (error) {
        console.error("Error initializing user:", error);
      }
    };
    
    initUser();
  }, []);

  // Initialize data (Users, Games, Popularity, Players, Teams, Colleges)
  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      try {
        // api.initializeData now handles loading players_new.json correctly
        const result = await api.initializeData(); 
        if (result.success) {
          // Restore the state setters - they now get the correct data from api.js getters
          setPlayers(api.getPlayers()); 
          setGames(api.getGames());
          setUsers(api.getUsers());
          setPopularityData(api.getPopularityData());
          setTeamsList(api.getTeams()); // Uses the new getter from api.js
          setCollegesList(api.getColleges()); 
          setError(null);
        } else {
          setError(result.error || 'Failed to initialize data');
        }
      } catch (err) {
        setError(err.message || 'An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };

    initData();
  }, []); // This effect runs once on mount

  // Create a new game using the current user's profile
  const startNewGame = async (playerAName, playerBName) => {
    if (!userProfile) {
      // Try to initialize the user if not already done
      try {
        const user = await ensureAnonymousUser();
        if (!user) {
          return { success: false, error: 'Unable to authenticate user' };
        }
        
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const userData = userSnap.data();
          setUserProfile(userData);
          playerAName = userData.displayName;
        } else {
          return { success: false, error: 'User profile not found' };
        }
      } catch (error) {
        return { success: false, error: 'Authentication failed' };
      }
    } else {
      // Use the current user profile name if not provided
      playerAName = playerAName || userProfile.displayName;
    }
    
    // Create new game object
    const newGame = createNewGame(playerAName, playerBName);
    
    // Save to API
    const result = await api.createGame(newGame);
    
    if (result.success) {
      setGames(api.getGames());
      setCurrentGame(result.game);
    }
    
    return result;
  };

  // Submit an answer for the current game
  // answer: The selected value (player ID or attribute value)
  // submittedAttributeType: Optional, indicates if 'number', 'team', or 'college' was submitted
  const makeMove = async (playerId, answer, submittedAttributeType = null) => {
    if (!currentGame) {
      return { success: false, error: 'No active game' };
    }
    
    // Call the updated game utility function
    const result = submitAnswer(
      currentGame, 
      playerId, // The player making the move ('A' or 'B')
      answer,   // The submitted value (player ID or attribute string)
      submittedAttributeType, // 'number', 'team', 'college' or null
      players, 
      popularityData
    );
    
    if (result.success) {
      // Update the game in the API
      const updateResult = await api.updateGame(result.game);
      
      if (updateResult.success) {
        setCurrentGame(updateResult.game);
        setGames(api.getGames());
      }
    }
    
    return result;
  };

  // End the current game
  const finishGame = async (winningPlayer) => {
    if (!currentGame) {
      return { success: false, error: 'No active game' };
    }
    
    const result = endGame(currentGame, winningPlayer, users);
    
    if (result.success) {
      // Update game
      await api.updateGame(result.game);
      
      // Update users
      await api.updateUsers(result.users);
      
      // Refresh state
      setCurrentGame(result.game);
      setGames(api.getGames());
      setUsers(result.users);
    }
    
    return result;
  };

  // Join an existing game by ID
  const joinGame = async (gameId) => {
    const game = api.getGameById(gameId);
    
    if (!game) {
      return { success: false, error: 'Game not found' };
    }
    
    setCurrentGame(game);
    return { success: true, game };
  };

  // Search players by attribute
  const searchPlayersByAttribute = (attribute, query) => {
    return api.searchPlayers(attribute, query);
  };

  // Search players by name
  const searchPlayersByName = (query) => {
    return api.searchPlayers('name', query);
  };

  // Search teams
  const searchTeams = (query) => {
    return api.searchTeams(query);
  };

  // Get a player by ID
  const getPlayer = (playerId) => {
    return api.getPlayerById(playerId);
  };

  // Get a team by ID (New helper)
  const getTeam = (teamId) => {
    return api.getTeamById(teamId);
  };

  // --- Challenge Functions ---
  const initiateChallenge = async (gameId, challengingPlayerId) => {
    const game = api.getGameById(gameId);
    if (!game) return { success: false, error: 'Game not found' };
    
    // Call the utility function
    const result = initiateChallengeUtil(game, challengingPlayerId, players);
    
    if (result.success) {
      // Update the game state via API/local storage
      const updateResult = await api.updateGame(result.game);
      if (updateResult.success) {
        setCurrentGame(updateResult.game); // Update local context state
      } else {
         // Handle potential API update error (e.g., revert context state or show error)
         console.error("Failed to save challenge initiation state.");
         // Might need to reload game state from API here to ensure consistency
         return { success: false, error: "Failed to save challenge state."};
      }
    } 
    
    return result; // Return success/failure from utility
  };

  // resolveChallenge 
  const resolveChallenge = async (gameId, respondingPlayerId, chosenAttribute) => {
     const game = api.getGameById(gameId);
     if (!game) return { success: false, error: 'Game not found' };
 
     // Call the utility function
     const result = resolveChallengeUtil(game, respondingPlayerId, chosenAttribute, players, users);
     
     if (result.success) {
       // If challenge was resolved (failed or succeeded), update game state
       const updateGameResult = await api.updateGame(result.game);
       if (!updateGameResult.success) {
          console.error("Failed to save challenge resolution game state.");
          return { success: false, error: "Failed to save game state after challenge."};
       }
       // If game ended due to challenge, update users too
       if (result.users) { 
          const updateUsersResult = await api.updateUsers(result.users);
          if (!updateUsersResult.success) {
             console.error("Failed to save user stats after challenge win.");
             // Continue anyway, game state is more critical
          }
          setUsers(api.getUsers()); // Update context user state
       }
       setCurrentGame(updateGameResult.game); // Update context game state

       // If game ended, navigate (or rely on useEffect in GameBoard)
       if (result.game.status === 'closed') {
          // Optional: immediate navigation
          // navigate('/game-over'); 
       }

     } else {
       // Utility function returned an error (e.g., invalid state)
       console.error("Challenge resolution utility failed:", result.error);
     }
     
     return result; // Return success/failure/updated game from utility
  };
  // --- End Challenge Functions ---

  // Function to attempt reversing the turn (CORRECTED)
  const attemptReverse = useCallback(async (gameId, playerId, value, attribute) => {
    if (!currentGame || currentGame.gameId !== gameId || currentGame.turn !== playerId) {
      return { success: false, error: "Invalid state for reversal attempt." };
    }
    if (currentGame.challengeStatus !== 'none') {
        return { success: false, error: "Cannot reverse during a challenge." };
    }
    if (currentGame.history.length === 0) {
        return { success: false, error: "Cannot reverse on the first move." };
    }

    // 1. Validate the submitted move without changing state
    const validationResult = validateMoveForReversal(currentGame, players, value, attribute);

    if (!validationResult.isValid) {
      return { success: false, error: validationResult.error || "Invalid move for reverse." };
    }

    // 2. If valid, simply switch the turn
    const nextTurn = currentGame.turn === 'A' ? 'B' : 'A';
    const reverseHistoryEntry = { // Create history entry for the reversal
       player: playerId, 
       type: 'reverse',
       value: `reversed turn with valid input`, // Maybe include the validated input?
       timestamp: new Date().toISOString()
    };
    const updatedGameData = {
      ...currentGame,
      turn: nextTurn,
      history: [...currentGame.history, reverseHistoryEntry], // Add reversal to history
      // IMPORTANT: Do NOT update usedPlayerIds, lastMove, etc.
    };

    // 3. Update using the API layer 
    try {
      // Call the existing updateGame function from the API service
      const updateResult = await api.updateGame(updatedGameData);
      
      if (updateResult.success) {
         setCurrentGame(updateResult.game); 
         setGames(api.getGames()); 
         return { success: true, game: updateResult.game };
      } else {
         // Handle API update error
         console.error("Error updating game via API for reverse:", updateResult.error);
         return { success: false, error: updateResult.error || "Failed to update game state for reverse." };
      }

    } catch (error) {
      console.error("Error calling api.updateGame for reverse:", error);
      return { success: false, error: "An unexpected error occurred updating the game." };
    }
  }, [currentGame, players]);

  // Value to be provided by the context
  const value = {
    players,
    games,
    users,
    currentGame,
    currentPlayer,
    loading,
    error,
    popularityData,
    teamsList,
    collegesList,
    userProfile,
    startNewGame,
    makeMove,
    finishGame,
    joinGame,
    searchPlayersByAttribute,
    searchPlayersByName,
    searchTeams,
    getPlayer,
    getTeam,
    setCurrentPlayer,
    initiateChallenge,
    resolveChallenge,
    attemptReverse,
  };

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
}; 