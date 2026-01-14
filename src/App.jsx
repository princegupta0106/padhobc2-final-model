import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import TimeTracker from "./components/TimeTracker";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Home from "./pages/Home";
import CoursePage from "./pages/CoursePage";
import SkillCoursePage from "./pages/SkillCoursePage";
import Profile from "./pages/Profile";
import UserProfile from "./pages/UserProfile";
import Seed from "./pages/Seed";
import Admin from "./pages/Admin";
import CollegeAdmin from "./pages/CollegeAdmin";
import SuperAdmin from "./pages/SuperAdmin";
import UploadResource from "./pages/UploadResource";
import Links from "./pages/Links";
import FileViewer from "./pages/FileViewer";
import Insights from "./pages/Insights";
import Leaderboard from "./pages/Leaderboard";
import Skills from "./pages/Skills";
import CollegeProfile from "./pages/CollegeProfile";
import BulkUpload from "./pages/BulkUpload";
import MigrateCourses from "./pages/MigrateCourses";
import FolderSync from "./pages/FolderSync";
import DatabaseDiagnostics from "./pages/DatabaseDiagnostics";
import NotFound from "./pages/NotFound";

// Protected Route wrapper
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }

  return user ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <ThemeProvider>
          <TimeTracker />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/user/:userId" element={<UserProfile />} />
            <Route path="/college/:collegeId" element={<CollegeProfile />} />
            <Route path="/viewer" element={<FileViewer />} />

            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Home />} />
              <Route path="links" element={<Links />} />
              <Route path="course/:courseId" element={<CoursePage />} />
              <Route
                path="course/:courseId/upload"
                element={<UploadResource />}
              />
              <Route
                path="skill-course/:courseId"
                element={<SkillCoursePage />}
              />
              <Route
                path="skill-course/:courseId/upload"
                element={<UploadResource />}
              />
              <Route path="profile" element={<Profile />} />
              <Route path="insights" element={<Insights />} />
              <Route path="leaderboard" element={<Leaderboard />} />
              <Route path="skills" element={<Skills />} />
              <Route path="skills/:skillId" element={<Skills />} />
              <Route path="seed" element={<Seed />} />
              <Route path="admin" element={<Admin />} />
              <Route path="collegeadmin" element={<CollegeAdmin />} />
              <Route path="superadmin" element={<SuperAdmin />} />
              <Route path="bulk-upload" element={<BulkUpload />} />
              <Route path="migrate-courses" element={<MigrateCourses />} />
              <Route path="folder-sync" element={<FolderSync />} />
              <Route
                path="database-diagnostics"
                element={<DatabaseDiagnostics />}
              />
              <Route
                path="calendar"
                element={<div className="p-8">Calendar - Coming Soon</div>}
              />
              <Route
                path="timetable"
                element={
                  <div className="p-8">Timetable Creator - Coming Soon</div>
                }
              />
              <Route
                path="resources"
                element={<div className="p-8">Resources - Coming Soon</div>}
              />
              <Route
                path="resume"
                element={<div className="p-8">Resume - Coming Soon</div>}
              />
              <Route
                path="cgpa"
                element={
                  <div className="p-8">CGPA Calculator - Coming Soon</div>
                }
              />
              <Route
                path="misc"
                element={<div className="p-8">Miscellaneous - Coming Soon</div>}
              />
            </Route>

            {/* 404 Not Found - Catch all unmatched routes */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ThemeProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
