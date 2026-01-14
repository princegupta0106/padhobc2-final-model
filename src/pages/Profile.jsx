import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import Avatar from "../components/Avatar";
import { Camera, Save, User, Eye } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

const Profile = () => {
  const navigate = useNavigate();
  const { user, userProfile, updateUserProfile, uploadProfileImage } =
    useAuth();
  const { isDarkMode } = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(
    userProfile?.displayName || ""
  );
  const [bio, setBio] = useState(userProfile?.bio || "");
  const [collegeId, setCollegeId] = useState(
    userProfile?.collegeId || "BITS_PILANI"
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const colleges = [
    { id: "BITS_PILANI", name: "BITS Pilani" },
    { id: "IIT_BOMBAY", name: "IIT Bombay" },
    { id: "IIT_DELHI", name: "IIT Delhi" },
    { id: "IIT_MADRAS", name: "IIT Madras" },
    { id: "IIT_KANPUR", name: "IIT Kanpur" },
    { id: "NIT_TRICHY", name: "NIT Trichy" },
    { id: "IIIT_HYDERABAD", name: "IIIT Hyderabad" },
    { id: "OTHER", name: "Other" },
  ];

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size should be less than 5MB");
      return;
    }

    try {
      setUploading(true);
      await uploadProfileImage(file);
      toast.success("Profile picture updated successfully");
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Failed to upload image. Please try again");
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      await updateUserProfile({
        displayName,
        bio,
        // collegeId removed - users cannot change their college
      });
      setIsEditing(false);
      toast.success("Profile updated successfully");
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile. Please try again");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDisplayName(userProfile?.displayName || "");
    setBio(userProfile?.bio || "");
    setCollegeId(userProfile?.collegeId || "BITS_PILANI");
    setIsEditing(false);
  };

  return (
    <div
      className={`min-h-screen py-4 md:py-8 ${
        isDarkMode ? "bg-gray-900" : "bg-gray-50"
      }`}
    >
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: { background: "#363636", color: "#fff" },
          success: { style: { background: "#10b981" } },
          error: { style: { background: "#ef4444" } },
        }}
      />
      <div className="max-w-4xl mx-auto px-4 md:px-8">
        <div
          className={`rounded-lg shadow-sm p-4 md:p-8 ${
            isDarkMode ? "bg-gray-800" : "bg-white"
          }`}
        >
          <h1
            className={`text-2xl md:text-3xl font-bold mb-6 md:mb-8 ${
              isDarkMode ? "text-white" : "text-gray-800"
            }`}
          >
            Profile
          </h1>

          <div className="flex flex-col md:flex-row gap-8">
            {/* Profile Picture Section */}
            <div className="flex flex-col items-center">
              <div className="relative">
                <Avatar
                  photoURL={userProfile?.photoURL || user?.photoURL}
                  displayName={userProfile?.displayName || user?.displayName}
                  size="xl"
                  className="mx-auto"
                />
                <label
                  htmlFor="profile-upload"
                  className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full cursor-pointer hover:bg-blue-700 transition-colors"
                >
                  {uploading ? (
                    <div className="animate-spin">⏳</div>
                  ) : (
                    <Camera size={18} />
                  )}
                </label>
                <input
                  id="profile-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  disabled={uploading}
                />
              </div>
              <p className="text-sm text-gray-500 mt-4 text-center">
                Click camera icon to upload new photo
              </p>
              <p className="text-xs text-gray-400 mt-1">Max size: 5MB</p>
            </div>

            {/* Profile Information Section */}
            <div className="flex-1">
              <div className="space-y-6">
                {/* Display Name */}
                <div>
                  <label
                    className={`block text-sm font-medium mb-2 ${
                      isDarkMode ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    Display Name
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        isDarkMode
                          ? "bg-gray-700 border-gray-600 text-white"
                          : "border-gray-300 text-gray-900"
                      }`}
                      placeholder="Enter your name"
                    />
                  ) : (
                    <p
                      className={`text-lg ${
                        isDarkMode ? "text-white" : "text-gray-800"
                      }`}
                    >
                      {userProfile?.displayName || "Not set"}
                    </p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label
                    className={`block text-sm font-medium mb-2 ${
                      isDarkMode ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    Email
                  </label>
                  <p className={isDarkMode ? "text-gray-400" : "text-gray-600"}>
                    {user?.email}
                  </p>
                </div>

                {/* College */}
                <div>
                  <label
                    className={`block text-sm font-medium mb-2 ${
                      isDarkMode ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    College
                  </label>
                  <p className={isDarkMode ? "text-white" : "text-gray-800"}>
                    {colleges.find((c) => c.id === userProfile?.collegeId)
                      ?.name || "Not set"}
                  </p>
                  {isEditing && (
                    <p className="text-xs text-gray-500 mt-1">
                      College cannot be changed after registration
                    </p>
                  )}
                </div>

                {/* Bio */}
                <div>
                  <label
                    className={`block text-sm font-medium mb-2 ${
                      isDarkMode ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    Bio
                  </label>
                  {isEditing ? (
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      rows={4}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        isDarkMode
                          ? "bg-gray-700 border-gray-600 text-white"
                          : "border-gray-300 text-gray-900"
                      }`}
                      placeholder="Tell us about yourself..."
                    />
                  ) : (
                    <p className={isDarkMode ? "text-white" : "text-gray-800"}>
                      {userProfile?.bio || "No bio added yet"}
                    </p>
                  )}
                </div>

                {/* Contributions */}
                <div>
                  <label
                    className={`block text-sm font-medium mb-2 ${
                      isDarkMode ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    Contributions
                  </label>
                  <p className="text-2xl font-bold text-blue-600">
                    {userProfile?.contributions || 0}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-4 pt-4">
                  {isEditing ? (
                    <>
                      <button
                        onClick={handleSaveProfile}
                        disabled={saving}
                        className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400"
                      >
                        <Save size={18} />
                        {saving ? "Saving..." : "Save Changes"}
                      </button>
                      <button
                        onClick={handleCancel}
                        disabled={saving}
                        className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setIsEditing(true)}
                        className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <User size={18} />
                        Edit Profile
                      </button>
                      <button
                        onClick={() => navigate(`/user/${user.uid}`)}
                        className="flex items-center gap-2 px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        <Eye size={18} />
                        View My Profile
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
