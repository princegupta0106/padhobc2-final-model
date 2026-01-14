import { useNavigate } from "react-router-dom";
import { getPatternByIndex } from "../utils/patterns";
import { FileText } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

const CourseCard = ({ course, index }) => {
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();
  const pattern = getPatternByIndex(index);

  const handleClick = () => {
    navigate(`/course/${course.id}`);
  };

  return (
    <div
      onClick={handleClick}
      className={`rounded-lg overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1 ${
        isDarkMode
          ? "hover:shadow-2xl hover:shadow-gray-900/50"
          : "hover:shadow-2xl"
      }`}
      style={{ background: pattern.background }}
    >
      {/* Pattern overlay */}
      <div
        className="h-32 relative"
        style={{
          backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(
            pattern.pattern
          )}")`,
          backgroundRepeat: "repeat",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/20"></div>
      </div>

      {/* Content */}
      <div
        className={`p-4 md:p-5 h-24 flex items-center ${
          isDarkMode ? "bg-gray-800" : "bg-white"
        }`}
      >
        <h3
          className={`text-base md:text-lg font-semibold line-clamp-2 ${
            isDarkMode ? "text-white" : "text-gray-800"
          }`}
        >
          {course.name}
        </h3>
      </div>
    </div>
  );
};

export default CourseCard;
