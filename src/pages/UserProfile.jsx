import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { ArrowLeft, User, Mail, Building2, Award, Calendar, FileText, Shield, Crown, BookOpen, Star } from 'lucide-react';
import Avatar from '../components/Avatar';

const UserProfile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [userProfile, setUserProfile] = useState(null);
  const [college, setCollege] = useState(null);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [adminCourses, setAdminCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    if (!hasFetched) {
      fetchUserProfile();
      setHasFetched(true);
    }
  }, [userId]);

  const fetchUserProfile = async () => {
    try {
      // Fetch user profile
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setUserProfile(userData);

        // Fetch college info using where query
        if (userData.collegeId) {
          const collegesQuery = query(
            collection(db, 'colleges'),
            where('collegeId', '==', userData.collegeId)
          );
          const collegesSnapshot = await getDocs(collegesQuery);
          if (!collegesSnapshot.empty) {
            setCollege(collegesSnapshot.docs[0].data());
          }
        }

        // Fetch admin courses if user is admin (only their courses)
        if (userData.role === 'admin' && userData.adminCourses?.length > 0) {
          // For small arrays, fetch individually is more efficient than fetching all
          const coursesPromises = userData.adminCourses.map(courseId => 
            getDoc(doc(db, 'courses', courseId))
          );
          const courseDocs = await Promise.all(coursesPromises);
          const courses = courseDocs
            .filter(doc => doc.exists())
            .map(doc => ({
              id: doc.id,
              ...doc.data()
            }));
          setAdminCourses(courses);
        }

        // Fetch folders uploaded by this user
        const foldersQuery = query(
          collection(db, 'folders'),
          where('uploadedById', '==', userId)
        );
        const foldersSnapshot = await getDocs(foldersQuery);
        
        // Count all files uploaded
        let totalFiles = 0;
        const filesList = [];
        foldersSnapshot.docs.forEach(folderDoc => {
          const folderData = folderDoc.data();
          const filesCount = folderData.files?.length || 0;
          totalFiles += filesCount;
          
          if (folderData.files) {
            folderData.files.forEach(file => {
              filesList.push({
                fileName: file.name,
                folderName: folderData.name,
                courseId: folderData.courseId,
                uploadedAt: folderData.uploadedAt
              });
            });
          }
        });

        setUploadedFiles(filesList);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setLoading(false);
    }
  };

  const getRoleBadge = () => {
    if (!userProfile?.role) return null;

    const roleConfig = {
      superadmin: {
        label: 'Super Admin',
        icon: Crown,
        bgColor: 'bg-gradient-to-r from-yellow-400 to-orange-500',
        textColor: 'text-white'
      },
      collegeadmin: {
        label: 'College Admin',
        icon: Building2,
        bgColor: 'bg-gradient-to-r from-purple-500 to-purple-600',
        textColor: 'text-white'
      },
      admin: {
        label: 'Course Admin',
        icon: Shield,
        bgColor: 'bg-gradient-to-r from-blue-500 to-blue-600',
        textColor: 'text-white'
      }
    };

    const config = roleConfig[userProfile.role];
    if (!config) return null;

    const Icon = config.icon;
    return (
      <div className={`inline-flex items-center gap-1.5 md:gap-2 px-2 md:px-4 py-1.5 md:py-2 rounded-full ${config.bgColor} ${config.textColor} font-semibold shadow-lg text-xs md:text-sm`}>
        <Icon size={16} className="md:w-5 md:h-5" />
        <span>{config.label}</span>
      </div>
    );
  };

  const getPremiumBadge = () => {
    if (!userProfile?.isPremium) return null;

    return (
      <div className="inline-flex items-center gap-1.5 md:gap-2 px-2 md:px-4 py-1.5 md:py-2 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 text-white font-semibold shadow-lg text-xs md:text-sm">
        <Star size={16} className="fill-current md:w-5 md:h-5" />
        <span>Premium Member</span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl text-gray-600">Loading profile...</div>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl text-gray-600">User not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-4 md:py-8">
      <div className="max-w-4xl mx-auto px-4 md:px-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6"
        >
          <ArrowLeft size={20} />
          <span>Back</span>
        </button>

        {/* Profile Header */}
        <div className="bg-white rounded-lg shadow-sm p-4 md:p-8 mb-6">
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            <div className="relative mx-auto md:mx-0 flex-shrink-0">
              <Avatar
                photoURL={userProfile.photoURL}
                displayName={userProfile.displayName}
                size="xl"
                className="border-4 border-blue-100"
              />
              {userProfile.isPremium && (
                <div className="absolute -top-2 -right-2 bg-gradient-to-r from-amber-400 to-yellow-500 rounded-full p-2 shadow-lg">
                  <Star size={16} className="text-white fill-current md:w-5 md:h-5" />
                </div>
              )}
            </div>
            
            <div className="flex-1 w-full min-w-0">
              <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-3">
                <h1 className="text-xl md:text-3xl font-bold text-gray-800 break-words">
                  {userProfile.displayName}
                </h1>
                <div className="flex flex-wrap gap-2">
                  {getRoleBadge()}
                  {getPremiumBadge()}
                </div>
              </div>
              
              <div className="space-y-2 mb-4">
                <div className="flex items-start gap-2 text-gray-600 text-sm md:text-base">
                  <Mail size={18} className="flex-shrink-0 mt-0.5" />
                  <span className="break-all text-sm">{userProfile.email}</span>
                </div>
                
                {college && (
                  <div className="flex items-center gap-2 text-gray-600 text-sm md:text-base">
                    <Building2 size={18} className="flex-shrink-0" />
                    <span className="truncate">{college.name}</span>
                  </div>
                )}
                
                <div className="flex items-center gap-2 text-gray-600 text-sm md:text-base">
                  <Calendar size={18} className="flex-shrink-0" />
                  <span>Joined {new Date(userProfile.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              {userProfile.bio && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-gray-700 mb-1">About</p>
                  <p className="text-gray-700 break-words text-sm md:text-base">{userProfile.bio}</p>
                </div>
              )}
            </div>

            {/* Stats Card */}
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-4 md:p-6 text-white w-full md:w-auto md:min-w-[180px] lg:max-w-[200px] flex-shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <Award size={20} className="md:w-6 md:h-6 flex-shrink-0" />
                <span className="text-xs md:text-sm font-medium">Contributions</span>
              </div>
              <div className="text-4xl md:text-5xl font-bold">{userProfile.contributions || 0}</div>
              <p className="text-xs md:text-sm text-blue-100 mt-2">Files uploaded</p>
            </div>
          </div>
        </div>

        {/* Admin Courses Section */}
        {adminCourses.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-4 md:p-8 mb-6">
            <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-4 md:mb-6 flex items-center gap-2">
              <Shield size={20} className="text-blue-600 md:w-6 md:h-6" />
              Admin of Courses
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {adminCourses.map((course) => (
                <div
                  key={course.id}
                  onClick={() => navigate(`/course/${course.id}`)}
                  className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg hover:shadow-md transition-all cursor-pointer border border-blue-200"
                >
                  <BookOpen size={20} className="text-blue-600 flex-shrink-0 md:w-6 md:h-6" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-800 text-sm md:text-base break-words">{course.name}</div>
                    <div className="text-xs md:text-sm text-gray-600">Click to view course</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {userProfile.role === 'collegeadmin' && (
          <div className="bg-white rounded-lg shadow-sm p-4 md:p-8 mb-6">
            <div className="flex items-center gap-3 p-4 md:p-6 bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg text-white">
              <Building2 size={24} className="flex-shrink-0 md:w-8 md:h-8" />
              <div className="min-w-0 flex-1">
                <h3 className="text-lg md:text-xl font-bold">College Administrator</h3>
                <p className="text-purple-100 text-sm md:text-base break-words">Manages all courses and admins for {college?.name}</p>
              </div>
            </div>
          </div>
        )}

        {userProfile.role === 'superadmin' && (
          <div className="bg-white rounded-lg shadow-sm p-4 md:p-8 mb-6">
            <div className="flex items-center gap-3 p-4 md:p-6 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-lg text-white">
              <Crown size={24} className="flex-shrink-0 md:w-8 md:h-8" />
              {/* <div className="min-w-0 flex-1">
                <h3 className="text-lg md:text-xl font-bold">Super Administrator</h3>
                <p className="text-yellow-100 text-sm md:text-base">Has full system access and control</p>
              </div> */}
            </div>
          </div>
        )}

        {/* Uploaded Files */}
        <div className="bg-white rounded-lg shadow-sm p-4 md:p-8">
          <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-4 md:mb-6 flex items-center gap-2">
            <FileText size={20} className="md:w-6 md:h-6" />
            Recent Uploads
          </h2>

          {uploadedFiles.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No uploads yet
            </div>
          ) : (
            <div className="space-y-3 overflow-hidden">
              {uploadedFiles.slice(0, 10).map((file, index) => (
                <div
                  key={index}
                  className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 p-3 md:p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <FileText size={20} className="text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0 w-full">
                    <div className="font-medium text-gray-800 break-words text-sm md:text-base">{file.fileName}</div>
                    <div className="text-xs md:text-sm text-gray-500 truncate">
                      in folder: {file.folderName}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 flex-shrink-0">
                    {new Date(file.uploadedAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
