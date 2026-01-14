import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { Code, TrendingUp, Package, Sparkles, DollarSign, BookOpen, ChevronRight, ArrowLeft } from 'lucide-react';
import Fuse from 'fuse.js';

const Skills = () => {
  const navigate = useNavigate();
  const { skillId } = useParams();
  const { userProfile } = useAuth();
  const [selectedSkill, setSelectedSkill] = useState(null);
  const [skillCourses, setSkillCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const skillCategories = [
    {
      id: 'tech',
      name: 'Technology',
      icon: Code,
      color: 'from-blue-500 to-blue-700',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600'
    },
    {
      id: 'productManagement',
      name: 'Product Management',
      icon: TrendingUp,
      color: 'from-purple-500 to-purple-700',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-600'
    },
    {
      id: 'supplyChain',
      name: 'Supply Chain',
      icon: Package,
      color: 'from-green-500 to-green-700',
      bgColor: 'bg-green-50',
      textColor: 'text-green-600'
    },
    {
      id: 'promptEngineering',
      name: 'Prompt Engineering',
      icon: Sparkles,
      color: 'from-pink-500 to-pink-700',
      bgColor: 'bg-pink-50',
      textColor: 'text-pink-600'
    },
    {
      id: 'finance',
      name: 'Finance',
      icon: DollarSign,
      color: 'from-yellow-500 to-yellow-700',
      bgColor: 'bg-yellow-50',
      textColor: 'text-yellow-600'
    }
  ];

  useEffect(() => {
    if (skillId) {
      // Find the skill from categories
      const skill = skillCategories.find(s => s.id === skillId);
      if (skill) {
        setSelectedSkill(skill);
        fetchSkillCourses(skillId);
      } else {
        navigate('/skills');
      }
    } else {
      setSelectedSkill(null);
      setSkillCourses([]);
      setSearchQuery('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skillId]);

  const fetchSkillCourses = async (skillId) => {
    try {
      setLoading(true);
      
      // Fetch skill document
      const skillDoc = await getDoc(doc(db, 'skills', skillId));
      
      if (skillDoc.exists()) {
        const courseIds = skillDoc.data().courses || [];
        
        // Fetch all courses for this skill
        const coursesPromises = courseIds.map(async (courseId) => {
          const courseDoc = await getDoc(doc(db, 'courses', courseId));
          if (courseDoc.exists()) {
            return { id: courseDoc.id, ...courseDoc.data() };
          }
          return null;
        });
        
        const courses = (await Promise.all(coursesPromises)).filter(c => c !== null);
        setSkillCourses(courses);
      } else {
        setSkillCourses([]);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching skill courses:', error);
      setLoading(false);
    }
  };

  const handleSkillClick = (skill) => {
    navigate(`/skills/${skill.id}`);
  };

  const handleBackToSkills = () => {
    navigate('/skills');
  };

  const filteredCourses = searchQuery
    ? new Fuse(skillCourses, {
        keys: ['name', 'code'],
        threshold: 0.3,
      }).search(searchQuery).map(result => result.item)
    : skillCourses;

  if (!userProfile?.collegeId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-lg shadow-sm text-center max-w-md">
          <BookOpen size={48} className="text-gray-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-800 mb-2">Access Restricted</h1>
          <p className="text-gray-600 text-sm">You need to be part of a college to access skills.</p>
        </div>
      </div>
    );
  }

  // Show skill categories
  if (!selectedSkill) {
    return (
      <div className="min-h-screen bg-gray-50 py-4 md:py-8">
        <div className="max-w-6xl mx-auto px-4 md:px-8">
          <div className="mb-8">
            <h1 className="text-2xl md:text-4xl font-bold text-gray-800 mb-2">Skills & Learning Paths</h1>
            <p className="text-gray-600">Choose a skill category to explore courses</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {skillCategories.map((skill) => {
              const Icon = skill.icon;
              return (
                <div
                  key={skill.id}
                  onClick={() => handleSkillClick(skill)}
                  className="group cursor-pointer"
                >
                  <div className={`bg-gradient-to-br ${skill.color} rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1`}>
                    <div className="flex items-center justify-between mb-4">
                      <div className={`p-3 ${skill.bgColor} rounded-lg bg-opacity-20`}>
                        <Icon size={32} className="text-white" />
                      </div>
                      <ChevronRight size={24} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">{skill.name}</h3>
                    <p className="text-white text-opacity-90 text-sm">Explore courses and resources</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Show courses for selected skill
  const Icon = selectedSkill.icon;
  
  return (
    <div className="min-h-screen bg-gray-50 py-4 md:py-8">
      <div className="max-w-6xl mx-auto px-4 md:px-8">
        <button
          onClick={handleBackToSkills}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6 transition-colors"
        >
          <ArrowLeft size={20} />
          <span>Back to Skills</span>
        </button>

        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-3 ${selectedSkill.bgColor} rounded-lg`}>
              <Icon size={32} className={selectedSkill.textColor} />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-800">{selectedSkill.name}</h1>
              <p className="text-gray-600 text-sm">{filteredCourses.length} courses available</p>
            </div>
          </div>

          {/* Search */}
          <input
            type="text"
            placeholder="Search courses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading courses...</p>
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen size={48} className="text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No courses available yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCourses.map((course) => (
              <div
                key={course.id}
                onClick={() => navigate(`/skill-course/${course.id}`)}
                className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden group"
              >
                <div className={`h-2 bg-gradient-to-r ${selectedSkill.color}`}></div>
                <div className="p-6">
                  <h3 className="text-lg font-bold text-gray-800 mb-2 group-hover:text-blue-600 transition-colors">
                    {course.name}
                  </h3>
                  {course.code && (
                    <p className="text-sm text-gray-500 mb-2">{course.code}</p>
                  )}
                  {course.semester && (
                    <p className="text-xs text-gray-400">{course.semester}</p>
                  )}
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-sm text-gray-500">
                      {course.folders?.length || 0} folders
                    </span>
                    <ChevronRight size={18} className="text-gray-400 group-hover:text-blue-600 transition-colors" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Skills;
