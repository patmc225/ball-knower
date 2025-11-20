import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { useGame } from '../context/GameContext';
import Footer from '../components/Footer';

const GameOver = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { getPlayer, getTeam, players } = useGame();
  
  const [gameData, setGameData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [playerAData, setPlayerAData] = useState(null);
  const [playerBData, setPlayerBData] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [showAnswers, setShowAnswers] = useState(false);
  const [correctAnswers, setCorrectAnswers] = useState([]);
  const [lastValidMoveData, setLastValidMoveData] = useState(null);
  const [shouldShowPossibleAnswers, setShouldShowPossibleAnswers] = useState(false);
  
  // Get the gameId from the URL query parameters
  const queryParams = new URLSearchParams(location.search);
  const gameId = queryParams.get('gameId');
  
  // Effect to set current user ID
  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      setCurrentUserId(user.uid);
    }
  }, []);
  
  // Load game data with retry mechanism
  const loadGameData = async (isManualRefresh = false) => {
    if (!gameId) {
      setError("No game ID provided");
      setLoading(false);
      return;
    }
    
    if (isManualRefresh) {
      setLoading(true);
      setError(null);
    }
    
    try {
      const gameRef = doc(db, "games", gameId);
      const gameSnap = await getDoc(gameRef);
      
      if (gameSnap.exists()) {
        const data = gameSnap.data();
        if (data.status === 'finished') {
          setGameData(data);
          setRetryCount(0); // Reset retry count on success
        } else {
          // If game is not finished yet, retry a few times automatically
          if (retryCount < 3) {
            setRetryCount(prevCount => prevCount + 1);
            // Wait longer between each retry attempt
            const delay = (retryCount + 1) * 1000; // Increasing delay: 1s, 2s, 3s
            
            setTimeout(() => loadGameData(), delay);
            return;
          } else {
            setError("Game is not finished yet. Please try refreshing.");
          }
        }
      } else {
        setError("Game not found");
      }
    } catch (err) {
      console.error("Error loading game data:", err);
      setError("Failed to load game data");
    } finally {
      setLoading(false);
    }
  };
  
  // Effect to load the game data
  useEffect(() => {
    loadGameData();
  }, [gameId]); // eslint-disable-line react-hooks/exhaustive-deps
  
  // Load player data from Firestore
  useEffect(() => {
    const fetchPlayerData = async () => {
      try {
        // Add a small delay to ensure ratings are fully updated in Firestore
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        if (gameData && gameData.players && gameData.players.A && gameData.players.A.id) {
          const userRefA = doc(db, "users", gameData.players.A.id);
          const userSnapA = await getDoc(userRefA);
          if (userSnapA.exists()) {
            setPlayerAData(userSnapA.data());
          }
        }
        
        if (gameData && gameData.players && gameData.players.B && gameData.players.B.id) {
          const userRefB = doc(db, "users", gameData.players.B.id);
          const userSnapB = await getDoc(userRefB);
          if (userSnapB.exists()) {
            setPlayerBData(userSnapB.data());
          }
        }
      } catch (error) {
        console.error("Error fetching player data:", error);
      }
    };
    
    fetchPlayerData();
  }, [gameData]);

  // Helper function for team name format
  const formatTeamName = (teamId) => {
    const teamData = getTeam(teamId);
    return teamData ? `${teamData.name}` : teamId;
  };
  
  // Process game data to extract last move and game end reason
  useEffect(() => {
    if (!gameData || !gameData.history || gameData.history.length === 0) return;
    
    const history = gameData.history;
    const lastEvent = history[history.length - 1];
    
    // Find the last valid move before the game ended
    let localLastValidMove = null;
    let responseMove = null;
    
    for (let i = history.length - 1; i >= 0; i--) {
      // Look for the response (incorrect answer, challenge response)
      if (!responseMove && (history[i].type === 'incorrect' || 
          history[i].type === 'game_end_incorrect' || 
          history[i].type === 'challenge_resolved' || 
          history[i].type === 'game_end_challenge')) {
        responseMove = history[i];
      }
      
      // Look for the last valid move
      if (!localLastValidMove && ['player', 'number', 'team', 'college'].includes(history[i].type)) {
        localLastValidMove = history[i];
        // If we found both, stop looking
        if (responseMove) break;
      }
      
      // Don't go too far back
      if (history.length - i > 20) break;
    }
    
    // Format last answer for display
    let lastAnswer = "";
    if (localLastValidMove) {
      if (localLastValidMove.type === 'player') {
        const player = getPlayer(localLastValidMove.value);
        lastAnswer = player ? player.name : localLastValidMove.value;
      } else if (localLastValidMove.type === 'team') {
        lastAnswer = formatTeamName(localLastValidMove.value);
      } else if (localLastValidMove.type === 'number') {
        lastAnswer = `#${localLastValidMove.value}`;
      } else {
        lastAnswer = localLastValidMove.value;
      }
    }
    
    // Get the response value if available
    let responseValue = "";
    if (responseMove) {
      if (responseMove.incorrectAnswer) {
        responseValue = responseMove.incorrectAnswer;
      } 
      else if (responseMove.responseValue) {
        responseValue = responseMove.responseValue;
      } else if (responseMove.value) {
        responseValue = responseMove.value;
      } 
    }
    
    // Check if we should show possible answers for this game ending
    let localShouldShowAnswers = false;
    if (lastEvent.type.startsWith('game_end_')) {
      const reasonType = lastEvent.type.replace('game_end_', '');
      if (reasonType === 'incorrect' || reasonType === 'timeout' || reasonType === 'give_up') {
        // Only show answers if the last answer was a player
        localShouldShowAnswers = localLastValidMove && localLastValidMove.type === 'player';
      }
    }
    
    setLastValidMoveData(localLastValidMove);
    setShouldShowPossibleAnswers(localShouldShowAnswers);
  }, [gameData]);
  
  
  // Function to generate correct answers based on last move
  const generateCorrectAnswers = useEffect(() => {
    if (!lastValidMoveData || !shouldShowPossibleAnswers || !gameData) return;
    
    const answers = [];
    
    if (lastValidMoveData.type === 'player') {
      // For a player, show all their teams, numbers, and colleges
      const player = getPlayer(lastValidMoveData.value);
      
      if (player) {
        // Add teams
        if (player.teams && player.teams.length > 0) {
          answers.push({ 
            category: 'Teams', 
            items: player.teams.map(teamId => {
              const team = getTeam(teamId);
              return team ? `${team.name}` : teamId;
            })
          });
        }
        
        // Add jersey numbers
        if (player.numbers && player.numbers.length > 0) {
          answers.push({
            category: 'Jersey Numbers',
            items: player.numbers.map(num => `#${num}`)
          });
        }
        
        // Add colleges
        if (player.colleges && player.colleges.length > 0) {
          answers.push({
            category: 'Colleges',
            items: player.colleges
          });
        }
      }
    } else {
      // For team, number, or college, find 10 random matching players
      const allPlayers = Object.values(players || {});
      let matchingPlayers = [];
      
      if (lastValidMoveData.type === 'team') {
        matchingPlayers = allPlayers.filter(p => 
          p.teams && p.teams.includes(lastValidMoveData.value)
        );
      } else if (lastValidMoveData.type === 'number') {
        matchingPlayers = allPlayers.filter(p => 
          p.numbers && p.numbers.includes(lastValidMoveData.value)
        );
      } else if (lastValidMoveData.type === 'college') {
        matchingPlayers = allPlayers.filter(p => 
          p.colleges && p.colleges.includes(lastValidMoveData.value)
        );
      }
      
      // Shuffle and take up to 10
      if (matchingPlayers.length > 0) {
        // Fisher-Yates shuffle
        for (let i = matchingPlayers.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [matchingPlayers[i], matchingPlayers[j]] = [matchingPlayers[j], matchingPlayers[i]];
        }
        
        const displayPlayers = matchingPlayers.slice(0, 10);
        answers.push({
          category: 'Players',
          items: displayPlayers.map(p => p.name)
        });
      }
    }
    
    setCorrectAnswers(answers);
  }, [lastValidMoveData, shouldShowPossibleAnswers, gameData, players, getPlayer, getTeam]);
  
  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="text-center p-6">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading game results...</p>
        {retryCount > 0 && (
          <p className="text-sm text-gray-500 mt-2">Retry attempt {retryCount}/3...</p>
        )}
      </div>
    </div>;
  }
  
  if (error || !gameData) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="text-center p-6 max-w-md bg-white rounded-lg shadow-lg">
        <h2 className="text-xl font-bold text-red-600 mb-4">Error</h2>
        <p className="text-gray-700 mb-6">{error || "Failed to load game data"}</p>
        
        <div className="flex flex-col space-y-3 sm:flex-row sm:space-y-0 sm:space-x-3 justify-center">
          {error === "Game is not finished yet. Please try refreshing." && (
            <button 
              onClick={() => loadGameData(true)} 
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              Refresh
            </button>
          )}
          <button 
            onClick={() => navigate('/')} 
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>;
  }
  
  // Determine outcome and user roles
  const { players: gamePlayers, winner, history, eloChange } = gameData;
  
  const isPlayerA = currentUserId === gamePlayers.A?.id;
  const isPlayerB = currentUserId === gamePlayers.B?.id;
  const myRole = isPlayerA ? 'A' : (isPlayerB ? 'B' : null);
  const didIWin = myRole && myRole === winner;
  
  // Extract the final event/reason from the history
  let reasonDetail = "";
  let detailedReason = "";
  let localLastValidMove = null;
  let responseMove = null;
  let lastAnswer = "";
  let responseValue = "";
  let localShouldShowAnswers = false;
  
  if (gameData && gameData.history && gameData.history.length > 0) {
    const history = gameData.history;
    const lastEvent = history[history.length - 1];
    
    // Find the last valid move before the game ended
    for (let i = history.length - 1; i >= 0; i--) {
      // Look for the response (incorrect answer, challenge response)
      if (!responseMove && (history[i].type === 'incorrect' || 
          history[i].type === 'game_end_incorrect' || 
          history[i].type === 'challenge_resolved' || 
          history[i].type === 'game_end_challenge')) {
        responseMove = history[i];
      }
      
      // Look for the last valid move
      if (!localLastValidMove && ['player', 'number', 'team', 'college'].includes(history[i].type)) {
        localLastValidMove = history[i];
        // If we found both, stop looking
        if (responseMove) break;
      }
      
      // Don't go too far back
      if (history.length - i > 20) break;
    }
      

    // Format last answer for display
    if (localLastValidMove) {
      if (localLastValidMove.type === 'player') {
        const player = getPlayer(localLastValidMove.value);
        lastAnswer = player ? player.name : localLastValidMove.value;
      } else if (localLastValidMove.type === 'team') {
        lastAnswer = formatTeamName(localLastValidMove.value);
      } else if (localLastValidMove.type === 'number') {
        lastAnswer = `#${localLastValidMove.value}`;
      } else {
        lastAnswer = localLastValidMove.value;
      }
    }
    
    // Get the response value if available
    if (responseMove) {
      if (responseMove.incorrectAnswer) {
        responseValue = responseMove.incorrectAnswer;
      } else if (responseMove.responseValue) {
        responseValue = responseMove.responseValue;
      } else if (responseMove.value) {
        responseValue = responseMove.value;
      }
    }
    
    // Check if we should show possible answers for this game ending
    if (lastEvent.type.startsWith('game_end_')) {
      const reasonType = lastEvent.type.replace('game_end_', '');
      if (reasonType === 'incorrect' || reasonType === 'timeout' || reasonType === 'give_up') {
        // Only show answers if the last answer was a player
        localShouldShowAnswers = localLastValidMove && localLastValidMove.type === 'player';
      }
    }

    if (lastEvent.type?.startsWith('game_end_')) {
      // Parse the end reason
      const reasonType = lastEvent.type.replace('game_end_', '');
      const winnerRole = winner; // 'A' or 'B'
      const loserRole = winner === 'A' ? 'B' : 'A';
      const loserName = gamePlayers[loserRole]?.name || `Player ${loserRole}`;
      const isUserLoser = (isPlayerA && loserRole === 'A') || (isPlayerB && loserRole === 'B');
      
      // Check if this was a challenge
      let wasChallenge = false;
      let challengePlayer = null;
      
      // Look for the most recent challenge initiation
      for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].type === 'challenge_initiated') {
          wasChallenge = true;
          challengePlayer = history[i].player;
          break;
        }
        // Don't go too far back in history
        if (history.length - i > 15) break;
      }
      
      // If this was a challenge, find how it ended
      if (wasChallenge) {
        // The challenger either won or lost
        const challengerWon = challengePlayer === winner;
        const challengerName = gamePlayers[challengePlayer]?.name || `Player ${challengePlayer}`;
        const challengedName = gamePlayers[challengePlayer === 'A' ? 'B' : 'A']?.name || `Player ${challengePlayer === 'A' ? 'B' : 'A'}`;
        const isUserChallenger = (isPlayerA && challengePlayer === 'A') || (isPlayerB && challengePlayer === 'B');
        
        // Check if this was a successful challenge response
        let wasSuccessfulResponse = false;
        // Look for challenge_resolved or similar event
        for (let i = history.length - 1; i >= Math.max(0, history.length - 15); i--) {
          if (history[i].type === 'challenge_resolved' || 
              (history[i].type === 'game_end_challenge' && !challengerWon)) {
            wasSuccessfulResponse = true;
            break;
          }
        }
        
        if (wasSuccessfulResponse) {
          // Challenge was responded to successfully
          if (didIWin) {
            // User won, opponent's challenge failed
            const opponentName = isUserChallenger ? challengedName : challengerName;
            reasonDetail = `${opponentName}'s challenge failed`;
            // Detailed reason
            detailedReason = `You correctly responded to ${lastAnswer} with ${responseValue}`;
          } else {
            // User lost, their challenge failed
            reasonDetail = "Your challenge failed";
            // Detailed reason
            detailedReason = `${challengedName} correctly responded to ${lastAnswer} with ${responseValue}`;
          }
        }
        // Check how the challenge ended
        else if (reasonType === 'timeout') {
          if (didIWin) {
            reasonDetail = `${loserName} ran out of time`;
            detailedReason = `${loserName} failed to respond to ${lastAnswer}`;
          } else {
            reasonDetail = "You ran out of time";
            detailedReason = `You failed to respond to ${lastAnswer}`;
          }
        } else if (reasonType === 'give_up') {
          if (didIWin) {
            reasonDetail = `${loserName} gave up`;
            detailedReason = `${loserName} failed to respond to ${lastAnswer}`;
          } else {
            reasonDetail = "You gave up";
            detailedReason = `You failed to respond to ${lastAnswer}`;
          }
        } else {
          // Default: incorrect or other challenge end
          if (didIWin) {
            reasonDetail = `${loserName} guessed incorrectly`;
            
            // Format based on the type of incorrect submission and last answer
            if (localLastValidMove && responseValue) {
              if (localLastValidMove.type === 'player') {
                const playerName = getPlayer(localLastValidMove.value)?.name || localLastValidMove.value;
                if (responseMove.valueType === 'number') {
                  detailedReason = `${playerName} never wore #${responseValue}`;
                } else if (responseMove.valueType === 'team') {
                  const teamName = formatTeamName(responseValue);
                  detailedReason = `${playerName} never played for the ${teamName}`;
                } else if (responseMove.valueType === 'college') {
                  detailedReason = `${playerName} never played at ${responseValue}`;
                } else {
                  detailedReason = `${loserName} incorrectly responded to ${lastAnswer} with ${responseValue}`;
                }
              } else if (localLastValidMove.type === 'number') {
                // If the incorrect submission is a player & the last answer is a number
                const playerName = responseValue;
                detailedReason = `${playerName} never wore #${localLastValidMove.value}`;
              } else if (localLastValidMove.type === 'team') {
                // If the incorrect submission is a player & the last answer is a team
                const playerName = responseValue;
                const teamName = formatTeamName(localLastValidMove.value);
                detailedReason = `${playerName} never played for the ${teamName}`;
              } else if (localLastValidMove.type === 'college') {
                // If the incorrect submission is a player & the last answer is a college
                const playerName = responseValue;
                detailedReason = `${playerName} never played at ${localLastValidMove.value}`;
              } else {
                detailedReason = `${loserName} incorrectly responded to ${lastAnswer} with ${responseValue}`;
              }
            } else {
              detailedReason = `${loserName} incorrectly responded to ${lastAnswer} with ${responseValue}`;
            }
          } else {
            reasonDetail = "You guessed incorrectly";
            
            // Format based on the type of incorrect submission and last answer
            if (localLastValidMove && responseValue) {
              if (localLastValidMove.type === 'player') {
                const playerName = getPlayer(localLastValidMove.value)?.name || localLastValidMove.value;
                
                if (responseMove.valueType === 'number') {
                  detailedReason = `${playerName} never wore #${responseValue}`;
                } else if (responseMove.valueType === 'team') {
                  const teamName = formatTeamName(responseValue);
                  detailedReason = `${playerName} never played for the ${teamName}`;
                } else if (responseMove.valueType === 'college') {
                  detailedReason = `${playerName} never played at ${responseValue}`;
                } else {
                  detailedReason = `You incorrectly responded to ${lastAnswer} with ${responseValue}`;
                }
              } else if (localLastValidMove.type === 'number') {
                // If the incorrect submission is a player & the last answer is a number
                const playerName = responseValue;
                detailedReason = `${playerName} never wore #${localLastValidMove.value}`;
              } else if (localLastValidMove.type === 'team') {
                // If the incorrect submission is a player & the last answer is a team
                const playerName = responseValue;
                const teamName = formatTeamName(localLastValidMove.value);
                detailedReason = `${playerName} never played for the ${teamName}`;
              } else if (localLastValidMove.type === 'college') {
                // If the incorrect submission is a player & the last answer is a college
                const playerName = responseValue;
                detailedReason = `${playerName} never played at ${localLastValidMove.value}`;
              } else {
                detailedReason = `You incorrectly responded to ${lastAnswer} with ${responseValue}`;
              }
            } else {
              detailedReason = `You incorrectly responded to ${lastAnswer} with ${responseValue}`;
            }
          }
        }
      } else {
        // Normal game end (not a challenge)
        if (didIWin) {
          // User won - show opponent's reason for losing
          switch (reasonType) {
            case 'timeout':
              reasonDetail = `${loserName} ran out of time`;
              detailedReason = `${loserName} failed to respond to ${lastAnswer}`;
              break;
            case 'give_up':
              reasonDetail = `${loserName} gave up`;
              detailedReason = `${loserName} failed to respond to ${lastAnswer}`;
              break;
            case 'incorrect':
            default:
              reasonDetail = `${loserName} guessed incorrectly`;
              
              // Format based on the type of incorrect submission and last answer
              if (localLastValidMove && responseValue) {
                if (localLastValidMove.type === 'player') {
                  const playerName = getPlayer(localLastValidMove.value)?.name || localLastValidMove.value;
                  
                  if (responseMove.valueType === 'number') {
                    detailedReason = `${playerName} never wore #${responseValue}`;
                  } else if (responseMove.valueType === 'team') {
                    const teamName = formatTeamName(responseValue);
                    detailedReason = `${playerName} never played for the ${teamName}`;
                  } else if (responseMove.valueType === 'college') {
                    detailedReason = `${playerName} never played at ${responseValue}`;
                  } else {
                    detailedReason = `${loserName} incorrectly responded to ${lastAnswer} with ${responseValue}`;
                  }
                } else if (localLastValidMove.type === 'number') {
                  // If the incorrect submission is a player & the last answer is a number
                  const playerName = responseValue;
                  detailedReason = `${playerName} never wore #${localLastValidMove.value}`;
                } else if (localLastValidMove.type === 'team') {
                  // If the incorrect submission is a player & the last answer is a team
                  const playerName = responseValue;
                  const teamName = formatTeamName(localLastValidMove.value);
                  detailedReason = `${playerName} never played for the ${teamName}`;
                } else if (localLastValidMove.type === 'college') {
                  // If the incorrect submission is a player & the last answer is a college
                  const playerName = responseValue;
                  detailedReason = `${playerName} never played at ${localLastValidMove.value}`;
                } else {
                  detailedReason = `${loserName} incorrectly responded to ${lastAnswer} with ${responseValue}`;
                }
              } else {
                detailedReason = `${loserName} incorrectly responded to ${lastAnswer} with ${responseValue}`;
              }
              break;
          }
        } else {
          // User lost - use "You" phrasing
          switch (reasonType) {
            case 'timeout':
              reasonDetail = "You ran out of time";
              detailedReason = `You failed to respond to ${lastAnswer}`;
              break;
            case 'give_up':
              reasonDetail = "You gave up";
              detailedReason = `You failed to respond to ${lastAnswer}`;
              break;
            case 'incorrect':
            default:
              reasonDetail = "You guessed incorrectly";
              
              // Format based on the type of incorrect submission and last answer
              if (localLastValidMove && responseValue) {
                if (localLastValidMove.type === 'player') {
                  const playerName = getPlayer(localLastValidMove.value)?.name || localLastValidMove.value;
                  
                  if (responseMove.valueType === 'number') {
                    detailedReason = `${playerName} never wore #${responseValue}`;
                  } else if (responseMove.valueType === 'team') {
                    const teamName = formatTeamName(responseValue);
                    detailedReason = `${playerName} never played for the ${teamName}`;
                  } else if (responseMove.valueType === 'college') {
                    detailedReason = `${playerName} never played at ${responseValue}`;
                  } else {
                    detailedReason = `${loserName} incorrectly responded to ${lastAnswer} with ${responseValue}`;
                  }
                } else if (localLastValidMove.type === 'number') {
                  // If the incorrect submission is a player & the last answer is a number
                  const playerName = responseValue;
                  detailedReason = `${playerName} never wore #${localLastValidMove.value}`;
                } else if (localLastValidMove.type === 'team') {
                  // If the incorrect submission is a player & the last answer is a team
                  const playerName = responseValue;
                  const teamName = formatTeamName(localLastValidMove.value);
                  detailedReason = `${playerName} never played for the ${teamName}`;
                } else if (localLastValidMove.type === 'college') {
                  // If the incorrect submission is a player & the last answer is a college
                  const playerName = responseValue;
                  detailedReason = `${playerName} never played at ${localLastValidMove.value}`;
                } else {
                  detailedReason = `${loserName} incorrectly responded to ${lastAnswer} with ${responseValue}`;
                }
              } else {
                detailedReason = `${loserName} incorrectly responded to ${lastAnswer} with ${responseValue}`;
              }
              break;
          }
        }
      }
    }
  }
  
  // Helper function for attribute label
  const getAttributeLabel = (attribute) => {
    switch (attribute) {
      case 'player': return 'Player';
      case 'number': return '#';
      case 'team': return 'Team';
      case 'college': return 'College';
      default: return attribute || 'N/A';
    }
  };
  
  
  // Get ELO changes if available
  const eloGainA = gameData.eloChange?.A || 0;
  const eloGainB = gameData.eloChange?.B || 0;
  
  // Helper function to get the latest ELO rating from an array or a number
  const getLatestElo = (eloRating) => {
    if (!eloRating) return 1000;
    
    if (Array.isArray(eloRating)) {
      return eloRating.length > 0 ? eloRating[eloRating.length - 1] : 1000;
    }
    
    return eloRating;
  };

  // Function to calculate ELO change from the rating history
  const getEloChange = (eloRating) => {
    if (!eloRating) return 0;
    
    if (Array.isArray(eloRating) && eloRating.length >= 2) {
      return eloRating[eloRating.length - 1] - eloRating[eloRating.length - 2];
    }
    
    return 0;
  };
  
  return (
    <div className="max-w-3xl mx-auto p-6 pb-4 min-h-screen">
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        {/* Game Result Header */}
        <div className="text-center mb-8">
          {didIWin ? (
            <h1 className="text-3xl font-bold text-green-600 mb-4">You Won!</h1>
          ) : (
            <h1 className="text-3xl font-bold text-red-600 mb-4">You Lost</h1>
          )}
          
          <div className="text-xl font-semibold text-gray-800">{reasonDetail}</div>
          {detailedReason && (
            <p className="text-sm text-gray-600 mt-2">{detailedReason}</p>
          )}
          
          {/* Correct Answers Section */}
          {localShouldShowAnswers && correctAnswers.length > 0 && (
            <div className="mt-6">
              <button 
                onClick={() => setShowAnswers(!showAnswers)}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center mx-auto"
              >
                <span>{showAnswers ? 'Hide' : 'Show'} possible answers</span>
                <svg 
                  className={`ml-1 w-4 h-4 transform ${showAnswers ? 'rotate-180' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {showAnswers && (
                <div className="mt-3 bg-gray-50 rounded p-4 text-left">
                  {correctAnswers.map((category, i) => (
                    <div key={i} className="mb-3 last:mb-0">
                      <h4 className="font-medium text-gray-700">{category.category}:</h4>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {category.items.map((item, j) => (
                          <span key={j} className="px-2 py-1 bg-gray-200 rounded-full text-xs">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Player Stats */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Reorder boxes so user always comes first */}
          {myRole ? (
            <>
              {/* Current User's stats */}
              <div className={`rounded-lg p-4 ${myRole === winner ? 'bg-green-50 border border-green-300' : 'bg-red-50 border border-red-300'}`}>
                <div className="flex justify-between items-center mb-3">
                  <div className="text-xl font-bold">{myRole === 'A' ? 
                    (playerAData?.displayName || gamePlayers.A?.name || "Player A") : 
                    (playerBData?.displayName || gamePlayers.B?.name || "Player B")}</div>
                  <div className={`text-sm px-2 py-1 rounded-full ${myRole === winner ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                    {myRole === winner ? 'Winner' : 'Loser'}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center">
                    <span className="text-gray-600 mr-2">Rating:</span>
                    <span className="font-semibold">{myRole === 'A' ? 
                      getLatestElo(playerAData?.stats?.eloRating) : 
                      getLatestElo(playerBData?.stats?.eloRating)}</span>
                    
                    {/* ELO change */}
                    {myRole === 'A' && getEloChange(playerAData?.stats?.eloRating) !== 0 && (
                      <span className={`ml-2 ${getEloChange(playerAData?.stats?.eloRating) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {getEloChange(playerAData?.stats?.eloRating) > 0 ? 
                          `+${getEloChange(playerAData?.stats?.eloRating)}` : 
                          getEloChange(playerAData?.stats?.eloRating)}
                      </span>
                    )}
                    {myRole === 'B' && getEloChange(playerBData?.stats?.eloRating) !== 0 && (
                      <span className={`ml-2 ${getEloChange(playerBData?.stats?.eloRating) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {getEloChange(playerBData?.stats?.eloRating) > 0 ? 
                          `+${getEloChange(playerBData?.stats?.eloRating)}` : 
                          getEloChange(playerBData?.stats?.eloRating)}
                      </span>
                    )}
                    
                    {/* Win/Loss Record */}
                    <span className="text-xs text-gray-500 ml-3">
                      ({myRole === 'A' ? (playerAData?.stats?.wins || 0) : (playerBData?.stats?.wins || 0)} - {myRole === 'A' ? (playerAData?.stats?.losses || 0) : (playerBData?.stats?.losses || 0)})
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Opponent's stats */}
              <div className={`rounded-lg p-4 ${myRole !== winner ? 'bg-green-50 border border-green-300' : 'bg-red-50 border border-red-300'}`}>
                <div className="flex justify-between items-center mb-3">
                  <div className="text-xl font-bold">{myRole === 'A' ? 
                    (playerBData?.displayName || gamePlayers.B?.name || "Player B") : 
                    (playerAData?.displayName || gamePlayers.A?.name || "Player A")}</div>
                  <div className={`text-sm px-2 py-1 rounded-full ${myRole !== winner ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                    {myRole !== winner ? 'Winner' : 'Loser'}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center">
                    <span className="text-gray-600 mr-2">Rating:</span>
                    <span className="font-semibold">{myRole === 'A' ? 
                      getLatestElo(playerBData?.stats?.eloRating) : 
                      getLatestElo(playerAData?.stats?.eloRating)}</span>
                    
                    {/* ELO change */}
                    {myRole === 'A' && getEloChange(playerBData?.stats?.eloRating) !== 0 && (
                      <span className={`ml-2 ${getEloChange(playerBData?.stats?.eloRating) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {getEloChange(playerBData?.stats?.eloRating) > 0 ? 
                          `+${getEloChange(playerBData?.stats?.eloRating)}` : 
                          getEloChange(playerBData?.stats?.eloRating)}
                      </span>
                    )}
                    {myRole === 'B' && getEloChange(playerAData?.stats?.eloRating) !== 0 && (
                      <span className={`ml-2 ${getEloChange(playerAData?.stats?.eloRating) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {getEloChange(playerAData?.stats?.eloRating) > 0 ? 
                          `+${getEloChange(playerAData?.stats?.eloRating)}` : 
                          getEloChange(playerAData?.stats?.eloRating)}
                      </span>
                    )}
                    
                    {/* Win/Loss Record */}
                    <span className="text-xs text-gray-500 ml-3">
                      ({myRole === 'A' ? (playerBData?.stats?.wins || 0) : (playerAData?.stats?.wins || 0)} - {myRole === 'A' ? (playerBData?.stats?.losses || 0) : (playerAData?.stats?.losses || 0)})
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Player A stats if no user identification */}
              <div className={`rounded-lg p-4 ${winner === 'A' ? 'bg-green-50 border border-green-300' : 'bg-red-50 border border-red-300'}`}>
                <div className="flex justify-between items-center mb-3">
                  <div className="text-xl font-bold">{playerAData?.displayName || gamePlayers.A?.name || "Player A"}</div>
                  <div className={`text-sm px-2 py-1 rounded-full ${winner === 'A' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                    {winner === 'A' ? 'Winner' : 'Loser'}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center">
                    <span className="text-gray-600 mr-2">Rating:</span>
                    <span className="font-semibold">{getLatestElo(playerAData?.stats?.eloRating)}</span>
                    
                    {/* ELO change */}
                    {getEloChange(playerAData?.stats?.eloRating) !== 0 && (
                      <span className={`ml-2 ${getEloChange(playerAData?.stats?.eloRating) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {getEloChange(playerAData?.stats?.eloRating) > 0 ? 
                          `+${getEloChange(playerAData?.stats?.eloRating)}` : 
                          getEloChange(playerAData?.stats?.eloRating)}
                      </span>
                    )}
                    
                    {/* Win/Loss Record */}
                    <span className="text-xs text-gray-500 ml-3">
                      ({playerAData?.stats?.wins || 0} - {playerAData?.stats?.losses || 0})
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Player B stats if no user identification */}
              <div className={`rounded-lg p-4 ${winner === 'B' ? 'bg-green-50 border border-green-300' : 'bg-red-50 border border-red-300'}`}>
                <div className="flex justify-between items-center mb-3">
                  <div className="text-xl font-bold">{playerBData?.displayName || gamePlayers.B?.name || "Player B"}</div>
                  <div className={`text-sm px-2 py-1 rounded-full ${winner === 'B' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                    {winner === 'B' ? 'Winner' : 'Loser'}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center">
                    <span className="text-gray-600 mr-2">Rating:</span>
                    <span className="font-semibold">{getLatestElo(playerBData?.stats?.eloRating)}</span>
                    
                    {/* ELO change */}
                    {getEloChange(playerBData?.stats?.eloRating) !== 0 && (
                      <span className={`ml-2 ${getEloChange(playerBData?.stats?.eloRating) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {getEloChange(playerBData?.stats?.eloRating) > 0 ? 
                          `+${getEloChange(playerBData?.stats?.eloRating)}` : 
                          getEloChange(playerBData?.stats?.eloRating)}
                      </span>
                    )}
                    
                    {/* Win/Loss Record */}
                    <span className="text-xs text-gray-500 ml-3">
                      ({playerBData?.stats?.wins || 0} - {playerBData?.stats?.losses || 0})
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
        
        {/* Game History Section */}
        <div className="mt-8">
          <h3 className="font-semibold text-lg mb-3 text-center">Game History</h3>
          <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto text-sm space-y-2 border border-gray-200">
            {history && history.length > 0 ? (
              [...history]
                .reverse()
                .map((move, index) => {
                  const originalIndex = history.length - 1 - index;
                  const turnNumber = originalIndex + 1;
                  const playerNickname = gamePlayers[move.player]?.name || `Player ${move.player}`;
                  
                  // Special action moves (challenges, give up, reverses)
                  if (move.type === 'challenge_initiated' || move.type.includes('game_end') || move.type === 'reverse_success') {
                    return (
                      <div key={originalIndex} className="border-b border-gray-200 pb-1 last:border-b-0">
                        <div className="mb-1">
                          <span className="font-mono text-xs text-gray-400 mr-2">{String(turnNumber).padStart(2, '0')}</span>
                          <span className="font-medium text-gray-800">{playerNickname}</span>
                        </div>
                        <div className="pl-6">
                          <span className={`${
                            move.type === 'challenge_initiated' ? 'text-yellow-600' : 
                            move.type === 'reverse_success' ? 'text-purple-600' : 
                            'text-gray-600'
                          }`}>
                            {move.type === 'challenge_initiated' ? 'Challenged' : 
                             move.type === 'reverse_success' ? 'Reversed' : 
                             move.type === 'game_end_give_up' ? 'Gave up' : 
                             move.type === 'game_end_incorrect' ? '' : 
                             move.type === 'game_end_challenge' ? '' : 
                             'Ended game'}
                          </span>
                          
                          {/* Display incorrect answer if available */}
                          {move.type === 'game_end_incorrect' && move.incorrectAnswer && (
                            <span className="ml-2 text-red-500">
                              {move.incorrectAnswer}
                            </span>
                          )}
                          
                          
                          
                          {/* Display challenge response */}
                          {move.type === 'game_end_challenge' && move.incorrectAnswer && (
                            <span className="ml-2 text-red-500">
                              {move.incorrectAnswer}
                            </span>
                          )}
                          {/* Display challenge response */}
                          {move.type === 'game_end_challenge' && !move.incorrectAnswer && (
                            <span className="ml-2 text-500">
                              {move.responseValue}
                            </span>
                          )}
                          
                          {/* Display successful challenge response */}
                          {move.type === 'challenge_resolved' && move.responseValue && (
                            <span className="ml-2 text-green-600">
                              {move.responseValue}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  }
                  
                  // Incorrect answer (shown in red)
                  if (move.type === 'incorrect') {
                    let displayValue = move.value;
                    if (move.valueType === 'player') {
                      const player = getPlayer(move.value);
                      displayValue = player ? player.name : move.value;
                    } else if (move.valueType === 'team') {
                      displayValue = formatTeamName(move.value);
                    } else if (move.valueType === 'number') {
                      displayValue = `#${move.value}`;
                    }
                    
                    return (
                      <div key={originalIndex} className="border-b border-gray-200 pb-1 last:border-b-0">
                        <div className="mb-1">
                          <span className="font-mono text-xs text-gray-400 mr-2">{String(turnNumber).padStart(2, '0')}</span>
                          <span className="font-medium text-gray-800">{playerNickname}</span>
                        </div>
                        <div className="pl-6">
                          <span className="text-red-500">{displayValue}</span>
                        </div>
                      </div>
                    );
                  }
                  
                  // Regular moves (player, number, team, college)
                  let displayValue = move.value;
                  let extraInfo = null;
                  
                  if (move.type === 'player') {
                    const player = getPlayer(move.value);
                    displayValue = player ? player.name : `ID: ${move.value}`;
                    
                    if (player && player.league) {
                      extraInfo = (
                        <span className="text-xs text-gray-500 ml-1">
                          {player.league} ({player.start_year}-{player.end_year})
                        </span>
                      );
                    }
                  } else if (move.type === 'number') {
                    displayValue = `#${move.value}`;
                  } else if (move.type === 'team') {
                    displayValue = formatTeamName(move.value);
                  }
                  
                  return (
                    <div key={originalIndex} className="border-b border-gray-200 pb-1 last:border-b-0">
                      <div className="mb-1">
                        <span className="font-mono text-xs text-gray-400 mr-2">{String(turnNumber).padStart(2, '0')}</span>
                        <span className="font-medium text-gray-800">{playerNickname}</span>
                      </div>
                      <div className="pl-6">
                        <span className="text-gray-900">{displayValue}</span>
                        {extraInfo}
                      </div>
                    </div>
                  );
                })
            ) : (
              <div className="text-gray-500 text-center">No history recorded.</div>
            )}
          </div>
        </div>
        
        {/* Action buttons */}
        <div className="flex justify-center gap-4 mt-8">
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Back to Home
          </button>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default GameOver; 