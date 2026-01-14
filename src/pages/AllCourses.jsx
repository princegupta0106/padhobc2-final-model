import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { Search, BookOpen } from 'lucide-react';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import CourseCard from '../components/CourseCard';
import Fuse from 'fuse.js';
import { TypeAnimation } from 'react-type-animation';
import { useNavigate } from 'react-router-dom';

const AllCourses = () => {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [allCourses, setAllCourses] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [collegeFilter, setCollegeFilter] = useState('all');
  const [colleges, setColleges] = useState([]);
  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    if (!hasFetched && userProfile?.collegeId) {
      fetchData();
      setHasFetched(true);
    }
  }, [userProfile?.collegeId]);

  const fetchData = async () => {
    try {
      // Check if user has a valid college
      const userCollegeId = userProfile?.collegeId;
      
      if (!userCollegeId) {
        // User doesn't belong to any college - show no courses
        setColleges([]);
        setAllCourses([]);
        setLoading(false);
        return;
      }

      // Fetch all colleges
      const collegesSnapshot = await getDocs(collection(db, 'colleges'));
      const collegesList = collegesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Fetch all courses
      const coursesSnapshot = await getDocs(collection(db, 'courses'));
      const coursesList = coursesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Filter courses by user's college
      const filteredCourses = coursesList.filter(course => course.collegeId === userCollegeId);

      setColleges(collegesList);
      setAllCourses(filteredCourses);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
    }
  };

  // Configure Fuse.js for fuzzy search
  const fuse = useMemo(() => {
    return new Fuse(allCourses, {
      keys: ['name'],
      threshold: 0.6,
      ignoreLocation: true,
      minMatchCharLength: 1,
      distance: 100
    });
  }, [allCourses]);

  const filteredCourses = useMemo(() => {
    let results = allCourses;

    // Apply college filter
    if (collegeFilter !== 'all') {
      results = results.filter(course => course.collegeId === collegeFilter);
    }

    // Apply fuzzy search if there's a search query
    if (searchQuery.trim()) {
      const fuseResults = fuse.search(searchQuery);
      const searchedCourses = fuseResults.map(result => result.item);
      
      // Apply college filter to search results if needed
      if (collegeFilter !== 'all') {
        return searchedCourses.filter(course => course.collegeId === collegeFilter);
      }
      return searchedCourses;
    }

    return results;
  }, [allCourses, searchQuery, collegeFilter, fuse]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 md:py-6">
          <div className="flex items-center gap-3 mb-4 md:mb-6">
            <BookOpen size={28} className="text-blue-600 md:w-8 md:h-8" />
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">All Courses</h1>
          </div>
          
          {/* Search Bar */}
          <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder=""
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {!searchQuery && (
                <div className="absolute left-12 top-1/2 transform -translate-y-1/2 pointer-events-none text-gray-400">
                  <TypeAnimation
                    sequence={[
                      'Search across all colleges...',
                      2000,
                      'Search for Machine Learning...',
                      2000,
                      'Search for Data Structures...',
                      2000,
                      'Search for Algorithms...',
                      2000,
                    ]}
                    wrapper="span"
                    speed={50}
                    repeat={Infinity}
                  />
                </div>
              )}
            </div>

            {/* College Filter */}
            <select
              value={collegeFilter}
              onChange={(e) => setCollegeFilter(e.target.value)}
              className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="all">All Colleges</option>
              {colleges.map(college => (
                <option key={college.id} value={college.collegeId}>
                  {college.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Course Grid */}
      <div className="max-w-7xl mx-auto px-8 py-8">
        {!userProfile?.collegeId ? (
          <div className="text-center py-16 bg-white rounded-lg shadow-sm">
            <div className="max-w-md mx-auto">
              <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Access Restricted</h3>
              <p className="text-gray-600 mb-4">
                Your email domain is not associated with any registered institution.
              </p>
              <p className="text-sm text-gray-500">
                Please sign in with your institutional email address to access courses.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-4 text-gray-600">
              Showing {filteredCourses.length} course{filteredCourses.length !== 1 ? 's' : ''}
              {collegeFilter !== 'all' && ` from ${colleges.find(c => c.collegeId === collegeFilter)?.name}`}
            </div>

            {filteredCourses.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500 text-lg">No courses found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCourses.map((course, index) => (
              <div
                key={course.id}
                onClick={() => navigate(`/course/${course.id}`)}
                className="cursor-pointer"
              >
                <CourseCard course={course} index={index} />
              </div>
            ))}
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
};

export default AllCourses;
