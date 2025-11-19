// API service for data operations
// For MVP, we'll use local storage to persist data

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

// Function to load and initialize all data
export const initializeData = async () => {
  try {
    // Load Players (New File and Format)
    const playersRes = await fetch('/backend/players_new.json');
    if (!playersRes.ok) throw new Error(`HTTP error loading players! status: ${playersRes.status}`);
    const playersData = await playersRes.json();
    players = Object.values(playersData); // Convert object to array
    // Load Teams
    const teamsRes = await fetch('/backend/teams.json');
    if (!teamsRes.ok) throw new Error(`HTTP error loading teams! status: ${teamsRes.status}`);
    internalTeamsData = await teamsRes.json(); // Keep as object keyed by ID
    teams = Object.values(internalTeamsData);

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
    internalCollegesList = Array.from(allColleges).sort();

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

// Search function (adapts based on attribute)
export const searchPlayers = (attribute, query) => {
  const lowerCaseQuery = query.toLowerCase();
  return players.filter(player => {
    if (attribute === 'name') {
      return player.name.toLowerCase().includes(lowerCaseQuery);
    } else if (attribute === 'team' || attribute === 'college' || attribute === 'number') {
      // Handle array attributes
      const attributeKey = attribute + 's'; // numbers, teams, colleges
      return player[attributeKey]?.some(val => 
          String(val ?? '').toLowerCase().includes(lowerCaseQuery)
      );
    }
    return false;
  }).slice(0, 10); // Limit results
};

// Search function (adapts based on attribute)
export const searchTeams = (query) => {
  const lowerCaseQuery = query.toLowerCase();
  return teams.filter(team => {
    let full_name = team.name;
    return full_name.toLowerCase().includes(lowerCaseQuery);
  }).slice(0, 10); // Limit results
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