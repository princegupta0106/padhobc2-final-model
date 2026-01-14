import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { collection, query, where, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { TrendingUp, Calendar, Clock, BookOpen, Flame, Target, Activity, FileText, ArrowLeft } from 'lucide-react';
import CalendarHeatmap from 'react-calendar-heatmap';
import 'react-calendar-heatmap/dist/styles.css';

const Insights = () => {
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const [stats, setStats] = useState({
    currentStreak: 0,
    longestStreak: 0,
    totalTimeSpent: 0,
    websiteTimeSpent: 0,
    courseWiseTime: [],
    lastLoginDate: null,
    totalLogins: 0,
    totalDownloads: 0,
    dailyActivity: [] // Array of {date, minutes}
  });
  const [loading, setLoading] = useState(true);
  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    if (userProfile && !hasFetched) {
      updateLoginStreak();
      fetchInsights();
      setHasFetched(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.uid]);

  const updateLoginStreak = async () => {
    try {
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const today = new Date().toDateString();
        const lastLogin = userData.lastLoginDate ? new Date(userData.lastLoginDate).toDateString() : null;
        const yesterday = new Date(Date.now() - 86400000).toDateString();

        let newStreak = userData.currentStreak || 0;
        let longestStreak = userData.longestStreak || 0;
        let totalLogins = userData.totalLogins || 0;

        if (lastLogin !== today) {
          totalLogins += 1;
          
          if (lastLogin === yesterday) {
            // Continuing streak
            newStreak += 1;
          } else if (!lastLogin || lastLogin !== today) {
            // New streak or broken streak
            newStreak = 1;
          }

          longestStreak = Math.max(longestStreak, newStreak);

          await updateDoc(userRef, {
            lastLoginDate: new Date().toISOString(),
            currentStreak: newStreak,
            longestStreak: longestStreak,
            totalLogins: totalLogins
          });
        }

        setStats(prev => ({
          ...prev,
          currentStreak: newStreak,
          longestStreak: longestStreak,
          totalLogins: totalLogins,
          lastLoginDate: new Date().toISOString()
        }));
      }
    } catch (error) {
      console.error('Error updating login streak:', error);
    }
  };

  const fetchInsights = async () => {
    try {
      setLoading(true);
      
      // Fetch user document with time tracking data
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        setLoading(false);
        return;
      }

      const userData = userDoc.data();
      const timeArray = userData.time || []; // [{courseId, minutes}]
      const dailyTimeArray = userData.dailyTime || []; // [{date, totalMinutes}]
      
      // Calculate total time from time array
      const totalTime = timeArray.reduce((sum, entry) => sum + (entry.minutes || 0), 0);
      
      // Calculate website time (misc courseId)
      const websiteTime = timeArray
        .filter(entry => entry.courseId === 'misc')
        .reduce((sum, entry) => sum + (entry.minutes || 0), 0);

      // Fetch download count
      const downloadsQuery = query(
        collection(db, 'downloads'),
        where('userId', '==', user.uid)
      );
      const downloadsSnapshot = await getDocs(downloadsQuery);
      const downloadCount = downloadsSnapshot.size;

      // Get course names and build course-wise data
      const coursesSnapshot = await getDocs(collection(db, 'courses'));
      const courseWiseData = [];
      
      // Group time by courseId (excluding 'misc')
      const courseTimeMap = {};
      timeArray.forEach(entry => {
        if (entry.courseId && entry.courseId !== 'misc') {
          if (!courseTimeMap[entry.courseId]) {
            courseTimeMap[entry.courseId] = 0;
          }
          courseTimeMap[entry.courseId] += entry.minutes || 0;
        }
      });

      for (const [courseId, minutes] of Object.entries(courseTimeMap)) {
        const courseDoc = coursesSnapshot.docs.find(doc => doc.id === courseId);
        if (courseDoc) {
          courseWiseData.push({
            courseName: courseDoc.data().name,
            time: minutes
          });
        }
      }

      // Sort by time spent
      courseWiseData.sort((a, b) => b.time - a.time);

      // Convert dailyTime array to dailyActivity format for heatmap
      const dailyActivity = dailyTimeArray.map(entry => ({
        date: new Date(entry.date),
        minutes: entry.totalMinutes || 0
      }));

      setStats(prev => ({
        ...prev,
        totalTimeSpent: totalTime,
        websiteTimeSpent: websiteTime,
        courseWiseTime: courseWiseData,
        totalDownloads: downloadCount,
        dailyActivity: dailyActivity
      }));

      setLoading(false);
    } catch (error) {
      console.error('Error fetching insights:', error);
      setLoading(false);
    }
  };

  const formatTime = (minutes) => {
    const roundedMinutes = Math.round(minutes);
    if (roundedMinutes < 60) return `${roundedMinutes}m`;
    const hours = Math.floor(roundedMinutes / 60);
    const mins = roundedMinutes % 60;
    return `${hours}h ${mins}m`;
  };

  const getActivityLevel = (minutes) => {
    const roundedMinutes = Math.round(minutes);
    if (roundedMinutes === 0) return 'color-empty';
    if (roundedMinutes < 15) return 'color-scale-1';
    if (roundedMinutes < 30) return 'color-scale-2';
    if (roundedMinutes < 60) return 'color-scale-3';
    return 'color-scale-4';
  };

  const getHeatmapValues = () => {
    const today = new Date();
    const yearAgo = new Date(today);
    yearAgo.setFullYear(today.getFullYear() - 1);
    
    // Create a map for quick lookup
    const activityMap = {};
    stats.dailyActivity.forEach(activity => {
      const dateStr = activity.date.toISOString().split('T')[0];
      activityMap[dateStr] = activity.minutes;
    });
    
    // Generate all dates in the range
    const values = [];
    const currentDate = new Date(yearAgo);
    
    while (currentDate <= today) {
      const dateStr = currentDate.toISOString().split('T')[0];
      values.push({
        date: dateStr,
        count: activityMap[dateStr] || 0
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return values;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl text-gray-600">Loading insights...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header with Back Button */}
        <div className="flex items-center gap-4 mb-4 md:mb-8 pr-12 lg:pr-0">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            title="Go back"
          >
            <ArrowLeft size={24} className="text-gray-700" />
          </button>
          <h1 className="text-xl md:text-3xl font-bold text-gray-800">Your Insights</h1>
        </div>

        {/* Streak & Activity Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4 mb-4 md:mb-6">
          <div className="bg-gradient-to-br from-orange-500 to-red-500 rounded-lg shadow-sm p-2 md:p-4 text-white">
            <div className="flex items-center justify-between mb-1">
              <Flame size={18} className="md:w-6 md:h-6" />
              <span className="text-lg md:text-2xl font-bold">{stats.currentStreak}</span>
            </div>
            <h3 className="text-xs md:text-sm font-medium opacity-90">Current Streak</h3>
            <p className="text-[10px] md:text-xs opacity-75">Days in a row</p>
          </div>

          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-sm p-2 md:p-4 text-white">
            <div className="flex items-center justify-between mb-1">
              <Target size={18} className="md:w-6 md:h-6" />
              <span className="text-lg md:text-2xl font-bold">{stats.longestStreak}</span>
            </div>
            <h3 className="text-xs md:text-sm font-medium opacity-90">Longest Streak</h3>
            <p className="text-[10px] md:text-xs opacity-75">Personal best</p>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-sm p-2 md:p-4 text-white">
            <div className="flex items-center justify-between mb-1">
              <Clock size={18} className="md:w-6 md:h-6" />
              <span className="text-lg md:text-2xl font-bold">{formatTime(Math.round(stats.websiteTimeSpent))}</span>
            </div>
            <h3 className="text-xs md:text-sm font-medium opacity-90">Website Time</h3>
            <p className="text-[10px] md:text-xs opacity-75">Total on site</p>
          </div>

          <div className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-lg shadow-sm p-2 md:p-4 text-white">
            <div className="flex items-center justify-between mb-1">
              <FileText size={18} className="md:w-6 md:h-6" />
              <span className="text-lg md:text-2xl font-bold">{stats.totalDownloads}</span>
            </div>
            <h3 className="text-xs md:text-sm font-medium opacity-90">Downloads</h3>
            <p className="text-[10px] md:text-xs opacity-75">Total files</p>
          </div>
        </div>

        {/* Login Activity */}
        <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 mb-6 md:mb-8">
          <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
            <Calendar className="text-blue-600" size={20} />
            <h2 className="text-base md:text-xl font-semibold text-gray-800">Activity Heatmap</h2>
          </div>
          
          {/* Heatmap */}
          <div className="mb-4">
            <style>{`
              .react-calendar-heatmap {
                width: 100%;
                min-width: 600px;
              }
              .react-calendar-heatmap .color-empty { fill: #ebedf0; }
              .react-calendar-heatmap .color-scale-1 { fill: #9be9a8; }
              .react-calendar-heatmap .color-scale-2 { fill: #40c463; }
              .react-calendar-heatmap .color-scale-3 { fill: #30a14e; }
              .react-calendar-heatmap .color-scale-4 { fill: #216e39; }
              .react-calendar-heatmap text { font-size: 10px; fill: #666; }
              .react-calendar-heatmap rect:hover { stroke: #3b82f6; stroke-width: 2px; }
              .react-calendar-heatmap rect {
                cursor: pointer;
              }
            `}</style>
            <div className="overflow-x-auto pb-4">
            <CalendarHeatmap
              startDate={new Date(new Date().setFullYear(new Date().getFullYear() - 1))}
              endDate={new Date()}
              values={getHeatmapValues()}
              classForValue={(value) => {
                if (!value) return 'color-empty';
                return getActivityLevel(value.count);
              }}
              titleForValue={(value) => {
                if (!value || !value.date) return null;
                const date = new Date(value.date);
                const minutes = Math.round(value.count || 0);
                const formattedDate = date.toLocaleDateString('en-US', { 
                  weekday: 'short',
                  month: 'short', 
                  day: 'numeric',
                  year: 'numeric'
                });
                if (minutes === 0) {
                  return `No activity on ${formattedDate}`;
                }
                return `${minutes} minute${minutes !== 1 ? 's' : ''} on ${formattedDate}`;
              }}
              showWeekdayLabels={true}
              gutterSize={2}
            />
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-600 mt-4">
              <span>Less</span>
              <div className="flex gap-1">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#ebedf0' }}></div>
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#9be9a8' }}></div>
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#40c463' }}></div>
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#30a14e' }}></div>
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#216e39' }}></div>
              </div>
              <span>More</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Total Logins</p>
              <p className="text-2xl font-bold text-gray-800">{stats.totalLogins}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Last Login</p>
              <p className="text-2xl font-bold text-gray-800">
                {stats.lastLoginDate ? new Date(stats.lastLoginDate).toLocaleDateString() : 'N/A'}
              </p>
            </div>
          </div>
        </div>

        {/* Course-wise Time */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-3 mb-6">
            <BookOpen className="text-blue-600" size={24} />
            <h2 className="text-xl font-semibold text-gray-800">Time by Course</h2>
          </div>

          {stats.courseWiseTime.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <TrendingUp size={48} className="mx-auto mb-4 opacity-50" />
              <p>No activity data yet. Start uploading resources to track your time!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {stats.courseWiseTime.map((course, index) => {
                const maxTime = stats.courseWiseTime[0].time;
                const percentage = (course.time / maxTime) * 100;

                return (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-700">{course.courseName}</span>
                      <span className="text-sm text-gray-600">{formatTime(course.time)}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Insights;
