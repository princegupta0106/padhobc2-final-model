import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { doc, updateDoc, getDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { updateUserXP } from '../utils/xpCalculator';

const TimeTracker = () => {
  const { user } = useAuth();
  const location = useLocation();
  const lastUpdateRef = useRef(Date.now());

  const getCourseId = () => {
    const path = location.pathname;
    
    // Check if on course page
    const courseMatch = path.match(/^\/course\/([^/]+)/);
    if (courseMatch) {
      return courseMatch[1];
    }
    
    // Check if on file viewer with courseId query param
    if (path === '/viewer') {
      const params = new URLSearchParams(location.search);
      return params.get('courseId') || 'misc';
    }
    
    // All other pages (home, insights, profile, etc.)
    return 'misc';
  };

  const updateTimeTracking = useCallback(async () => {
    if (!user) return;

    try {
      const courseId = getCourseId();
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const userRef = doc(db, 'users', user.uid);

      // Get current user data
      const userDoc = await getDoc(userRef);
      if (!userDoc.exists()) return;

      const userData = userDoc.data();
      const time = userData.time || [];
      const dailyTime = userData.dailyTime || [];

      // Update course time
      const courseIndex = time.findIndex(t => t.courseId === courseId);
      if (courseIndex >= 0) {
        time[courseIndex].minutes += 0.2;
      } else {
        time.push({ courseId, minutes: 0.2 });
      }

      // Update daily time
      const todayIndex = dailyTime.findIndex(d => d.date === today);
      if (todayIndex >= 0) {
        dailyTime[todayIndex].totalMinutes += 0.2;
      } else {
        dailyTime.push({ date: today, totalMinutes: 0.2 });
      }

      // Update Firestore
      await updateDoc(userRef, {
        time,
        dailyTime
      });

      // Update XP based on new time (async, don't wait)
      updateUserXP(user.uid).catch(err => console.error('Error updating XP:', err));

      console.log(`Time tracked: ${courseId} +0.2 min (Total today: ${todayIndex >= 0 ? dailyTime[todayIndex].totalMinutes : 0.2})`);
    } catch (error) {
      console.error('Error tracking time:', error);
    }
  }, [user, location.pathname, location.search]);

  useEffect(() => {
    if (!user) return;

    // Track on page load
    updateTimeTracking();

    // Track every 60 seconds
    const interval = setInterval(() => {
      if (!document.hidden) {
        updateTimeTracking();
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [user, updateTimeTracking]);

  return null;
};

export default TimeTracker;
