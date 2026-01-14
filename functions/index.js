const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

const db = admin.firestore();

/**
 * Cloud Function to update user contributions
 * Triggers whenever a folder document is created, updated, or deleted
 */
exports.updateUserContributions = functions.firestore
  .document('folders/{folderId}')
  .onWrite(async (change, context) => {
    try {
      const folderId = context.params.folderId;
      
      // Get the uploader ID from the folder
      let uploaderId = null;
      
      if (change.after.exists) {
        // Folder was created or updated
        uploaderId = change.after.data().uploadedById;
      } else if (change.before.exists) {
        // Folder was deleted
        uploaderId = change.before.data().uploadedById;
      }
      
      if (!uploaderId) {
        console.log('No uploader ID found, skipping contribution update');
        return null;
      }
      
      // Query all folders uploaded by this user (excluding deleted ones)
      const userFoldersSnapshot = await db.collection('folders')
        .where('uploadedById', '==', uploaderId)
        .where('deleted', '==', false)
        .get();
      
      // Also get folders without deleted field (old data)
      const userFoldersSnapshot2 = await db.collection('folders')
        .where('uploadedById', '==', uploaderId)
        .get();
      
      // Combine and filter out deleted folders
      const allFolders = [];
      userFoldersSnapshot.forEach(doc => allFolders.push(doc.data()));
      userFoldersSnapshot2.forEach(doc => {
        if (!doc.data().deleted) {
          // Check if not already added
          const exists = allFolders.some(f => f.name === doc.data().name && f.courseId === doc.data().courseId);
          if (!exists) {
            allFolders.push(doc.data());
          }
        }
      });
      
      // Count total files across all folders
      let totalContributions = 0;
      allFolders.forEach(folder => {
        if (folder.files && Array.isArray(folder.files)) {
          totalContributions += folder.files.length;
        }
      });
      
      // Update user's contributions count
      const userRef = db.collection('users').doc(uploaderId);
      await userRef.update({
        contributions: totalContributions,
        contributionsUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log(`Updated contributions for user ${uploaderId}: ${totalContributions}`);
      
      // Also update XP based on contributions (10 XP per contribution)
      const xp = totalContributions * 10;
      await userRef.update({
        xp: xp
      });
      
      console.log(`Updated XP for user ${uploaderId}: ${xp}`);
      
      return null;
    } catch (error) {
      console.error('Error updating user contributions:', error);
      return null;
    }
  });

/**
 * Manually callable function to recalculate contributions for a specific user
 * Useful for fixing data inconsistencies
 */
exports.recalculateUserContributions = functions.https.onCall(async (data, context) => {
  try {
    // Check if user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    
    const userId = data.userId || context.auth.uid;
    
    // Query all folders uploaded by this user
    const userFoldersSnapshot = await db.collection('folders')
      .where('uploadedById', '==', userId)
      .get();
    
    // Count total files
    let totalContributions = 0;
    userFoldersSnapshot.forEach(doc => {
      const folder = doc.data();
      if (!folder.deleted && folder.files && Array.isArray(folder.files)) {
        totalContributions += folder.files.length;
      }
    });
    
    // Update user's contributions
    const userRef = db.collection('users').doc(userId);
    await userRef.update({
      contributions: totalContributions,
      contributionsUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      xp: totalContributions * 10
    });
    
    return { 
      success: true, 
      userId: userId,
      contributions: totalContributions,
      xp: totalContributions * 10
    };
  } catch (error) {
    console.error('Error recalculating contributions:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});
