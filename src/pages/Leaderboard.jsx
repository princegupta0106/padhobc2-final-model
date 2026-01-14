import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "../firebase/config";
import {
  Trophy,
  TrendingUp,
  Award,
  Medal,
  Crown,
  Zap,
  ArrowLeft,
  HelpCircle,
} from "lucide-react";
import Avatar from "../components/Avatar";

const Leaderboard = () => {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { isDarkMode } = useTheme();
  const [topUsers, setTopUsers] = useState([]);
  const [userRank, setUserRank] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasFetched, setHasFetched] = useState(false);
  const [showXPInfo, setShowXPInfo] = useState(false);

  useEffect(() => {
    if (userProfile?.collegeId && !hasFetched) {
      fetchLeaderboards();
      setHasFetched(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.collegeId]);

  const calculateXP = (contributions, totalMinutes) => {
    const contributionXP = (contributions || 0) * 10;
    const timeXP = Math.floor((totalMinutes || 0) / 1) * 2; // 2 XP per minute
    return contributionXP + timeXP;
  };

  const fetchLeaderboards = async () => {
    try {
      setLoading(true);

      // Fetch all users from the same college
      const usersQuery = query(
        collection(db, "users"),
        where("collegeId", "==", userProfile.collegeId)
      );
      const usersSnapshot = await getDocs(usersQuery);

      const usersData = usersSnapshot.docs.map((doc) => {
        const data = doc.data();
        // Calculate total time from dailyTime array
        const totalMinutes = (data.dailyTime || []).reduce(
          (sum, day) => sum + (day.totalMinutes || 0),
          0
        );
        const xp = calculateXP(data.contributions || 0, totalMinutes);

        return {
          id: doc.id,
          displayName: data.displayName,
          photoURL: data.photoURL,
          contributions: data.contributions || 0,
          totalMinutes: totalMinutes,
          xp: xp,
          role: data.role,
        };
      });

      // Sort by XP and create top users list
      const sortedByXP = [...usersData].sort((a, b) => b.xp - a.xp);
      setTopUsers(sortedByXP.slice(0, 50));

      // Find current user's rank
      const userXPRank =
        sortedByXP.findIndex((u) => u.id === userProfile.uid) + 1;
      setUserRank(userXPRank || null);

      setLoading(false);
    } catch (error) {
      console.error("Error fetching leaderboards:", error);
      setLoading(false);
    }
  };

  const getRankMedal = (rank) => {
    if (rank === 1)
      return { icon: Crown, color: "text-yellow-500", bg: "bg-yellow-50" };
    if (rank === 2)
      return { icon: Medal, color: "text-gray-400", bg: "bg-gray-50" };
    if (rank === 3)
      return { icon: Medal, color: "text-orange-600", bg: "bg-orange-50" };
    return { icon: Award, color: "text-blue-500", bg: "bg-blue-50" };
  };

  const formatTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  if (!userProfile?.collegeId) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center p-4 ${
          isDarkMode ? "bg-gray-900" : "bg-gray-50"
        }`}
      >
        <div
          className={`p-8 rounded-lg shadow-sm text-center max-w-md ${
            isDarkMode ? "bg-gray-800" : "bg-white"
          }`}
        >
          <Trophy size={48} className="text-gray-400 mx-auto mb-4" />
          <h1
            className={`text-2xl font-bold mb-2 ${
              isDarkMode ? "text-white" : "text-gray-800"
            }`}
          >
            Access Restricted
          </h1>
          <p className={isDarkMode ? "text-gray-400" : "text-gray-600"}>
            You need to be part of a college to view the leaderboard.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center ${
          isDarkMode ? "bg-gray-900" : "bg-gray-50"
        }`}
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className={isDarkMode ? "text-gray-400" : "text-gray-600"}>
            Loading leaderboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen py-4 md:py-6 ${
        isDarkMode ? "bg-gray-900" : "bg-gray-50"
      }`}
    >
      <div className="max-w-4xl mx-auto px-4 md:px-6">
        {/* Header */}
        <button
          onClick={() => navigate(-1)}
          className={`flex items-center gap-2 mb-4 transition-colors ${
            isDarkMode
              ? "text-gray-400 hover:text-gray-200"
              : "text-gray-600 hover:text-gray-800"
          }`}
        >
          <ArrowLeft size={20} />
          <span>Back</span>
        </button>

        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Trophy className="text-yellow-500" size={28} />
            <h1
              className={`text-2xl md:text-3xl font-bold ${
                isDarkMode ? "text-white" : "text-gray-800"
              }`}
            >
              College Leaderboard
            </h1>
          </div>
          <p
            className={`text-sm ${
              isDarkMode ? "text-gray-400" : "text-gray-600"
            }`}
          >
            Compete with your peers and climb the ranks!
          </p>
        </div>

        {/* User Rank Card */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg shadow-lg p-4 mb-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90 mb-1">Your Rank</p>
              <p className="text-4xl font-bold">#{userRank || "-"}</p>
            </div>
            <div className="text-right">
              <p className="text-sm opacity-90 mb-1">Your XP</p>
              <div className="flex items-center gap-1 justify-end">
                <Zap size={24} />
                <p className="text-3xl font-bold">
                  {topUsers.find((u) => u.id === userProfile.uid)?.xp || 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Leaderboard */}
        <div
          className={`rounded-lg shadow-sm p-4 ${
            isDarkMode ? "bg-gray-800" : "bg-white"
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="text-blue-600" size={22} />
              <h2
                className={`text-lg font-bold ${
                  isDarkMode ? "text-white" : "text-gray-800"
                }`}
              >
                Top Users
              </h2>
            </div>
            <button
              onClick={() => setShowXPInfo(!showXPInfo)}
              className={`flex items-center gap-1 text-sm transition-colors ${
                isDarkMode
                  ? "text-gray-400 hover:text-gray-200"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              >
              <HelpCircle size={16} />
              <span>How XP works</span>
            </button>
          </div>

          {showXPInfo && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-gray-700">
                <span className="font-semibold">XP Formula:</span> 10 XP per
                contribution + 2 XP per minute spent learning
              </p>
            </div>
          )}

          <div className="space-y-2">
            {topUsers.map((user, index) => {
              const rank = index + 1;
              const medal = getRankMedal(rank);
              const MedalIcon = medal.icon;
              const isCurrentUser = user.id === userProfile.uid;

              return (
                <div
                  key={user.id}
                  className={`flex items-center gap-3 p-3 rounded-lg transition-all cursor-pointer hover:shadow-md ${
                    isCurrentUser
                      ? "bg-blue-50 border-2 border-blue-500"
                      : isDarkMode
                      ? "bg-gray-700 hover:bg-gray-600"
                      : "bg-gray-50 hover:bg-gray-100"
                  }`}
                  onClick={() => navigate(`/user/${user.id}`)}
                >
                  <div
                    className={`flex items-center justify-center w-10 h-10 rounded-full flex-shrink-0 ${medal.bg}`}
                  >
                    {rank <= 3 ? (
                      <MedalIcon className={medal.color} size={18} />
                    ) : (
                      <span
                        className={`font-bold text-sm ${
                          isDarkMode && !isCurrentUser
                            ? "text-gray-300"
                            : "text-gray-600"
                        }`}
                      >
                        #{rank}
                      </span>
                    )}
                  </div>

                  <Avatar
                    photoURL={user.photoURL}
                    displayName={user.displayName}
                    size="md"
                  />

                  <div className="flex-1 min-w-0">
                    <p
                      className={`font-semibold truncate ${
                        isDarkMode && !isCurrentUser
                          ? "text-white"
                          : "text-gray-800"
                      }`}
                    >
                      {user.displayName}
                    </p>
                    <p
                      className={`text-sm ${
                        isDarkMode && !isCurrentUser
                          ? "text-gray-400"
                          : "text-gray-600"
                      }`}
                    >
                      {user.contributions} contributions
                    </p>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div className="flex items-center gap-1 text-blue-600 font-bold">
                      <Zap size={16} />
                      <span>{user.xp}</span>
                    </div>
                    <p className="text-xs text-gray-500">XP</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
