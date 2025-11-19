/**
 * Firebase Configuration and Authentication
 * Handles Firebase initialization, authentication, and user management
 */

import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { initializeApp as initModular } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, serverTimestamp, collection, getDocs } from "firebase/firestore";
import { getAuth, signInAnonymously, linkWithCredential, EmailAuthProvider, onAuthStateChanged, signInWithEmailAndPassword, browserLocalPersistence, setPersistence } from "firebase/auth";
import { getAnalytics, logEvent } from "firebase/analytics";
import rateLimiter from './utils/rateLimiter';

// Firebase configuration from environment variables
// These values are safe to expose in client-side code
// The security is handled by Firestore security rules
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

// Validate that all required environment variables are set
const requiredEnvVars = [
  'REACT_APP_FIREBASE_API_KEY',
  'REACT_APP_FIREBASE_AUTH_DOMAIN',
  'REACT_APP_FIREBASE_PROJECT_ID',
  'REACT_APP_FIREBASE_APP_ID'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error('Missing required Firebase environment variables:', missingVars);
  console.error('Please create a .env file based on .env.example');
}

// 1. Modular init
const app = initModular(firebaseConfig);

// 2. Compat init (so firebase.auth() will see a [DEFAULT] app)
firebase.initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
const db = getFirestore(app);

// Initialize Firebase Authentication and get a reference to the service
const auth = getAuth(app);

// Initialize Firebase Analytics
const analytics = getAnalytics(app);

// Helper function to log analytics events
const logAnalyticsEvent = (eventName, eventParams = {}) => {
  try {
    logEvent(analytics, eventName, eventParams);
  } catch (error) {
    console.error(`Failed to log analytics event ${eventName}:`, error);
  }
};

// Set persistence to LOCAL (will survive browser restarts)
setPersistence(auth, browserLocalPersistence)
  .catch((error) => {
    console.error("Error setting persistence:", error);
  });

// Also set persistence for the compat version
firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
  .catch((error) => {
    console.error("Error setting compat persistence:", error);
  });

// Arrays for memorable username generation
const adjectives = [
  "Amazing", "Brave", "Clever", "Dazzling", "Eager", "Fierce", "Gentle", "Happy", 
  "Intelligent", "Jolly", "Kind", "Lucky", "Mighty", "Noble", "Optimistic", 
  "Powerful", "Quick", "Radiant", "Silly", "Talented", "Unique", "Vibrant", 
  "Witty", "Xcellent", "Youthful", "Zealous",
  
  "Athletic", "Agile", "All-Star", "Buzzer", "Champion", "Clutch", "Defensive", 
  "Dynamic", "Elite", "Explosive", "Fast", "Focused", "Gifted", "Golden", 
  "Hustling", "Intense", "Jumping", "Knockout", "Legendary", "MVP", "Nimble", 
  "Offensive", "Precise", "Pro", "Rushing", "Scoring", "Slam", "Speedy", 
  "Tactical", "Tough", "Ultimate", "Valuable", "Winning",
  
  "Accurate", "All-Pro", "Armored", "Ballistic", "Baseline", "Blazing", "Blocking",
  "Breakaway", "Buzzerbeating", "Charging", "Clutchtime", "Coaching", "Competitive",
  "Crushing", "Drafted", "Dribbling", "Dunking", "Endzone", "Fastbreak", "Finesse",
  "Firstround", "Flagrant", "Flawless", "Flying", "Freethrow", "Gamewinning", "Gliding",
  "Gritty", "Gridiron", "Halfcourt", "Halloffame", "Hardcourt", "Heisman", "Highflying",
  "Homerun", "Hooping", "Hurling", "Ironman", "Juking", "Longrange", "Marathon",
  "Olympic", "Overtime", "Passing", "Playoff", "Posterizing", "Powerhouse", "Primetime",
  "Rebounding", "Record", "Relentless", "Rookie", "Scrimmage", "Shooting", "Sidelined",
  "Slamdunk", "Sprinting", "Striking", "Sweeping", "Tackling", "Tailgating", "Tenacious",
  "Threepeat", "Threepoing", "Topseeded", "Tournament", "Triple", "Undefeated", "Unstoppable",
  "Varsity", "Veteran"
];

const nouns = [
  "Alligator", "Bear", "Cheetah", "Dolphin", "Eagle", "Falcon", "Giraffe", "Hawk", 
  "Iguana", "Jaguar", "Koala", "Lion", "Monkey", "Narwhal", "Octopus", "Penguin", 
  "Quokka", "Raccoon", "Shark", "Tiger", "Unicorn", "Vulture", "Walrus", 
  "Xerus", "Yak", "Zebra",
  
  "Ace", "Athlete", "Baller", "Blocker", "Bronco", "Bruin", "Bull", "Cardinal", 
  "Cavalier", "Celtic", "Charger", "Clipper", "Cub", "Dodger", "Driller", "Duck", 
  "Eagle", "Flyer", "Giant", "Guard", "Heat", "Hornet", "Hurricane", "Jazz", 
  "Jet", "King", "Knight", "Laker", "Maverick", "Net", "Packer", "Patriot", 
  "Pelican", "Piston", "Quarterback", "Raider", "Ram", "Ranger", "Raven", 
  "Rocket", "Saint", "Sixer", "Spur", "Star", "Steeler", "Sun", "Thunder", 
  "Titan", "Trail", "Viking", "Warrior", "Wizard", "Wolf",
  
  "Angel", "Astro", "Athletic", "Badger", "Beaver", "Bengal", "Billiken", "Blazer",
  "Blue", "Bobcat", "Boilermaker", "Boxer", "Brave", "Brewer", "Brown", "Buccaneer",
  "Buck", "Buckeye", "Canuck", "Cardinal", "Cavalier", "Chief", "Chirping", "Clippers",
  "Colt", "Comet", "Commodore", "Cornhusker", "Cowboy", "Crusader", "Devil", "Diamond",
  "Dolphin", "Explorer", "Falcon", "Flame", "Forward", "Friar", "Glove", "Goalie", 
  "Gopher", "Grizzly", "Hawkeye", "Helmet", "Hitter", "Hoosier", "Hopper", "Hoya",
  "Hurricane", "Islander", "Jacket", "Jayhawk", "Lightning", "Longhorn", "Maple",
  "Marlin", "Miner", "Mountaineer", "Mustang", "National", "Nittany", "Nugget",
  "Oiler", "Orange", "Oriole", "Otter", "Owl", "Panther", "Pitcher", "Puma",
  "Puck", "Red", "Rider", "Sailor", "Sooner", "Spartan", "Striker", "Terrier",
  "Wildcat", "Wolverine", "Yankee", "Zag", "Lion",
  
  "Arena", "Ball", "Bat", "Basket", "Bench", "Bleacher", "Cleat", "Court",
  "Diamond", "Draft", "Field", "Goalpost", "Gridiron", "Gym", "Helmet", "Hoop",
  "Jersey", "Medal", "Midfield", "Mound", "Net", "Olympic", "Pitch", "Racket",
  "Referee", "Rink", "Scoreboard", "Stadium", "Trophy", "Turf", "Umpire", "Whistle"
];

// Generate a random memorable username that's guaranteed to be unique
const generateUsername = async () => {
  // Maximum attempts to find a unique username
  const maxAttempts = 10;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const number = Math.floor(Math.random() * 1000) + 1; // Random number between 1-1000
    const username = `${adjective}${noun}${number}`;
    
    // Check if this username already exists (case insensitive)
    const isAvailable = await isUsernameAvailable(username);
    if (isAvailable) {
      return username;
    }
  }
  
  // If we failed to generate a unique username after maxAttempts, add more randomness
  const timestamp = Date.now().toString().slice(-5);
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adjective}${noun}${timestamp}`;
};

// Helper function to check if a username is available
// Uses rate limiting to prevent abuse
const isUsernameAvailable = async (username) => {
  return await rateLimiter.execute('usernameCheck', async () => {
    try {
      // Convert to lowercase for case-insensitive comparison
      const lowercaseUsername = username.toLowerCase();
      
      // Query all users
      const usersRef = collection(db, "users");
      const querySnapshot = await getDocs(usersRef);
      
      // Check if any user has this username (case-insensitive)
      const hasMatch = querySnapshot.docs.some(doc => {
        const userData = doc.data();
        const existingUsername = userData.displayName || '';
        return existingUsername.toLowerCase() === lowercaseUsername;
      });
      
      return !hasMatch;
    } catch (err) {
      console.error("Error checking username availability:", err);
      // In case of error, assume username is available to allow account creation
      return true;
    }
  });
};

// Function to create or update user in Firestore
// Uses rate limiting to prevent abuse
const createUserRecord = async (userId, username = null) => {
  return await rateLimiter.execute('userWrite', async () => {
    try {
      const userRef = doc(db, "users", userId);
      
      // Check if user already exists (with rate limiting)
      const userDoc = await rateLimiter.execute('userRead', async () => {
        return await getDoc(userRef);
      });
      
      if (userDoc.exists()) {
        return userDoc.data();
      }
      
      // Generate a username if not provided
      const displayName = username || await generateUsername();
      
      // Initial user data
      const userData = {
        uid: userId,
        displayName,
        isAnonymous: auth.currentUser?.isAnonymous || false,
        createdAt: serverTimestamp(),
        lastActive: serverTimestamp(),
        stats: {
          wins: 0,
          losses: 0,
          gamesPlayed: 0,
          eloRating: [1000], // Store ELO ratings as an array, starting with default 1000
        }
      };
      
      // Create the user record
      await setDoc(userRef, userData);
      return userData;
    } catch (error) {
      console.error("Error creating user record:", error);
      return null;
    }
  });
};

// Enhanced function to sign in anonymously and create user record
const ensureAnonymousUser = async () => {
  return new Promise(resolve => {
    // Listen once for Firebase to restore the session
    const unsubscribe = onAuthStateChanged(auth, async user => {
      unsubscribe(); // Immediately unsubscribe since we only need this once
      
      if (user) {
        // We have either an email-signed or previously anonymous user
        
        // Make sure existing user has a record
        await createUserRecord(user.uid);
        resolve(user);
      } else {
        // No user in local storage → go anonymous
        try {
          const credential = await signInAnonymously(auth);
          
          // Create user record in Firestore
          await createUserRecord(credential.user.uid);
          
          resolve(credential.user);
        } catch (error) {
          console.error("Anonymous sign-in failed:", error);
          resolve(null);
        }
      }
    });
  });
};

// Function to link anonymous account with email/password
const linkAnonymousWithCredential = async (email, password) => {
  if (!auth.currentUser || !auth.currentUser.isAnonymous) {
    console.error("No anonymous user to link");
    return { success: false, error: "No anonymous user to link" };
  }

  try {
    const credential = EmailAuthProvider.credential(email, password);
    const result = await linkWithCredential(auth.currentUser, credential);
    
    // Update user record to reflect non-anonymous status
    const userRef = doc(db, "users", result.user.uid);
    await setDoc(userRef, { isAnonymous: false }, { merge: true });
    return { success: true, user: result.user };
  } catch (error) {
    console.error("Error linking anonymous account:", error);
    
    // Handle existing account error
    if (error.code === 'auth/email-already-in-use') {
      try {
        // Sign in with existing email
        const credential = await signInWithEmailAndPassword(auth, email, password);
        
        // Transfer stats from anonymous to existing account
        await transferUserStats(auth.currentUser.uid, credential.user.uid);
        
        return { success: true, user: credential.user, message: "Signed in with existing account" };
      } catch (signInError) {
        console.error("Error signing in with existing account:", signInError);
        return { success: false, error: signInError.message };
      }
    }
    
    return { success: false, error: error.message };
  }
};

// Function to transfer stats from one user account to another
const transferUserStats = async (fromUserId, toUserId) => {
  try {
    // Get stats from anonymous account
    const fromUserRef = doc(db, "users", fromUserId);
    const fromUserDoc = await getDoc(fromUserRef);
    if (!fromUserDoc.exists()) {
      return false;
    }
    
    // Get or create target user record
    const toUserRef = doc(db, "users", toUserId);
    const toUserDoc = await getDoc(toUserRef);
    if (toUserDoc.exists()) {
      // Combine stats from both accounts
      const fromStats = fromUserDoc.data().stats || {};
      const toStats = toUserDoc.data().stats || {};
      
      // Handle ELO rating arrays
      const fromEloRatings = Array.isArray(fromStats.eloRating) ? fromStats.eloRating : [fromStats.eloRating || 1000];
      const toEloRatings = Array.isArray(toStats.eloRating) ? toStats.eloRating : [toStats.eloRating || 1000];
      
      // Get the highest rating from either account
      const highestFromRating = fromEloRatings.length > 0 ? Math.max(...fromEloRatings) : 1000;
      const highestToRating = toEloRatings.length > 0 ? Math.max(...toEloRatings) : 1000;
      const bestRating = Math.max(highestFromRating, highestToRating);
      
      const combinedStats = {
        wins: (fromStats.wins || 0) + (toStats.wins || 0),
        losses: (fromStats.losses || 0) + (toStats.losses || 0),
        gamesPlayed: (fromStats.gamesPlayed || 0) + (toStats.gamesPlayed || 0),
        eloRating: [...toEloRatings, bestRating] // Preserve history and add best rating
      };
      
      // Update the target account
      await setDoc(toUserRef, { 
        stats: combinedStats,
        lastActive: serverTimestamp(),
        displayName: toUserDoc.data().displayName || fromUserDoc.data().displayName
      }, { merge: true });
      return true;
    } else {
      // Create new user with the anonymous user's data
      const userData = fromUserDoc.data();
      
      // Ensure ELO rating is an array
      if (userData.stats && !Array.isArray(userData.stats.eloRating)) {
        userData.stats.eloRating = [userData.stats.eloRating || 1000];
      }
      
      await setDoc(toUserRef, {
        ...userData,
        uid: toUserId,
        isAnonymous: false,
        lastActive: serverTimestamp()
      });
      return true;
    }
  } catch (error) {
    console.error("Error transferring user stats:", error);
    return false;
  }
};

export { db, auth, ensureAnonymousUser, generateUsername, createUserRecord, linkAnonymousWithCredential, isUsernameAvailable, analytics, logAnalyticsEvent };