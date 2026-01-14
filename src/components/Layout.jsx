import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import { useTheme } from "../context/ThemeContext";

const Layout = () => {
  const { isDarkMode } = useTheme();

  return (
    <div
      className={`flex h-screen overflow-hidden ${
        isDarkMode ? "bg-gray-900" : "bg-gray-50"
      }`}
    >
      <Sidebar />
      <main className="flex-1 lg:ml-64 overflow-y-auto overflow-x-hidden w-full">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
