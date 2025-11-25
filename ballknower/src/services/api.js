// API service for data operations
// For MVP, we'll use local storage to persist data
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';

// Helper function to load data from local storage or use default
export const loadData = (key, defaultValue) => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch (error) {
    console.error(`Error loading ${key} data:`, error);
    return defaultValue;
  }
};

// Helper function to save data to local storage
const saveData = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error(`Error saving ${key} data:`, error);
    return false;
  }
};


// ... existing code ...

// Simulated data stores
let players = [];
let games = [];
let users = [];
let popularityData = {};
let internalTeamsData = {}; // Store teams keyed by ID
let internalCollegesList = [];
let teams = [];
let imagesData = {};

// Function to load and initialize all data
export const initializeData = async () => {
  try {
    // Get the base URL for assets (uses PUBLIC_URL environment variable set by CRA)
    const baseUrl = process.env.PUBLIC_URL || '';
    
    // 1. Load Rarity Data (Frequency)
    const rarityMap = {};
    try {
        const raritySnapshot = await getDocs(collection(db, "rarity"));
        raritySnapshot.forEach(doc => {
            const data = doc.data();
            // Key format in updateRarity is usually type_value (sanitized)
            // However, data usually contains 'value' and 'type' fields as well.
            if (data.type && data.value) {
                // Construct key to match how we'll look it up (raw ID/value)
                // Note: updateRarity uses safeVal for doc ID, but stores raw value in 'value' field.
                // We will look up using the raw value from our data.
                const key = `${data.type}_${data.value}`; 
                rarityMap[key] = data.frequency || 0;
            }
        });
    } catch (e) {
        console.error("Error loading rarity data:", e);
        // Continue loading other data even if this fails
    }

    // Load Players (New File and Format)
    const playersRes = await fetch(`${baseUrl}/backend/players_new.json`);
    if (!playersRes.ok) throw new Error(`HTTP error loading players! status: ${playersRes.status}`);
    const playersData = await playersRes.json();
    
    // Convert object to array and map frequency
    players = Object.values(playersData).map(p => ({
        ...p,
        frequency: rarityMap[`player_${p.id}`] || 0
    }));
    
    // Load Teams
    const teamsRes = await fetch(`${baseUrl}/backend/teams.json`);
    if (!teamsRes.ok) throw new Error(`HTTP error loading teams! status: ${teamsRes.status}`);
    internalTeamsData = await teamsRes.json(); // Keep as object keyed by ID
    
    // Map frequency to teams array and update internalTeamsData
    teams = Object.values(internalTeamsData).map(t => ({
        ...t,
        frequency: rarityMap[`team_${t.id}`] || 0
    }));
    
    // Update internal dictionary with frequency for getTeamById if needed
    teams.forEach(t => {
        if (internalTeamsData[t.id]) {
            internalTeamsData[t.id].frequency = t.frequency;
        }
    });

    // Load Images
    const imagesRes = await fetch(`${baseUrl}/backend/images.json`);
    if (!imagesRes.ok) throw new Error(`HTTP error loading images! status: ${imagesRes.status}`);
    imagesData = await imagesRes.json();

    // Extract colleges (Teams are now loaded directly)
    const allColleges = new Set();
    players.forEach(player => {
      if (player.colleges && Array.isArray(player.colleges)) {
        player.colleges.forEach(college => {
          if (college && college !== 'None' && college !== '-') { 
             allColleges.add(college);
          }
        });
      }
    });
    
    // Sort colleges by frequency (descending), then alphabetical
    internalCollegesList = Array.from(allColleges).sort((a, b) => {
        const freqA = rarityMap[`college_${a}`] || 0;
        const freqB = rarityMap[`college_${b}`] || 0;
        if (freqB !== freqA) return freqB - freqA; // Higher frequency first
        return a.localeCompare(b);
    });

    return { success: true };

  } catch (error) {
    console.error("Error initializing API data:", error);
    return { success: false, error: error.message };
  }
};

// Getter functions
export const getPlayers = () => players;
export const getGames = () => games;
export const getUsers = () => users;
export const getGameById = (id) => games.find(game => game.gameId === id);
export const getUserById = (id) => users.find(user => user.userId === id);
export const getPlayerById = (id) => players.find(player => player.id === id);
export const getPopularityData = () => popularityData;
export const getTeams = () => Object.values(internalTeamsData); // Return array of team objects if needed
export const getTeamById = (id) => internalTeamsData[id] || null; // Function to get team by ID
export const getColleges = () => internalCollegesList;
export const getImagesData = () => imagesData;

// Search function (adapts based on attribute)
export const searchPlayers = (attribute, query) => {
  const lowerCaseQuery = query.toLowerCase();
  const results = players.filter(player => {
    if (attribute === 'name') {
      if(player.name === undefined) {
        console.log(player);
        return false;
      }
      return player.name.toLowerCase().includes(lowerCaseQuery);
    } else if (attribute === 'team' || attribute === 'college' || attribute === 'number') {
      // Handle array attributes
      const attributeKey = attribute + 's'; // numbers, teams, colleges
      return player[attributeKey]?.some(val => 
          String(val ?? '').toLowerCase().includes(lowerCaseQuery)
      );
    }
    return false;
  });
  
  // Sort by frequency (descending) then by name (for stability)
  return results.sort((a, b) => {
      const diff = (b.frequency || 0) - (a.frequency || 0);
      if (diff !== 0) return diff;
      return 0; // Keep original order or sort by name if needed
  }).slice(0, 10);
};

// Search function (adapts based on attribute)
export const searchTeams = (query) => {
  const lowerCaseQuery = query.toLowerCase();
  const results = teams.filter(team => {
    let full_name = team.name;
    return full_name.toLowerCase().includes(lowerCaseQuery);
  });
  
  // Sort by frequency (descending)
  return results.sort((a, b) => (b.frequency || 0) - (a.frequency || 0)).slice(0, 10);
};

// Create a new game
export const createGame = (game) => {
  games = [...games, game];
  saveData('games', games);
  return { success: true, game };
};

// Update a game
export const updateGame = (updatedGame) => {
  games = games.map(game => 
    game.gameId === updatedGame.gameId ? updatedGame : game
  );
  saveData('games', games);
  return { success: true, game: updatedGame };
};

// Get user by nickname
export const getUserByNickname = (nickname) => {
  return users.find(user => user.nickname === nickname);
};

// Create a new user
export const createUser = (nickname) => {
  // Check if nickname already exists
  if (users.some(user => user.nickname === nickname)) {
    return { success: false, error: 'Nickname already exists' };
  }
  
  const newUser = {
    userId: `user_${Math.random().toString(36).substring(2, 10)}`,
    nickname,
    rating: 1200, // Initial Elo rating
    gamesPlayed: 0,
    lastActive: new Date().toISOString()
  };
  
  users = [...users, newUser];
  saveData('users', users);
  return { success: true, user: newUser };
};

// Update users
export const updateUsers = (updatedUsers) => {
  users = updatedUsers;
  saveData('users', users);
  return { success: true, users };
}; 