import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Calculate XP based on contributions and time spent
 * Formula: 10 XP per contribution + 2 XP per minute
 */
export const calculateXP = (contributions, totalMinutes) => {
  const contributionXP = (contributions || 0) * 10;
  const timeXP = Math.floor((totalMinutes || 0) / 1) * 2;
  return contributionXP + timeXP;
};

/**
 * Update user's XP based on their current contributions and time
 */
export const updateUserXP = async (userId) => {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      console.error('User not found');
      return;
    }

    const userData = userSnap.data();
    const contributions = userData.contributions || 0;
    
    // Calculate total minutes from dailyTime array
    const totalMinutes = (userData.dailyTime || []).reduce(
      (sum, day) => sum + (day.totalMinutes || 0),
      0
    );

    const newXP = calculateXP(contributions, totalMinutes);

    // Only update if XP has changed
    if (userData.xp !== newXP) {
      await updateDoc(userRef, { xp: newXP });
    }

    return newXP;
  } catch (error) {
    console.error('Error updating XP:', error);
    throw error;
  }
};
