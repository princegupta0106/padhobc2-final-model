import { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "./AuthContext";

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const { userProfile, updateUserProfile } = useAuth();
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Check localStorage for saved preference as fallback
    const saved = localStorage.getItem("darkMode");
    return saved ? JSON.parse(saved) : true; // Default to dark mode
  });

  // Sync with userProfile when it loads
  useEffect(() => {
    if (userProfile) {
      // Use user's saved preference, default to true if not set
      const userPreference =
        userProfile.isDarkMode !== undefined ? userProfile.isDarkMode : true;
      setIsDarkMode(userPreference);
    }
  }, [userProfile]);

  useEffect(() => {
    // Save to localStorage whenever it changes
    localStorage.setItem("darkMode", JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  const toggleDarkMode = async () => {
    const newValue = !isDarkMode;
    setIsDarkMode(newValue);

    // Save to database if user is logged in
    if (userProfile && updateUserProfile) {
      try {
        await updateUserProfile({ isDarkMode: newValue });
      } catch (error) {
        console.error("Error saving theme preference:", error);
      }
    }
  };

  const value = {
    isDarkMode,
    toggleDarkMode,
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};
