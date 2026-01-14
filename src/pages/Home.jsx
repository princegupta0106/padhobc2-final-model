import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';
import { Search, Filter, LayoutGrid, X } from 'lucide-react';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import CourseCard from '../components/CourseCard';
import Fuse from 'fuse.js';
import { TypeAnimation } from 'react-type-animation';
import toast, { Toaster } from 'react-hot-toast';

const Home = () => {
  const { user, userProfile } = useAuth();
  const [courses, setcourses] = useState([]);
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterView, setFilterView] = useState('enrolled'); // 'enrolled' or 'all'
  const [loading, setLoading] = useState(true);
  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    if (user && !hasFetched) {
      fetchCourses();
      setHasFetched(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const fetchCourses = async () => {
    try {
      // Fetch user's document directly by UID
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);
      
      if (!userDocSnap.exists()) {
        setEnrolledCourses([]);
        setcourses([]);
        setLoading(false);
        return;
      }

      const userData = userDocSnap.data();
      const enrolled = userData?.enrolledCourses || [];
      const userCollegeId = userData?.collegeId;

      // If user has no college assigned, don't fetch any courses
      if (!userCollegeId) {
        setEnrolledCourses([]);
        setcourses([]);
        setLoading(false);
        return;
      }

      // Fetch the user's college document
      const userCollegeSnapshot = await getDocs(query(
        collection(db, 'colleges'),
        where('collegeId', '==', userCollegeId)
      ));

      if (userCollegeSnapshot.empty) {
        // College not found
        setEnrolledCourses([]);
        setcourses([]);
        setLoading(false);
        return;
      }

      const userCollegeData = userCollegeSnapshot.docs[0].data();
      const collegeCourseIds = userCollegeData.courses || [];

      if (collegeCourseIds.length === 0) {
        // No courses in this college
        setEnrolledCourses([]);
        setcourses([]);
        setLoading(false);
        return;
      }

      // Fetch only courses for this college using where query
      const coursesQuery = query(
        collection(db, 'courses'),
        where('collegeId', '==', userCollegeId)
      );
      const coursesSnapshot = await getDocs(coursesQuery);
      const allCourses = coursesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setEnrolledCourses(enrolled);
      setcourses(allCourses);
      
      // If user has no enrolled courses, automatically switch to "all" view
      if (enrolled.length === 0) {
        setFilterView('all');
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching courses:', error);
      setLoading(false);
    }
  };

  const handleEnroll = async (courseId) => {
    try {
      const userDocRef = doc(db, 'users', user.uid);

      await updateDoc(userDocRef, {
        enrolledCourses: arrayUnion(courseId)
      });

      setEnrolledCourses([...enrolledCourses, courseId]);
      toast.success('Enrolled successfully');
    } catch (error) {
      console.error('Error enrolling in course:', error);
      toast.error('Failed to enroll');
    }
  };

  const handleUnenroll = async (courseId) => {
    try {
      const userDocRef = doc(db, 'users', user.uid);

      await updateDoc(userDocRef, {
        enrolledCourses: arrayRemove(courseId)
      });

      setEnrolledCourses(enrolledCourses.filter(id => id !== courseId));
      toast.success('Unenrolled successfully');
    } catch (error) {
      console.error('Error unenrolling from course:', error);
      toast.error('Failed to unenroll');
    }
  };

  // Configure Fuse.js for fuzzy search
  const fuse = useMemo(() => {
    return new Fuse(courses, {
      keys: ['name'],
      threshold: 0.6, // More lenient - 0 = exact match, 1 = match anything
      ignoreLocation: true,
      minMatchCharLength: 1, // Match even single characters
      distance: 100
    });
  }, [courses]);

  const filteredCourses = useMemo(() => {
    let results = courses;

    // Apply fuzzy search if there's a search query
    if (searchQuery.trim()) {
      const fuseResults = fuse.search(searchQuery);
      results = fuseResults.map(result => result.item);
      // When searching, show all matching courses regardless of filter
      return results;
    }

    // Apply enrollment filter only when not searching
    if (filterView === 'enrolled') {
      results = results.filter(course => enrolledCourses.includes(course.id));
    }

    return results;
  }, [courses, searchQuery, filterView, enrolledCourses, fuse]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: { background: '#363636', color: '#fff' },
          success: { style: { background: '#10b981' } },
          error: { style: { background: '#ef4444' } },
        }}
      />
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 md:py-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-4 md:mb-6">Course Overview</h1>
          
          {/* Search and Filter Bar */}
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
                      'Search for Machine Learning...',
                      2000,
                      'Search for Data Structures...',
                      2000,
                      'Search for Artificial Intelligence...',
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
            
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setFilterView('enrolled')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  filterView === 'enrolled'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Filter size={16} className="inline mr-2" />
                My Courses
              </button>
              <button
                onClick={() => setFilterView('all')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  filterView === 'all'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                All Courses
              </button>
            </div>
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
                Your email domain ({user?.email?.split('@')[1]}) is not associated with any registered institution.
              </p>
              <p className="text-sm text-gray-500">
                Please sign in with your institutional email address to access courses.
              </p>
            </div>
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500 text-lg">No courses found</p>
            {filterView === 'enrolled' && (
              <button
                onClick={() => setFilterView('all')}
                className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
              >
                View all courses
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCourses.map((course, index) => (
              <div key={course.id} className="relative group">
                <CourseCard course={course} index={index} />
                
                {/* Enroll/Unenroll button */}
                <div className="absolute top-4 right-4 transition-opacity">
                  {enrolledCourses.includes(course.id) ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUnenroll(course.id);
                      }}
                      className="p-1 hover:bg-gray-100 rounded transition-colors"
                      title="Unenroll"
                    >
                      <X size={20} strokeWidth={3} className="text-gray-700" />
                    </button>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEnroll(course.id);
                      }}
                      className="px-3 py-1 bg-green-500 text-white text-sm rounded-full hover:bg-green-600 transition-colors"
                    >
                      Enroll
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
