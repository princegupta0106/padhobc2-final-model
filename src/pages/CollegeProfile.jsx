import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { ArrowLeft, Building2, BookOpen, Users, Link as LinkIcon, Globe, Mail } from 'lucide-react';

const CollegeProfile = () => {
  const { collegeId } = useParams();
  const navigate = useNavigate();
  const [college, setCollege] = useState(null);
  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    if (!hasFetched) {
      fetchCollegeData();
      setHasFetched(true);
    }
  }, [collegeId]);

  const fetchCollegeProfile = async () => {
    try {
      // Fetch college details
      const collegesQuery = query(
        collection(db, 'colleges'),
        where('collegeId', '==', collegeId)
      );
      const collegesSnapshot = await getDocs(collegesQuery);
      
      if (!collegesSnapshot.empty) {
        const collegeData = {
          id: collegesSnapshot.docs[0].id,
          ...collegesSnapshot.docs[0].data()
        };
        setCollege(collegeData);

        // Fetch courses for this college
        const coursesQuery = query(
          collection(db, 'courses'),
          where('collegeId', '==', collegeId)
        );
        const coursesSnapshot = await getDocs(coursesQuery);
        const coursesList = coursesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setCourses(coursesList);

        // Fetch students count
        const studentsQuery = query(
          collection(db, 'users'),
          where('collegeId', '==', collegeId)
        );
        const studentsSnapshot = await getDocs(studentsQuery);
        setStudents(studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching college profile:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!college) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Building2 size={64} className="text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">College Not Found</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6"
        >
          <ArrowLeft size={20} />
          Back
        </button>

        {/* College Header */}
        <div className="bg-white rounded-lg shadow-sm p-8 mb-6">
          <div className="flex items-start gap-6">
            {college.logo && (
              <img
                src={college.logo}
                alt={college.name}
                className="w-24 h-24 object-contain rounded-lg border border-gray-200"
              />
            )}
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-800 mb-2">{college.name}</h1>
              <p className="text-gray-600 mb-4">{college.collegeId}</p>
              
              <div className="flex flex-wrap gap-4">
                {college.extensionUrl && (
                  <a
                    href={college.extensionUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
                  >
                    <Globe size={18} />
                    <span>Website</span>
                  </a>
                )}
                {college.emailExtensions && college.emailExtensions.length > 0 && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Mail size={18} />
                    <div className="flex flex-wrap gap-1">
                      {college.emailExtensions.map((ext, index) => (
                        <span key={index} className="bg-gray-100 px-2 py-1 rounded text-sm">
                          {ext}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-sm p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <BookOpen size={32} />
              <span className="text-3xl font-bold">{courses.length}</span>
            </div>
            <h3 className="text-sm font-medium opacity-90">Total Courses</h3>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-sm p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <Users size={32} />
              <span className="text-3xl font-bold">{students.length}</span>
            </div>
            <h3 className="text-sm font-medium opacity-90">Total Students</h3>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-sm p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <LinkIcon size={32} />
              <span className="text-3xl font-bold">{college.links?.length || 0}</span>
            </div>
            <h3 className="text-sm font-medium opacity-90">Quick Links</h3>
          </div>
        </div>

        {/* Quick Links */}
        {college.links && college.links.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Quick Links</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {college.links.map((link, index) => (
                <a
                  key={index}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                >
                  <LinkIcon size={20} className="text-blue-600" />
                  <span className="font-medium text-gray-800">{link.name}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Courses List */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Available Courses</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.length === 0 ? (
              <div className="col-span-full text-center py-12 text-gray-500">
                <BookOpen size={48} className="mx-auto mb-4 opacity-50" />
                <p>No courses available yet</p>
              </div>
            ) : (
              courses.map(course => (
                <div
                  key={course.id}
                  className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                >
                  <h3 className="font-semibold text-gray-800 mb-2">{course.name}</h3>
                  <p className="text-sm text-gray-600">
                    {course.folders?.length || 0} folders
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CollegeProfile;
