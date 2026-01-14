import { Link, useLocation } from "react-router-dom";
import {
  Home,
  Calendar,
  Clock,
  BookOpen,
  Trophy,
  Calculator,
  FileText,
  LogOut,
  Database,
  Shield,
  Link as LinkIcon,
  Library,
  Building2,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Menu,
  X,
  GraduationCap,
  Moon,
  Sun,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import Avatar from "./Avatar";
import toast from "react-hot-toast";
import { useState, useEffect } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";

const Sidebar = () => {
  const location = useLocation();
  const { user, userProfile, logout } = useAuth();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [showCourses, setShowCourses] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (userProfile?.enrolledCourses?.length > 0) {
      fetchEnrolledCourses();
    }
  }, [userProfile]);

  const fetchEnrolledCourses = async () => {
    try {
      const coursesSnapshot = await getDocs(collection(db, "courses"));
      const courses = coursesSnapshot.docs
        .filter((doc) => userProfile.enrolledCourses.includes(doc.id))
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
      setEnrolledCourses(courses);
    } catch (error) {
      console.error("Error fetching enrolled courses:", error);
    }
  };

  const getCourseColor = (index) => {
    const colors = [
      "bg-blue-500",
      "bg-yellow-500",
      "bg-green-500",
      "bg-purple-500",
      "bg-pink-500",
      "bg-red-500",
      "bg-indigo-500",
      "bg-orange-500",
      "bg-teal-500",
      "bg-cyan-500",
    ];
    return colors[index % colors.length];
  };

  const menuItems = [
    { icon: Home, label: "Home", path: "/" },
    { icon: LinkIcon, label: "Quick Links", path: "/links" },
    { icon: GraduationCap, label: "Skills", path: "/skills" },
    { icon: TrendingUp, label: "Insights", path: "/insights" },
    { icon: Trophy, label: "Leaderboard", path: "/leaderboard" },
    // { icon: Calendar, label: 'Calendar', path: '/calendar' },
    // { icon: Clock, label: 'Timetable Creator', path: '/timetable' },
    // { icon: BookOpen, label: 'Resources', path: '/resources' },
    // { icon: Trophy, label: 'Resume', path: '/resume' },
    // { icon: Calculator, label: 'CGPA Calculator', path: '/cgpa' },
    // { icon: FileText, label: 'Miscellaneous', path: '/misc' },
    // { icon: Database, label: 'Seed Data', path: '/seed' },
  ];

  // Add College Admin menu item for college admins
  if (userProfile?.role === "collegeadmin") {
    menuItems.push({
      icon: Building2,
      label: "College Admin",
      path: "/collegeadmin",
    });
  }

  // Add Admin menu item for admins
  if (userProfile?.role === "admin" && userProfile?.adminCourses?.length > 0) {
    menuItems.push({ icon: Shield, label: "Admin Panel", path: "/admin" });
  }

  // SuperAdmins can see all admin pages
  if (userProfile?.role === "superadmin") {
    menuItems.push({ icon: Shield, label: "Admin Panel", path: "/admin" });
    menuItems.push({
      icon: Building2,
      label: "College Admin",
      path: "/collegeadmin",
    });
    menuItems.push({ icon: Shield, label: "Super Admin", path: "/superadmin" });
  }

  const isActive = (path) => location.pathname === path;

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden fixed top-4 right-4 z-50 p-2 bg-gray-900 text-white rounded-lg shadow-lg"
      >
        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Overlay for mobile */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
        w-64 bg-gray-900 text-white h-screen fixed left-0 top-0 flex flex-col z-40 transition-transform duration-300
        ${
          isMobileMenuOpen
            ? "translate-x-0"
            : "-translate-x-full lg:translate-x-0"
        }
      `}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">Course Portal</h1>
            {/* Dark Mode Toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
              title={
                isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"
              }
            >
              {isDarkMode ? (
                <Sun size={18} className="text-yellow-400" />
              ) : (
                <Moon size={18} className="text-gray-300" />
              )}
            </button>
          </div>
        </div>

        {/* Menu Items */}
        <nav className="flex-1 overflow-y-auto py-4">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setIsMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-6 py-3 transition-colors ${
                isActive(item.path)
                  ? "bg-blue-600 text-white"
                  : "text-gray-300 hover:bg-gray-800"
              }`}
            >
              <item.icon size={20} />
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* My Courses Section */}
        <div className="border-t border-gray-800 py-4">
          <div className="px-6 mb-2">
            <button
              onClick={() => setShowCourses(!showCourses)}
              className="w-full flex items-center justify-between text-sm font-semibold text-gray-400 hover:text-white transition-colors"
            >
              <span>My Courses</span>
              {showCourses ? (
                <ChevronUp size={16} />
              ) : (
                <ChevronDown size={16} />
              )}
            </button>
          </div>
          {showCourses && (
            <div className="px-6 space-y-1 max-h-64 overflow-y-auto">
              {enrolledCourses.length > 0 ? (
                enrolledCourses.map((course, index) => (
                  <Link
                    key={course.id}
                    to={`/course/${course.id}`}
                    className="flex items-center gap-2 py-2 text-sm text-gray-300 hover:text-white transition-colors"
                  >
                    <div
                      className={`w-2 h-2 rounded-full ${getCourseColor(
                        index
                      )}`}
                    ></div>
                    <span className="truncate">{course.name}</span>
                  </Link>
                ))
              ) : (
                <p className="text-sm text-gray-500 py-2">
                  No courses enrolled
                </p>
              )}
            </div>
          )}
        </div>

        {/* User Profile & Logout */}
        <div className="border-t border-gray-800 p-4">
          <Link
            to="/profile"
            className="flex items-center gap-3 mb-3 hover:bg-gray-800 p-2 rounded-lg transition-colors"
          >
            <Avatar
              photoURL={userProfile?.photoURL || user?.photoURL}
              displayName={userProfile?.displayName || user?.displayName}
              size="md"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {userProfile?.displayName || user?.displayName}
              </p>
              <p className="text-xs text-gray-400 truncate">{user?.email}</p>
            </div>
          </Link>
          <button
            onClick={() => {
              logout();
              toast.success("Logged out successfully");
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium transition-colors"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
