// Helper functions for game logic
import { serverTimestamp, doc, updateDoc, getDoc, increment, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

/**
 * Calculates the new ELO rating based on the opponent's rating and the game result
 * @param {number} playerRating - The player's current ELO rating 
 * @param {number} opponentRating - The opponent's current ELO rating
 * @param {number} playerWon - 1 if the player won, 0 if they lost
 * @param {number} kFactor - The K-factor to use (default: 40)
 * @returns {number} The new ELO rating
 */
const calculateNewEloRating = (playerRating, opponentRating, playerWon, kFactor = 40) => {
  // Calculate expected probability of winning
  const expectedProbability = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
  
  // Calculate new rating
  return Math.round(playerRating + kFactor * (playerWon - expectedProbability));
};

// Function to calculate Elo rating change
export const calculateEloRating = (oldRating, opponentRating, result, gamesPlayed) => {
  // K-factor: 40 for first 30 games, then 20
  const kFactor = gamesPlayed < 30 ? 40 : 20;
  
  // Expected score based on Elo formula
  const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - oldRating) / 400));
  
  // New rating calculation
  const newRating = Math.round(oldRating + kFactor * (result - expectedScore));
  
  return newRating;
};

// Function to check if an answer is valid (not used before)
export const isValidAnswer = (answer, usedAnswers) => {
  return !usedAnswers.includes(answer);
};

// Function to create a new game
export const createNewGame = (playerA, playerB) => {
  const gameId = `game_${Math.random().toString(36).substring(2, 8)}`;
  
  // Need to select two random starting players
  // This logic should ideally live elsewhere or be passed in
  // For now, placeholders - replace with actual player IDs later
  const startPlayerAId = "temp_start_a"; 
  const startPlayerBId = "temp_start_b";

  return {
    gameId,
    players: {
      A: playerA, // User nickname
      B: playerB  // User nickname
    },
    // Initial setup: Player A needs to name a player related to Player B's start attribute (e.g. team)
    // Or a simpler start: Player A names *any* player first. Let's use the simpler start.
    turn: "A", 
    nextInputType: "player", // Player A starts by naming a player
    lastPlayerId: null,      // No previous player yet
    lastAttribute: { type: null, value: null }, // No previous attribute link yet
    usedPlayerIds: [], // Tracks used player IDs to prevent repeats
    status: "open",
    lastSubmittedAttributeMove: { type: null, value: null }, // Track last *successful* attribute submission
    // --- Challenge State ---
    challengeStatus: 'none', // 'none', 'pending', 'resolving'
    challengeType: 'none',   // 'none', 'player', 'attribute' - What kind of submission is being challenged
    challengedPlayer: null,  // 'A' or 'B' - who needs to answer the challenge
    challengeAttributeOptions: [], // Only used if challengeType is 'player'
    // --- End Challenge State ---
    history: [] // Stores { player: 'A'/'B', type: 'player'/'number'/'team'/'college', value: 'player_id' or 'attribute_value' }
  };
};

// Function to submit an answer
// answer: submitted value (playerId if type is 'player', attribute value otherwise)
// submittedAttributeType: 'number', 'team', 'college' (only when nextInputType is 'attribute')
export const submitAnswer = (game, currentPlayerId, answer, submittedAttributeType, players, popularityData, timestamp = new Date().toISOString()) => {
  
  // 1. --- Validation ---
  if (game.turn !== currentPlayerId) {
    return { success: false, error: "Not your turn" };
  }

  let isValid = false;
  let submittedPlayer = null; // The player object related to this turn's submission
  let submissionType = '';
  let submissionValue = answer;
  let errorMsg = '';

  if (game.nextInputType === 'player') {
    submissionType = 'player';
    const submittedPlayerId = answer;

    if (game.usedPlayerIds.includes(submittedPlayerId)) {
      return { success: false, error: "This player has already been used in this game" };
    }

    submittedPlayer = players.find(p => p.id === submittedPlayerId);
    if (!submittedPlayer) {
      return { success: false, error: "Invalid player selected" };
    }

    // Check linking attribute
    if (game.lastSubmittedAttributeMove?.type) { // Use lastSubmittedAttributeMove for link
      const requiredAttrType = game.lastSubmittedAttributeMove.type;
      const requiredAttrValue = String(game.lastSubmittedAttributeMove.value ?? '').toLowerCase();
      
      // NEW: Check if requiredValue is IN the player's array for that attribute type
      const playerAttributeArray = submittedPlayer[requiredAttrType + 's']; // e.g., player.numbers, player.teams, player.colleges
      
      if (!playerAttributeArray || !Array.isArray(playerAttributeArray)) {
           console.error(`Player ${submittedPlayer.id} missing or has invalid attribute array for type: ${requiredAttrType}s`);
           return { success: false, error: `Internal data error for ${submittedPlayer.name}.` };
      }
      
      // Check if any value in the player's array matches the required value (case-insensitive)
      const matchFound = playerAttributeArray.some(val => String(val ?? '').toLowerCase() === requiredAttrValue);

      if (!matchFound) {
         errorMsg = `${submittedPlayer.name} does not match ${getAttributeLabel(requiredAttrType)}: ${game.lastSubmittedAttributeMove.value}`;
      } else {
         isValid = true; // Valid if link matches
      }
    } else if (game.history.length === 0) {
      // First move of the game, any player is valid
      isValid = true;
    } else {
      // Error: Expecting player but no prior attribute link exists after first move
      console.error("submitAnswer error: Expecting player, but lastSubmittedAttributeMove is missing after first move.");
      return { success: false, error: "Internal game state error: Missing attribute link." };
    }

  } else if (game.nextInputType === 'attribute') {
     if (!['number', 'team', 'college'].includes(submittedAttributeType)) {
       return { success: false, error: "Invalid attribute type selected" };
     }
     // Remove back-to-back attribute type check
     
     // Back-to-back attribute value check
     if (game.lastSubmittedAttributeMove && 
         game.lastSubmittedAttributeMove.type === submittedAttributeType && 
         String(game.lastSubmittedAttributeMove.value ?? '').toLowerCase() === String(answer ?? '').toLowerCase()) {
       return { success: false, error: `Attribute cannot be submitted again immediately.` };
     }

     submissionType = submittedAttributeType;
     const attributeValue = String(answer ?? '').trim();
     if (!attributeValue) {
        return { success: false, error: `Missing value for attribute: ${getAttributeLabel(submissionType)}` };
     }
     
     const lastPlayer = players.find(p => p.id === game.lastPlayerId);
     if (!lastPlayer) {
       return { success: false, error: "Internal error: Last player data not found" };
     }

     // NEW: Check if submitted attribute value is IN the lastPlayer's array
     const playerAttributeArray = lastPlayer[submissionType + 's']; // e.g., lastPlayer.numbers, lastPlayer.teams
     const submittedFormattedValue = attributeValue.toLowerCase();

     if (!playerAttributeArray || !Array.isArray(playerAttributeArray)) {
        console.error(`Last player ${lastPlayer.id} missing or has invalid attribute array for type: ${submissionType}s`);
        return { success: false, error: `Internal data error checking ${lastPlayer.name}.` };
     }

     const valueExists = playerAttributeArray.some(val => String(val ?? '').toLowerCase() === submittedFormattedValue);
     
     if (!valueExists) {
       errorMsg = `${getAttributeLabel(submissionType)} '${answer}' is incorrect for ${lastPlayer.name}.`;
     } else {
       isValid = true; // Valid if attribute exists for the player
     }

  } else {
     return { success: false, error: "Invalid game state: Unknown next input type" };
  }

  // STRICT MODE: If move is invalid due to logic check (not internal error), end the game immediately.
  if (!isValid && errorMsg) {
      // Game Over for current player
      const winner = currentPlayerId === "A" ? "B" : "A"; // Opponent wins
      
      // We don't update users here directly in this function (like endGame helper), 
      // but we construct the game state to reflect the loss.
      // The caller (likely context or component) might handle user updates via endGame helper, 
      // or we can return a signal.
      // For simplicity and consistency with existing submitAnswer, let's return a success=false but with game ending info? 
      // Actually, existing structure expects success=false to mean "try again". 
      // BUT strict mode means "you lose". So we should return success=true (state updated to finished).
      
      const finalHistoryEntry = {
        player: currentPlayerId,
        type: 'game_end_incorrect',
        value: `${game.players[currentPlayerId]} lost (Incorrect: ${errorMsg})`,
        timestamp: new Date().toISOString()
      };

      const updatedGame = {
        ...game,
        status: "finished",
        winner: winner,
        history: [...game.history, finalHistoryEntry],
        updatedAt: serverTimestamp()
      };

      // We also need to trigger stat updates. The most robust way is to let the UI/Context detect 'finished' 
      // and call the update stats logic, OR do it here if we have users.
      // Since we don't have users array here easily without passing it in, 
      // let's rely on the 'updatedGame' state. The calculateSubmitAnswerUpdate handles this better.
      
      // Wait, this function is used by local game logic primarily? 
      // The `calculateSubmitAnswerUpdate` below is the one used by OnlineGameBoard.
      // I'll update both for consistency.
      
      return { 
        success: true, // It's a valid "transaction", leading to game end
        game: updatedGame,
        obscurityScore: 0
      };
  }

  if (!isValid) {
      return { success: false, error: "Invalid move." }; // Should be caught above
  }

  // 2. --- Update Game State ---
  const newHistoryEntry = {
    player: currentPlayerId,
    type: submissionType,
    value: submissionValue, 
    timestamp
  };

  const updatedGame = {
    ...game,
    turn: game.turn === "A" ? "B" : "A", 
    history: [...game.history, newHistoryEntry],
    nextInputType: submissionType === 'player' ? 'attribute' : 'player',
    lastPlayerId: submissionType === 'player' ? submissionValue : game.lastPlayerId, // Update only if player submitted
    lastAttribute: submissionType !== 'player' ? { type: submissionType, value: submissionValue } : game.lastAttribute, // Update only if attribute submitted
    lastSubmittedAttributeMove: submissionType !== 'player' 
                                  ? { type: submissionType, value: submissionValue } 
                                  : game.lastSubmittedAttributeMove, 
    usedPlayerIds: submissionType === 'player' ? [...game.usedPlayerIds, submissionValue] : game.usedPlayerIds, 
    status: "open" 
  };
  
  return { 
    success: true, 
    game: updatedGame,
    obscurityScore: 0 
  };
};

// --- Challenge Logic ---

export const initiateChallenge = (game, challengingPlayerId, players) => {
  // challengingPlayerId is the one whose turn it currently IS (e.g., B)
  // They are challenging the last move made by the opponent (e.g., A)
  
  // Validation checks
  if (game.status !== 'open') {
     return { success: false, error: "Game is not active."};
  }
  // Challenging player must be the current turn player
  if (game.turn !== challengingPlayerId) {
     return { success: false, error: "Cannot challenge when it's not your turn."};
  }
  if (game.history.length === 0) {
     return { success: false, error: "No moves have been made yet to challenge." };
  }
  if (game.challengeStatus !== 'none') {
     return { success: false, error: "A challenge is already in progress." };
  }

  // Identify the player who made the move being challenged (the opponent)
  const challengedPlayerId = challengingPlayerId === 'A' ? 'B' : 'A';
  const lastMove = game.history[game.history.length - 1];
  const challengedPlayerNickname = game.players[challengedPlayerId];

  // Ensure the last move was actually by the opponent (should always be true if turns alternate)
  if (lastMove.player !== challengedPlayerId) {
     console.error("Challenge logic error: Last move wasn't by the opponent.");
     return { success: false, error: "Cannot challenge the last move." };
  }

  const typeOfMoveToChallenge = lastMove.type;
  const valueOfMoveToChallenge = lastMove.value;
  let challengeType = 'none';

  if (typeOfMoveToChallenge === 'player') {
     challengeType = 'player';
     const challengedPlayerObject = players.find(p => p.id === valueOfMoveToChallenge);
     if (!challengedPlayerObject) {
        return { success: false, error: "Internal Error: Challenged player data not found." };
     }
     // Check if player *has* any attributes to name - Use ARRAY properties now
     const hasNumber = challengedPlayerObject.numbers && challengedPlayerObject.numbers.length > 0;
     const hasTeam = challengedPlayerObject.teams && challengedPlayerObject.teams.length > 0;
     const hasCollege = challengedPlayerObject.colleges && 
                        challengedPlayerObject.colleges.some(c => c && String(c).trim() && String(c).toLowerCase() !== 'none' && String(c).toLowerCase() !== '-');
                        
     if (!hasNumber && !hasTeam && !hasCollege) {
       // Updated error message for clarity
       return { success: false, error: `Player ${challengedPlayerObject.name} has no verifiable attributes (Number, Team, or College) in the data.` };
     }

  } else if (['number', 'team', 'college'].includes(typeOfMoveToChallenge)) {
     challengeType = 'attribute';
     // Validation for attribute challenge (check if ANY player has the attribute)
     // Needs to check the appropriate array on *all* players
     const attributeArrayKey = typeOfMoveToChallenge + 's'; // numbers, teams, colleges
     const valueLower = String(valueOfMoveToChallenge ?? '').toLowerCase();
     const playerExists = players.some(p => 
        p[attributeArrayKey]?.some(val => String(val ?? '').toLowerCase() === valueLower)
     );
     if (!playerExists) {
        return { success: false, error: `No player found in data with ${getAttributeLabel(typeOfMoveToChallenge)}: ${valueOfMoveToChallenge}. Cannot challenge.` };
     }

  } else {
     return { success: false, error: "Cannot challenge this type of move." };
  }

  // Create history entry for the challenge initiation
  const challengeHistoryEntry = {
     player: challengingPlayerId,
     type: 'challenge_initiated',
     value: `challenged ${challengedPlayerNickname}'s last move (${getAttributeLabel(typeOfMoveToChallenge)}: ${valueOfMoveToChallenge})`,
     timestamp: new Date().toISOString()
  };

  // Update game state for challenge
  const updatedGame = {
     ...game,
     history: [...game.history, challengeHistoryEntry], // Add challenge entry
     challengeStatus: 'pending',
     challengeType: challengeType,
     challengedPlayer: challengedPlayerId, 
     turn: challengedPlayerId, 
     challengeAttributeOptions: [], // Not needed with input box approach
     challengeDetails: { // Store details of the move being challenged
       moveIndex: game.history.length - 1, // Index of the move being challenged
       moveType: typeOfMoveToChallenge, 
       moveValue: valueOfMoveToChallenge,
       originalTurn: challengingPlayerId // Who was supposed to play next before challenge
     } 
  };

  return { success: true, game: updatedGame };
};

// resolveChallenge
export const resolveChallenge = (game, respondingPlayerId, responseValue, players, users) => {
   // respondingPlayerId is the one who made the move that was challenged
   // responseValue is their attempt to validate it (attribute string or player ID string)

   // --- Validation ---
   if (game.status !== 'open') {
      return { success: false, error: "No active challenge to resolve." };
   }
   // The current turn player must be the challenged player to respond
   if (game.turn !== respondingPlayerId) { 
      return { success: false, error: "Not your turn to respond to the challenge." };
   }
   if (!game.challengeDetails) {
      return { success: false, error: "Internal Error: Missing challenge details."};
   }
   
   const challengerId = game.challengeDetails.originalTurn; // The player who initiated the challenge
   let challengePassed = false; // Did the responder successfully validate their move?
   let winnerId = null;
   let loserId = null;
   let endReason = ''; // Reason for game end in history

   if (game.challengeType === 'player') {
      // Player submission was challenged. Responder had to name an attribute.
      const challengedPlayerObject = players.find(p => p.id === game.challengeDetails.moveValue);
      if (!challengedPlayerObject) return { success: false, error: "Internal Error: Challenged player data missing." };
      
      const submittedAttributeValue = String(responseValue ?? '').trim().toLowerCase();
      let correctAttributeType = null;

      // NEW: Check against arrays
      if (submittedAttributeValue && challengedPlayerObject.numbers?.some(n => String(n ?? '').toLowerCase() === submittedAttributeValue)) {
         correctAttributeType = 'number';
      } else if (submittedAttributeValue && challengedPlayerObject.teams?.some(t => String(t ?? '').toLowerCase() === submittedAttributeValue)) {
         correctAttributeType = 'team';
      } else if (submittedAttributeValue && challengedPlayerObject.colleges?.some(c => c && String(c ?? '').toLowerCase() === submittedAttributeValue)) {
         correctAttributeType = 'college';
      }
      
      if (correctAttributeType) {
         // Correct! Responder validated their move. Challenger LOSES. Responder WINS.
         challengePassed = true;
         winnerId = respondingPlayerId;
         loserId = challengerId;
         endReason = `${respondingPlayerId} won challenge (validated ${correctAttributeType}: ${responseValue}).`;
      } else {
         // Incorrect! Responder failed. Challenger WINS. Responder LOSES.
         challengePassed = false;
         winnerId = challengerId;
         loserId = respondingPlayerId;
         endReason = `${challengerId} won challenge (opponent failed to validate player ${challengedPlayerObject.name}).`;
      }

   } else if (game.challengeType === 'attribute') {
      // Attribute submission was challenged. Responder had to name a player.
      const chosenPlayerId = responseValue; // This should be a player ID
      const chosenPlayer = players.find(p => p.id === chosenPlayerId);
      const challengedAttributeType = game.challengeDetails.moveType;
      const challengedAttributeValue = String(game.challengeDetails.moveValue ?? '').toLowerCase();

      if (!chosenPlayer) {
         challengePassed = false;
      } else if (game.usedPlayerIds.includes(chosenPlayerId)) {
         challengePassed = false; 
      } else {
          // NEW: Check if challengedAttributeValue is IN the chosenPlayer's array
          const playerAttributeArray = chosenPlayer[challengedAttributeType + 's'];
          if (!playerAttributeArray || !Array.isArray(playerAttributeArray)) {
              challengePassed = false;
          } else {
              const matchFound = playerAttributeArray.some(val => String(val ?? '').toLowerCase() === challengedAttributeValue);
              if (matchFound) {
                 challengePassed = true;
                 winnerId = respondingPlayerId;
                 loserId = challengerId;
                 endReason = `${respondingPlayerId} won challenge (validated with player ${chosenPlayer.name}).`;
              } else {
                 challengePassed = false;
              }
          }
      }
      
      if (!challengePassed && !winnerId) { // Set winner/loser if failure was due to player/attribute mismatch
         winnerId = challengerId; 
         loserId = respondingPlayerId;
         endReason = `${challengerId} won challenge (opponent failed to validate attribute ${challengedAttributeType}: ${challengedAttributeValue}).`;
      }

   } else {
       return { success: false, error: "Invalid challenge type in game state." };
   }

   // --- End the Game --- 
   const endResult = endGame(game, winnerId, users, endReason); // Always end the game
   if (!endResult.success) {
      console.error("Failed to end game after challenge resolution:", endResult.error);
      // Still try to return the game state, but indicate the user update failed
      return { 
         success: false, 
         error: `Challenge resolved, but failed to update user stats: ${endResult.error}`,
         // Return a partially updated game state to reflect the end, even if user stats failed
         game: {
           ...game, // Start with original game state
           status: 'closed', // Mark as closed
           winner: winnerId, // Set winner
           challengeStatus: 'none', // Clear challenge state
           challengeType: 'none',
           challengedPlayer: null,
           challengeDetails: null,
           history: [...game.history, { player: winnerId, type: 'game_end_challenge', value: endReason, timestamp: new Date().toISOString() }]
         },
         users: users // Return original users if update failed
      };
   }
   
   // Successfully ended the game
   const updatedGameData = { 
     ...endResult.game, 
     challengeStatus: 'none', 
     challengeType: 'none',
     challengedPlayer: null, 
     challengeDetails: null, 
     history: [...game.history, { player: winnerId, type: 'game_end_challenge', value: endReason, timestamp: new Date().toISOString() }]
   };

   return { 
     success: true, 
     game: updatedGameData, 
     users: endResult.users // Return updated users from endGame
   };
};

// --- End Challenge Logic ---

// Function to end a game
export const endGame = (game, winningPlayer, users, reason = 'unknown') => {
  if (game.status !== "open") {
    return { success: false, error: "Game is not open" };
  }
  
  const losingPlayer = winningPlayer === "A" ? "B" : "A";
  const winnerNickname = game.players[winningPlayer];
  const loserNickname = game.players[losingPlayer];
  
  // Get user objects
  const winner = users.find(user => user.nickname === winnerNickname);
  const loser = users.find(user => user.nickname === loserNickname);
  
  if (!winner || !loser) {
    // If users aren't found (e.g., playing locally without full user objects), skip Elo update but still end game
    console.warn("User objects not found for Elo update, ending game without stat changes.");
    const finalHistoryEntry = {
       player: winningPlayer, // Attributed to winner
       type: `game_end_${reason}`,
       value: `${winnerNickname} won (${reason})`,
       timestamp: new Date().toISOString()
    };
    const updatedGame = {
      ...game,
      status: "closed",
      winner: winningPlayer,
      history: [...game.history, finalHistoryEntry] // Add final reason
    };
    return { success: true, game: updatedGame, users: users }; // Return original users
  }
  
  // Calculate new Elo ratings
  const winnerNewRating = calculateEloRating(winner.rating, loser.rating, 1, winner.gamesPlayed);
  const loserNewRating = calculateEloRating(loser.rating, winner.rating, 0, loser.gamesPlayed);
  
  // Update user objects
  const updatedWinner = {
    ...winner,
    rating: winnerNewRating,
    gamesPlayed: winner.gamesPlayed + 1,
    lastActive: new Date().toISOString()
  };
  
  const updatedLoser = {
    ...loser,
    rating: loserNewRating,
    gamesPlayed: loser.gamesPlayed + 1,
    lastActive: new Date().toISOString()
  };
  
  // Define the final history entry based on the reason
  const finalHistoryEntry = {
     player: winningPlayer, // Event attributed to the winner
     type: `game_end_${reason}`,
     value: `${winnerNickname} won (${reason})`,
     timestamp: new Date().toISOString()
  };
  
  // Update game status
  const updatedGame = {
    ...game,
    status: "closed",
    winner: winningPlayer,
    history: [...game.history, finalHistoryEntry] // Add final reason to history
  };
  
  // Update users array
  const updatedUsers = users.map(user => {
    if (user.userId === winner.userId) return updatedWinner;
    if (user.userId === loser.userId) return updatedLoser;
    return user;
  });
  
  return {
    success: true,
    game: updatedGame,
    users: updatedUsers
  };
};

// Helper to get display names for attributes
const getAttributeLabel = (attribute) => {
  switch (attribute) {
    case 'player': return 'Player Name';
    case 'number': return 'Jersey Number';
    case 'team': return 'Team';
    case 'college': return 'College';
    default: return attribute || 'N/A';
  }
};

// Validates if a potential move is correct according to game rules,
// but does NOT modify the game state. Used for the Reverse feature.
export const validateMoveForReversal = (currentGameData, currentPlayerRole, players, submittedValue, submittedAttribute) => {
  const { 
      turn,
      nextInputType, 
      lastPlayerId, 
      lastAttribute, 
      usedPlayerIds, 
      lastSubmittedAttributeMove,
      status
  } = currentGameData;

  // --- Basic Checks ---
  if (status !== 'playing') {
    return { isValid: false, error: "Game is not active." };
  }
  if (turn !== currentPlayerRole) {
    return { success: false, error: "Not your turn" };
  }
  if (currentGameData.challengeStatus !== 'none') {
    return { isValid: false, error: "Cannot validate move during a challenge." };
  }

  // --- Player Input Validation ---
  if (nextInputType === 'player') {
    if (submittedAttribute) {
      return { isValid: false, error: "Expected player input, but got attribute." };
    }
    const submittedPlayerId = submittedValue;
    const player = players.find(p => p.id === submittedPlayerId);
    if (!player) {
      return { isValid: false, error: "Invalid player selected." };
    }
    if (usedPlayerIds.includes(submittedPlayerId)) {
      return { isValid: false, error: `Player ${player.name} already used.` };
    }
    
    // Check linking attribute
    if (lastSubmittedAttributeMove) {
       const requiredAttrType = lastSubmittedAttributeMove.type;
       const requiredAttrValue = String(lastSubmittedAttributeMove.value ?? '').toLowerCase();
       const playerAttributeArray = player[requiredAttrType + 's'];
       if (!playerAttributeArray || !Array.isArray(playerAttributeArray)) {
            return { isValid: false, error: `Internal data error for ${player.name}.` };
       }
       const matchFound = playerAttributeArray.some(val => String(val ?? '').toLowerCase() === requiredAttrValue);
       if (!matchFound) {
          return { isValid: false, error: `${player.name} does not match ${getAttributeLabel(requiredAttrType)}: ${lastSubmittedAttributeMove.value}` };
       }
    } else if (currentGameData.history.length > 0) {
         console.warn("Validation check: lastSubmittedAttributeMove is missing when expecting player.");
         return { isValid: false, error: "Internal error: Missing previous attribute link." };
    }
    
    // Player move seems valid for reversal
    return { isValid: true };

  // --- Attribute Input Validation ---
  } else if (nextInputType === 'attribute') {
    if (!submittedAttribute) {
      return { isValid: false, error: "Expected attribute input, but got player." };
    }
    const submittedAttrType = submittedAttribute;
    const submittedAttrValue = String(submittedValue ?? '').trim();
    
    if (!['number', 'team', 'college'].includes(submittedAttrType)) {
        return { isValid: false, error: "Invalid attribute type specified." };
    }
    if (!submittedAttrValue) {
        return { isValid: false, error: `Missing value for attribute: ${getAttributeLabel(submittedAttrType)}` };
    }
    
    // Check against the last player submitted
    const lastPlayer = players.find(p => p.id === lastPlayerId);
    if (!lastPlayer) {
       console.error("Validation Error: Last player data not found for attribute check.");
       return { isValid: false, error: "Internal error: Cannot find previous player data." };
    }
    
    const playerAttributeArray = lastPlayer[submittedAttrType + 's'];
    const submittedFormattedValue = submittedAttrValue.toLowerCase();

    if (!playerAttributeArray || !Array.isArray(playerAttributeArray)) {
        console.error(`Last player ${lastPlayer.id} missing or has invalid attribute array for type: ${submittedAttrType}s`);
        return { isValid: false, error: `Internal data error checking ${lastPlayer.name}.` };
    }

    const valueExists = playerAttributeArray.some(val => String(val ?? '').toLowerCase() === submittedFormattedValue);
    
    if (!valueExists) {
       return { 
          isValid: false, 
          error: `${getAttributeLabel(submittedAttrType)} '${submittedValue}' is incorrect for ${lastPlayer.name}.` 
       };
    }
    
    // Check if this specific attribute value has been submitted back-to-back
    if (lastAttribute && lastAttribute.type === submittedAttrType && String(lastAttribute.value ?? '').toLowerCase() === submittedFormattedValue) {
       return { 
          isValid: false, 
          error: `Attribute ${getAttributeLabel(submittedAttrType)}: ${submittedValue} was just used. Cannot use back-to-back.` 
       };
    }

    // Attribute move seems valid for reversal
    return { isValid: true };

  } else {
    return { isValid: false, error: "Invalid next input type in game state." };
  }
}; 

// --- Firestore Update Calculation Functions --- 

/**
 * Checks if the game should end based on the number of turns played.
 * @param {Array} history - Game history array to count turns
 * @param {number} turnLimit - Optional limit (defaults to 30)
 * @returns {boolean} - true if the turn limit is reached
 */
const isTurnLimitReached = (history, turnLimit = 30) => {
  if (!history || !Array.isArray(history)) {
    return false;
  }
  
  // Count only player and attribute submissions (not challenges, etc.)
  const turnMoves = history.filter(
    move => move.type === 'player' || move.type === 'number' || 
    move.type === 'team' || move.type === 'college'
  );
  
  return turnMoves.length >= turnLimit;
};

/**
 * Tracks submissions and answers in the Firestore tracking collection
 * @param {string} playerId - The ID of the player to track
 * @param {string} attributeValue - The attribute value to track (player name, team, number, college)
 */
export const trackSubmission = async (playerId, attributeValue) => {
  if (!playerId || !attributeValue) return;
  
  try {
    const trackingRef = doc(db, "tracking", playerId);
    
    // Try to get existing document
    const trackingDoc = await getDoc(trackingRef);
    
    if (trackingDoc.exists()) {
      // Document exists, update the tracking map
      const trackingData = trackingDoc.data();
      const trackingMap = trackingData.tracking || {};
      
      // Update the count for this attribute
      await updateDoc(trackingRef, {
        [`tracking.${attributeValue}`]: increment(1)
      });
    } else {
      // Document doesn't exist, create a new one
      await setDoc(trackingRef, {
        tracking: {
          [attributeValue]: 1
        }
      });
    }
    
  } catch (error) {
    console.error("Error tracking submission:", error);
    // Don't throw error, just log it - tracking shouldn't block game flow
  }
};

/**
 * Calculates the Firestore update object for a valid submitted answer.
 * Performs validation similar to submitAnswer but returns only the changed fields.
 * 
 * @param {object} currentGameData - The current game state object from Firestore.
 * @param {string} currentPlayerRole - 'A' or 'B', the role of the player submitting.
 * @param {string} answer - The submitted value (playerId or attribute value).
 * @param {string|null} submittedAttributeType - 'number', 'team', 'college', or null if answer is a player ID.
 * @param {Array} players - The full list of player objects (from players_new.json).
 * @returns {{success: boolean, error?: string, update?: object}} - Result object.
 */
export const calculateSubmitAnswerUpdate = (currentGameData, currentPlayerRole, answer, submittedAttributeType, players) => {
  // Destructure needed fields from current game data
  const { 
    turn,
    nextInputType,
    lastPlayerId,
    lastAttribute,
    usedPlayerIds,
    lastSubmittedAttributeMove,
    history,
    status
  } = currentGameData;

  // 1. --- Validation --- 
  if (status !== 'playing') {
    return { success: false, error: "Game is not active." };
  }
  if (turn !== currentPlayerRole) {
    return { success: false, error: "Not your turn" };
  }

  let isValid = false;
  let submittedPlayer = null; // The player object related to this turn's submission
  let submissionType = '';
  let submissionValue = answer;
  let errorMsg = '';

  if (nextInputType === 'player') {
    submissionType = 'player';
    const submittedPlayerId = answer;

    if (usedPlayerIds.includes(submittedPlayerId)) {
      return { success: false, error: "This player has already been used in this game" };
    }

    submittedPlayer = players.find(p => p.id === submittedPlayerId);
    if (!submittedPlayer) {
      return { success: false, error: "Invalid player selected" };
    }

    // Check linking attribute
    if (lastSubmittedAttributeMove?.type) { 
      const requiredAttrType = lastSubmittedAttributeMove.type;
      const requiredAttrValue = String(lastSubmittedAttributeMove.value ?? '').toLowerCase();
      const playerAttributeArray = submittedPlayer[requiredAttrType + 's']; 
      
      if (!playerAttributeArray || !Array.isArray(playerAttributeArray)) {
           console.error(`Player ${submittedPlayer.id} missing or has invalid attribute array for type: ${requiredAttrType}s`);
           return { success: false, error: `Internal data error for ${submittedPlayer.name}.` };
      }
      
      const matchFound = playerAttributeArray.some(val => String(val ?? '').toLowerCase() === requiredAttrValue);

      if (!matchFound) {
         errorMsg = `${submittedPlayer.name} does not match ${getAttributeLabel(requiredAttrType)}: ${lastSubmittedAttributeMove.value}`;
      } else {
         isValid = true; // Valid if link matches
      }
    } else if (history.length === 0) {
      // First move of the game, any player is valid
      isValid = true;
    } else {
      console.error("calculateSubmitAnswerUpdate error: Expecting player, but lastSubmittedAttributeMove is missing after first move.");
      return { success: false, error: "Internal game state error: Missing attribute link." };
    }

  } else if (nextInputType === 'attribute') {
     if (!['number', 'team', 'college'].includes(submittedAttributeType)) {
       return { success: false, error: "Invalid attribute type selected" };
     }
     // Remove back-to-back attribute type check
     
     // Back-to-back attribute value check
     if (lastSubmittedAttributeMove && 
         lastSubmittedAttributeMove.type === submittedAttributeType && 
         String(lastSubmittedAttributeMove.value ?? '').toLowerCase() === String(answer ?? '').toLowerCase()) {
       return { success: false, error: `Attribute cannot be submitted again immediately.` };
     }

     submissionType = submittedAttributeType;
     const attributeValue = String(answer ?? '').trim();
     if (!attributeValue) {
        return { success: false, error: `Missing value for attribute: ${getAttributeLabel(submissionType)}` };
     }
     
     const lastPlayer = players.find(p => p.id === lastPlayerId);
     if (!lastPlayer) {
       return { success: false, error: "Internal error: Last player data not found" };
     }

     const playerAttributeArray = lastPlayer[submissionType + 's']; 
     const submittedFormattedValue = attributeValue.toLowerCase();

     if (!playerAttributeArray || !Array.isArray(playerAttributeArray)) {
        console.error(`Last player ${lastPlayer.id} missing or has invalid attribute array for type: ${submissionType}s`);
        return { success: false, error: `Internal data error checking ${lastPlayer.name}.` };
     }

     const valueExists = playerAttributeArray.some(val => String(val ?? '').toLowerCase() === submittedFormattedValue);
     
     if (!valueExists) {
       errorMsg = `${getAttributeLabel(submissionType)} '${answer}' is incorrect for ${lastPlayer.name}.`;
     } else {
       isValid = true; // Valid if attribute exists for the player
     }

  } else {
     return { success: false, error: "Invalid game state: Unknown next input type" };
  }

  // STRICT MODE: Return game end update instead of error
  if (!isValid && errorMsg) {
      const winner = currentPlayerRole === "A" ? "B" : "A"; 
      
      const updateObject = {
        status: 'finished',
        winner: winner,
        history: [...history, {
          player: currentPlayerRole,
          type: 'game_end_incorrect',
          value: `${currentGameData.players[currentPlayerRole].name} lost (Incorrect: ${errorMsg})`,
          timestamp: new Date().toISOString()
        }],
        updatedAt: serverTimestamp()
      };
      
      // Calculate and update player stats in background
      try {
        updatePlayerStats(currentGameData.players[winner].id, currentGameData.players[currentPlayerRole].id);
      } catch (error) {
        console.error("Failed to update player stats on incorrect answer:", error);
      }

      return { success: true, update: updateObject };
  }

  if (!isValid) {
      // This path shouldn't be reached if logic above is correct, but as a safeguard:
      return { success: false, error: "Invalid move (internal check failed)." }; 
  }

  // 2. --- Calculate Update Object --- 
  const historyEntry = {
    player: currentPlayerRole,
    type: submissionType,
    value: submissionValue,
    timestamp: new Date().toISOString()
  };
  
  // Update object with changes to be applied
  const updateObject = {
    history: [...history, historyEntry],
    updatedAt: serverTimestamp()
  };
  // Check if this move ends the game due to turn limit
  const updatedHistory = [...history, historyEntry];
  const gameEnded = isTurnLimitReached(updatedHistory);
  const winner = gameEnded ? (currentPlayerRole === 'A' ? 'B' : 'A') : null;
  
  if (gameEnded) {
    // Game has ended by reaching turn limit
    updateObject.status = 'finished';
    updateObject.winner = winner;
    updateObject.nextInputType = nextInputType;
    
    // Add ending reason to history
    updateObject.history.push({
      player: currentPlayerRole,
      type: 'game_end_turn_limit',
      value: 'Game ended due to maximum turns reached',
      timestamp: new Date().toISOString()
    });
    
    // Update player stats in background
    try {
      updatePlayerStats(currentGameData.players[winner].id, currentGameData.players[currentPlayerRole].id);
    } catch (error) {
      console.error("Failed to update player stats on turn limit:", error);
      // Continue with game update even if stats update fails
    }
  } else {
    // Normal turn update
    updateObject.turn = turn === "A" ? "B" : "A";
    updateObject.nextInputType = submissionType === 'player' ? 'attribute' : 'player';
    updateObject.lastPlayerId = submissionType === 'player' ? submissionValue : lastPlayerId;
    updateObject.lastAttribute = submissionType !== 'player' ? { type: submissionType, value: submissionValue } : lastAttribute;
    updateObject.lastSubmittedAttributeMove = submissionType !== 'player' 
                                      ? { type: submissionType, value: submissionValue } 
                                      : lastSubmittedAttributeMove;
    updateObject.usedPlayerIds = submissionType === 'player' ? [...usedPlayerIds, submissionValue] : usedPlayerIds;
  }
  
  // Clear challenge state if a valid move is made
  if (currentGameData.challengeStatus !== 'none') {
      updateObject.challengeStatus = 'none';
      updateObject.challengeType = 'none';
      updateObject.challengedPlayer = null;
  }

  return { 
    success: true, 
    update: updateObject
  };
};

// --- End Firestore Update Calculation Functions --- 

// Add these functions to handle online game challenges and give-ups

/**
 * Calculate the Firestore update for initiating a challenge
 */
export const calculateInitiateChallengeUpdate = (gameData, myRole, allPlayersData) => {
  // First verify a valid move exists to challenge
  if (!gameData.history || gameData.history.length === 0) {
    return { success: false, error: "No moves to challenge yet." };
  }
  
  const lastMove = gameData.history[gameData.history.length - 1];
  if (lastMove.player === myRole) {
    return { success: false, error: "Cannot challenge your own move." };
  }
  
  if (gameData.challengeStatus !== 'none') {
    return { success: false, error: "A challenge is already in progress." };
  }
  
  const challengedPlayer = lastMove.player;
  const moveType = lastMove.type;
  const moveValue = lastMove.value;
  
  // Create the challenge update object
  const update = {
    challengeStatus: 'pending',
    challengedPlayer: challengedPlayer,
    challengeType: moveType, // 'player' or 'attribute'
    challengeDetails: {
      originalTurn: myRole,
      moveType: moveType,
      moveValue: moveValue,
    },
    // Add challenge initiated event to history
    history: [...gameData.history, {
      player: myRole,
      type: 'challenge_initiated',
      value: `${gameData.players[myRole].name} challenged ${gameData.players[challengedPlayer].name}'s ${moveType} submission`,
      timestamp: new Date().toISOString()
    }],
    updatedAt: serverTimestamp()
  };
  
  return { success: true, update };
};

/**
 * Calculate the Firestore update for resolving a challenge and update player stats
 */
export const calculateResolveChallengeUpdate = (gameData, myRole, responseValue, responseAttrType, allPlayersData) => {
  // Ensure we're in a valid challenge state
  if (gameData.challengeStatus !== 'pending' || gameData.challengedPlayer !== myRole) {
    return { success: false, error: "No challenge to resolve." };
  }
  
  // Default to challenge failed (challenger wins)
  let challengeSucceeded = false;
  let reason = "";
  
  try {
    // PLAYER CHALLENGE: The challenged player needs to provide a valid attribute
    if (gameData.challengeType === 'player') {
      // We need responseAttrType and responseValue
      if (!responseAttrType) {
        return { success: false, error: "Please select an attribute type." };
      }
      
      // Find the challenged player object
      const challengedPlayerId = gameData.challengeDetails.moveValue;
      const playerData = allPlayersData.find(p => p.id === challengedPlayerId);
      
      if (!playerData) {
        return { success: false, error: "Player data not found." };
      }
      
      // Check if the response is valid for the player
      const attrArrayKey = responseAttrType + 's'; // numbers, teams, colleges
      if (!playerData[attrArrayKey] || !Array.isArray(playerData[attrArrayKey])) {
        reason = `No ${responseAttrType} data found for player`;
      } else {
        // For number, need to match exactly
        if (responseAttrType === 'number') {
          challengeSucceeded = playerData.numbers.some(num => 
            String(num || '').toLowerCase() === String(responseValue || '').toLowerCase()
          );
        } 
        // For team, validate team ID case-insensitively
        else if (responseAttrType === 'team') {
          const submittedTeamIdLower = String(responseValue || '').toLowerCase();
          challengeSucceeded = playerData.teams.some(dataTeamId => 
            String(dataTeamId || '').toLowerCase() === submittedTeamIdLower
          );
        } 
        // For college, case-insensitive match (already done, but kept for clarity)
        else if (responseAttrType === 'college') {
          challengeSucceeded = playerData.colleges.some(col => 
            String(col || '').toLowerCase() === String(responseValue || '').toLowerCase()
          );
        }
        
        reason = challengeSucceeded 
          ? `${gameData.players[myRole].name} validated ${playerData.name}'s ${responseAttrType}`
          : `${gameData.players[myRole].name} failed to validate ${playerData.name}'s ${responseAttrType}`;
      }
    }
    // ATTRIBUTE CHALLENGE: The challenged player needs to provide a valid player
    else if (['number', 'team', 'college'].includes(gameData.challengeDetails?.moveType)) {
      const attrType = gameData.challengeDetails.moveType; 
      const attrValue = gameData.challengeDetails.moveValue; 
      
      // Find the responded player
      const responsePlayer = allPlayersData.find(p => p.id === responseValue);
      
      if (!responsePlayer) {
        return { success: false, error: "Player not found." };
      }
      
      // Check if the player is already used in the game
      if (gameData.usedPlayerIds && gameData.usedPlayerIds.includes(responseValue)) {
        return { success: false, error: "This player has already been used in the game." };
      }
      
      // Check if the player has the attribute
      const attrArrayKey = attrType + 's'; // numbers, teams, colleges
      
      if (!responsePlayer[attrArrayKey] || !Array.isArray(responsePlayer[attrArrayKey])) {
        reason = `No ${attrType} data found for ${responsePlayer.name}`;
        challengeSucceeded = false; // Explicitly set to false
      } else {
        // ... existing validation logic ...
        // Add logging inside the checks
        if (attrType === 'number') {
          challengeSucceeded = responsePlayer.numbers.some(num => 
            String(num || '').toLowerCase() === String(attrValue || '').toLowerCase()
          );
        } 
        // For team, case-insensitive check
        else if (attrType === 'team') {
          const challengedTeamIdLower = String(attrValue || '').toLowerCase();
          challengeSucceeded = responsePlayer.teams.some(dataTeamId => 
            String(dataTeamId || '').toLowerCase() === challengedTeamIdLower
          );
        } 
        // For college, case-insensitive check (already done, but kept for clarity)
        else if (attrType === 'college') {
          challengeSucceeded = responsePlayer.colleges.some(col => 
            String(col || '').toLowerCase() === String(attrValue || '').toLowerCase()
          );
        }
        
        reason = challengeSucceeded 
          ? `${gameData.players[myRole].name} validated ${attrType} ${attrValue} with ${responsePlayer.name}`
          : `${gameData.players[myRole].name} failed to validate ${attrType} ${attrValue} with ${responsePlayer.name}`;
      }
    } else {
      // Log if the challenge type is unexpected
      console.error('[Resolve Challenge] Error: Unexpected challenge type:', gameData.challengeType);
    }
    
    // Determine winner based on challenge outcome
    const winner = challengeSucceeded ? myRole : gameData.challengeDetails.originalTurn;
    const loser = challengeSucceeded ? gameData.challengeDetails.originalTurn : myRole;

    // Create the update object
    const update = {
      status: 'finished',
      winner: winner,
      challengeStatus: 'none',
      challengedPlayer: null,
      challengeType: null,
      challengeDetails: null,
      history: [...gameData.history, {
        player: myRole,
        type: 'game_end_challenge',
        value: reason,
        timestamp: new Date().toISOString()
      }],
      updatedAt: serverTimestamp()
    };
    
    // Return the update object - let the component handle player stats
    return { success: true, update };
  } catch (error) {
    console.error("Challenge resolution error:", error);
    return { success: false, error: "An error occurred while resolving the challenge." };
  }
};

/**
 * Calculate the Firestore update for giving up
 */
export const calculateGiveUpUpdate = (gameData, myRole) => {
  if (!gameData) {
    return { success: false, error: "No game data available." };
  }
  
  const winner = myRole === 'A' ? 'B' : 'A';
  
  const update = {
    status: 'finished',
    winner: winner,
    history: [...(gameData.history || []), {
      player: myRole,
      type: 'game_end_give_up',
      value: `${gameData.players[myRole].name} gave up`,
      timestamp: new Date().toISOString()
    }],
    updatedAt: serverTimestamp()
  };
  
  // Return the update object - let the component handle player stats
  return { success: true, update };
};

/**
 * Calculate the Firestore update for a reverse move.
 */
export const calculateReverseUpdate = (gameData, myRole) => {
  if (!gameData) {
    return { success: false, error: "No game data available." };
  }
  
  if (gameData.turn !== myRole) {
    return { success: false, error: "Not your turn." };
  }
  
  // Simply swap the turn. No input validation is done here as "Reverse" acts as a "skip" 
  // but in this context it implies passing the turn back. 
  // Wait, the plan says "Validate the move using the existing validateMoveForReversal".
  // But `validateMoveForReversal` requires `submittedValue`. 
  // The user prompt says "implement the reverse functionality too... functionality should be in the code already".
  // In `OnlineGameBoard.js` `handleReverse` was commented out with a note about needing input.
  // However, the plan says: "Prompt the user for input (or use the existing input field)".
  // So we need to accept input here.
  
  // I'll update this signature to accept input.
  return { success: false, error: "Use calculateReverseUpdateWithInput instead." };
};

export const calculateReverseUpdateWithInput = (gameData, myRole, submittedValue, submittedAttribute, players) => {
  // Validate first
  const validation = validateMoveForReversal(gameData, myRole, players, submittedValue, submittedAttribute);
  
  if (!validation.isValid) {
    return { success: false, error: validation.error };
  }
  
  const nextTurn = gameData.turn === 'A' ? 'B' : 'A';
  
  // Determine display value for history
  let displayValue = submittedValue;
  if (gameData.nextInputType === 'player') {
      const p = players.find(pl => pl.id === submittedValue);
      displayValue = p ? p.name : submittedValue;
  }
  
  const update = {
    turn: nextTurn,
    history: [...gameData.history, {
      player: myRole,
      type: 'reverse_success',
      value: `reversed turn with ${displayValue}`,
      timestamp: new Date().toISOString()
    }],
    updatedAt: serverTimestamp()
  };
  
  return { success: true, update };
};

/**
 * Update player stats in Firestore after a game ends
 * @param {string} winnerId - ID of the winning player
 * @param {string} loserId - ID of the losing player 
 */
const updatePlayerStats = async (winnerId, loserId) => {
  try {
    // Skip stats update for temporary IDs
    if (winnerId.startsWith('temp_') && loserId.startsWith('temp_')) {
      return;
    }
    
    // Get current user data for calculating accurate ELO changes
    let winnerData = null;
    let loserData = null;
    
    // Fetch winner data if not a temporary ID
    if (!winnerId.startsWith('temp_')) {
      const winnerRef = doc(db, "users", winnerId);
      const winnerDoc = await getDoc(winnerRef);
      
      if (winnerDoc.exists()) {
        winnerData = winnerDoc.data();
      }
    }
    
    // Fetch loser data if not a temporary ID
    if (!loserId.startsWith('temp_')) {
      const loserRef = doc(db, "users", loserId);
      const loserDoc = await getDoc(loserRef);
      
      if (loserDoc.exists()) {
        loserData = loserDoc.data();
      }
    }
    
    // Skip if we don't have both players' data
    if (!winnerData || !loserData) {
      
      // Process winner only if we have their data
      if (winnerData) {
        const winnerRef = doc(db, "users", winnerId);
        
        // Get current ELO rating (from array or fallback to the single value)
        const currentEloRatings = winnerData.stats?.eloRating || [1000];
        const currentElo = Array.isArray(currentEloRatings) 
          ? (currentEloRatings.length > 0 ? currentEloRatings[currentEloRatings.length - 1] : 1000)
          : (currentEloRatings || 1000);
        
        // Use default win change of +10
        const newElo = currentElo + 10;
        const updatedEloRatings = Array.isArray(currentEloRatings) 
          ? [...currentEloRatings, newElo]
          : [currentElo, newElo];
        
        // Update user document
        await updateDoc(winnerRef, {
          "stats.wins": increment(1),
          "stats.gamesPlayed": increment(1),
          "stats.eloRating": updatedEloRatings,
          "lastActive": serverTimestamp()
        });
      }
      
      // Process loser only if we have their data
      if (loserData) {
        const loserRef = doc(db, "users", loserId);
        
        // Get current ELO rating (from array or fallback to the single value)
        const currentEloRatings = loserData.stats?.eloRating || [1000];
        const currentElo = Array.isArray(currentEloRatings)
          ? (currentEloRatings.length > 0 ? currentEloRatings[currentEloRatings.length - 1] : 1000)
          : (currentEloRatings || 1000);
        
        // Use default loss change of -5
        const newElo = Math.max(800, currentElo - 5);
        const updatedEloRatings = Array.isArray(currentEloRatings)
          ? [...currentEloRatings, newElo]
          : [currentElo, newElo];
        
        // Update user document
        await updateDoc(loserRef, {
          "stats.losses": increment(1),
          "stats.gamesPlayed": increment(1),
          "stats.eloRating": updatedEloRatings,
          "lastActive": serverTimestamp()
        });
      }
      
      return;
    }
    
    // Get current ELO ratings
    const currentWinnerElo = Array.isArray(winnerData.stats?.eloRating) 
      ? (winnerData.stats.eloRating.length > 0 ? winnerData.stats.eloRating[winnerData.stats.eloRating.length - 1] : 1000)
      : (winnerData.stats?.eloRating || 1000);
    
    const currentLoserElo = Array.isArray(loserData.stats?.eloRating)
      ? (loserData.stats.eloRating.length > 0 ? loserData.stats.eloRating[loserData.stats.eloRating.length - 1] : 1000)
      : (loserData.stats?.eloRating || 1000);
    
    // Calculate new ELO ratings using the accurate formula
    const newWinnerElo = calculateNewEloRating(currentWinnerElo, currentLoserElo, 1);
    const newLoserElo = Math.max(800, calculateNewEloRating(currentLoserElo, currentWinnerElo, 0));
    
    
    // Update winner stats
    if (!winnerId.startsWith('temp_')) {
      const winnerRef = doc(db, "users", winnerId);
      
      // Prepare ELO rating array
      const winnerEloRatings = Array.isArray(winnerData.stats?.eloRating) 
        ? [...winnerData.stats.eloRating, newWinnerElo]
        : [currentWinnerElo, newWinnerElo];
      
      // Update document
      await updateDoc(winnerRef, {
        "stats.wins": increment(1),
        "stats.gamesPlayed": increment(1),
        "stats.eloRating": winnerEloRatings,
        "lastActive": serverTimestamp()
      });
      
    }
    
    // Update loser stats
    if (!loserId.startsWith('temp_')) {
      const loserRef = doc(db, "users", loserId);
      
      // Prepare ELO rating array
      const loserEloRatings = Array.isArray(loserData.stats?.eloRating)
        ? [...loserData.stats.eloRating, newLoserElo]
        : [currentLoserElo, newLoserElo];
      
      // Update document
      await updateDoc(loserRef, {
        "stats.losses": increment(1),
        "stats.gamesPlayed": increment(1),
        "stats.eloRating": loserEloRatings,
        "lastActive": serverTimestamp()
      });
      
    }
  } catch (error) {
    console.error("Error updating player stats:", error);
    // Don't throw - stats update is not critical for game flow
  }
};
