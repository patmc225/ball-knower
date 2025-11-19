const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Read items from JSON file
const items = JSON.parse(fs.readFileSync(path.join(__dirname, 'items.json'), 'utf8'));

// Function to get random item
function getRandomItem(excludeLeague = null) {
  let filteredItems = excludeLeague 
    ? items.filter(item => item.league !== excludeLeague)
    : items;
  return filteredItems[Math.floor(Math.random() * filteredItems.length)];
}

// Function to format date as "Month DD, YYYY"
function formatDate(date) {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}

async function generateDocuments() {
  const today = new Date();
  
  for (let i = 1; i <= 100; i++) {
    const date = new Date();
    date.setDate(today.getDate() + i);
    const formattedDate = formatDate(date);
    
    // Get random start item
    const startItem = getRandomItem();
    
    // Get random end item from different league
    const endItem = getRandomItem(startItem.league);
    
    // Calculate shortest path
    const shortestPath = startItem.type === endItem.type ? 4 : 3;
    
    const docData = {
      startId: startItem.id,
      startType: startItem.type,
      endId: endItem.id,
      endType: endItem.type,
      shortestPath: shortestPath
    };
    
    try {
      await db.collection('daily').doc(formattedDate).set(docData);
      console.log(`Created document for ${formattedDate}`);
    } catch (error) {
      console.error(`Error creating document for ${formattedDate}:`, error);
    }
  }
  
  console.log('Finished creating all documents');
  process.exit(0);
}

generateDocuments();
