const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

/**
 * Core logic to calculate rarity scores.
 * Shared by scheduled and manual triggers.
 */
async function calculateRarityLogic() {
  console.log('Starting rarity calculation...');

  try {
    const rarityCollection = db.collection('rarity');
    const snapshot = await rarityCollection.get();

    if (snapshot.empty) {
      console.log('No rarity documents found.');
      return { success: true, message: 'No rarity documents found.' };
    }

    const docs = [];
    const maxFreqByType = {};

    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.type && typeof data.frequency === 'number') {
        docs.push({ id: doc.id, ...data });

        const currentMax = maxFreqByType[data.type] || 0;
        if (data.frequency > currentMax) {
          maxFreqByType[data.type] = data.frequency;
        }
      }
    });

    console.log('Max frequencies by type:', maxFreqByType);

    const batchLimit = 500;
    let batch = db.batch();
    let operationCount = 0;
    let totalUpdates = 0;

    for (const docData of docs) {
      const maxFreq = maxFreqByType[docData.type] || 1;
      const freq = docData.frequency;
      
      let rarityScore = Math.round(60 + 39 * (1 - (freq / maxFreq)));
      if(freq === 1) rarityScore = 100;
      
      if (rarityScore > 100) rarityScore = 100;
      if (rarityScore < 60) rarityScore = 60;

      const docRef = rarityCollection.doc(docData.id);
      batch.update(docRef, { rarity: rarityScore });
      
      operationCount++;
      if (operationCount >= batchLimit) {
        await batch.commit();
        totalUpdates += operationCount;
        batch = db.batch();
        operationCount = 0;
      }
    }

    if (operationCount > 0) {
      await batch.commit();
      totalUpdates += operationCount;
    }

    console.log(`Updated rarity scores for ${totalUpdates} documents.`);
    return { success: true, updatedCount: totalUpdates };

  } catch (error) {
    console.error('Error calculating rarity:', error);
    throw error;
  }
}

/**
 * Scheduled function that runs once daily.
 */
exports.calculateDailyRarity = functions.pubsub.schedule('every 24 hours').onRun(async (context) => {
  await calculateRarityLogic();
  return null;
});

/**
 * Manual trigger for calculating rarity.
 * Can be called via HTTP request.
 * URL will be: https://[REGION]-[PROJECT_ID].cloudfunctions.net/recalculateRarity
 */
exports.recalculateRarity = functions.https.onRequest(async (req, res) => {
  // Optional: Add basic auth or check if user is admin if this is public
  // For now, leaving open as requested for manual trigger
  
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  try {
    const result = await calculateRarityLogic();
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
