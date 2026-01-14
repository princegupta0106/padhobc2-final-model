import { useNavigate } from 'react-router-dom';
import { getPatternByIndex } from '../utils/patterns';
import { FileText } from 'lucide-react';

const CourseCard = ({ course, index }) => {
  const navigate = useNavigate();
  const pattern = getPatternByIndex(index);

  const handleClick = () => {
    navigate(`/course/${course.id}`);
  };

  return (
    <div
      onClick={handleClick}
      className="rounded-lg overflow-hidden cursor-pointer hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
      style={{ background: pattern.background }}
    >
      {/* Pattern overlay */}
      <div
        className="h-32 relative"
        style={{
          backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(pattern.pattern)}")`,
          backgroundRepeat: 'repeat'
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/20"></div>
      </div>

      {/* Content */}
      <div className="bg-white p-4 md:p-5">
        <h3 className="text-base md:text-lg font-semibold text-gray-800 mb-2 line-clamp-2">
          {course.name}
        </h3>
      </div>
    </div>
  );
};

export default CourseCard;
