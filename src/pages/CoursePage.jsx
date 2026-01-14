import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, addDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { ref, deleteObject, uploadBytes, getDownloadURL } from 'firebase/storage';
import { ChevronDown, ChevronRight, Folder, FileText, Upload, Trash2, ArrowLeft, Star, Newspaper, X, Plus } from 'lucide-react';
import { db, storage } from '../firebase/config';
import toast, { Toaster } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import Fuse from 'fuse.js';
import { TypeAnimation } from 'react-type-animation';
import Avatar from '../components/Avatar';
import { updateUserXP } from '../utils/xpCalculator';
import pako from 'pako';

const CoursePage = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const [course, setCourse] = useState(null);
  const [resources, setResources] = useState([]);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [leaderboard, setLeaderboard] = useState([]);
  const [userContributions, setUserContributions] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [courseAdmins, setCourseAdmins] = useState([]);
  const [showAddNews, setShowAddNews] = useState(false);
  const [newsTitle, setNewsTitle] = useState('');
  const [newsText, setNewsText] = useState('');
  const [newsFiles, setNewsFiles] = useState([]);
  const [uploadingNews, setUploadingNews] = useState(false);
  const [expandedNews, setExpandedNews] = useState(new Set());

  useEffect(() => {
    fetchCourseData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  const fetchCourseData = async () => {
    try {
      // Fetch course details first to check if it's a skill course
      const courseDoc = await getDoc(doc(db, 'courses', courseId));
      if (!courseDoc.exists()) {
        navigate('/');
        return;
      }

      const courseData = { id: courseDoc.id, ...courseDoc.data() };
      setCourse(courseData);

      // If course has no collegeId, it's a skill course - allow access to everyone
      if (!courseData.collegeId) {
        // Skip college access check for skill courses
      } else {
        // Regular course - check college access
        if (!userProfile?.collegeId) {
          // User has no college - redirect to home
          navigate('/');
          return;
        }

        // Fetch user's college to check course access and group
        const userCollegeQuery = query(
          collection(db, 'colleges'),
          where('collegeId', '==', userProfile.collegeId)
        );
        const userCollegeSnapshot = await getDocs(userCollegeQuery);
        
        if (userCollegeSnapshot.empty) {
          // College not found - redirect
          navigate('/');
          return;
        }

        const userCollegeData = userCollegeSnapshot.docs[0].data();
        const hasAccess = (userCollegeData.courses || []).includes(courseId);

        // Check if user has access to this course
        if (!hasAccess) {
          toast.error('Access denied. This course is not available in your college.');
          navigate('/');
          return;
        }
      }

      // Use folders from course document instead of querying all folders
      const foldersMetadata = courseData.folders || [];
      
      // Check if folders array contains IDs (strings) or full objects
      let foldersList = [];
      if (foldersMetadata.length > 0) {
        // If first element is a string, we have folder IDs - fetch the actual folders
        if (typeof foldersMetadata[0] === 'string') {
          const folderPromises = foldersMetadata.map(folderId => 
            getDoc(doc(db, 'folders', folderId))
          );
          const folderDocs = await Promise.all(folderPromises);
          foldersList = folderDocs
            .filter(doc => doc.exists())
            .map(doc => ({ id: doc.id, ...doc.data() }));
        } else {
          // Already have full folder objects
          foldersList = foldersMetadata;
        }
      }
      
      // Sort folders: important first, then by name
      foldersList.sort((a, b) => {
        if (a.isImportant && !b.isImportant) return -1;
        if (!a.isImportant && b.isImportant) return 1;
        return a.name.localeCompare(b.name);
      });

      setResources(foldersList);

      // Fetch leaderboard data (top contributors from same college)
      if (userProfile?.collegeId) {
        const usersQuery = query(
          collection(db, 'users'),
          where('collegeId', '==', userProfile.collegeId)
        );
        const usersSnapshot = await getDocs(usersQuery);
        const users = usersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Sort by contributions and get top 3
        const topContributors = users
          .sort((a, b) => (b.contributions || 0) - (a.contributions || 0))
          .slice(0, 3)
          .map((user, index) => ({
            id: user.id,
            name: user.displayName,
            contributions: user.contributions || 0,
            photoURL: user.photoURL,
            rank: index + 1
          }));

        setLeaderboard(topContributors);

        // Get current user's contributions
        const currentUser = users.find(u => u.uid === user?.uid);
        setUserContributions(currentUser?.contributions || 0);
        
        // Fetch course admins (users who have this course in their adminCourses array)
        const adminsQuery = query(
          collection(db, 'users'),
          where('adminCourses', 'array-contains', courseId)
        );
        const adminsSnapshot = await getDocs(adminsQuery);
        const admins = adminsSnapshot.docs.map(doc => ({
          uid: doc.data().uid,
          displayName: doc.data().displayName,
          photoURL: doc.data().photoURL,
          email: doc.data().email,
          role: doc.data().role
        }));
        
        // Filter out superadmins from the course admins list
        const filteredAdmins = admins.filter(admin => admin.role !== 'superadmin');
        setCourseAdmins(filteredAdmins);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching course data:', error);
      setLoading(false);
    }
  };

  const organizeResources = (resourcesList) => {
    // Return folders as-is
    return resourcesList;
  };

  // Fuzzy search for resources (folders and files)
  const filteredResources = useMemo(() => {
    if (!searchQuery.trim()) {
      return resources;
    }

    // Create searchable items from folders and their files
    const searchableItems = [];
    resources.forEach(folder => {
      // Add folder itself
      searchableItems.push({
        type: 'folder',
        data: folder,
        searchText: folder.name
      });
      
      // Add files within folder
      if (folder.files) {
        folder.files.forEach(file => {
          searchableItems.push({
            type: 'file',
            data: folder,
            fileData: file,
            searchText: `${folder.name} ${file.name}`
          });
        });
      }
    });

    const fuse = new Fuse(searchableItems, {
      keys: ['searchText'],
      threshold: 0.4,
      distance: 100,
      minMatchCharLength: 1
    });

    const results = fuse.search(searchQuery);
    
    // Get unique folders from search results
    const folderIds = new Set();
    results.forEach(result => {
      folderIds.add(result.item.data.id);
    });

    return resources.filter(folder => folderIds.has(folder.id));
  }, [resources, searchQuery]);

  const canDeleteFromCourse = () => {
    // Superadmins can delete from any course
    if (userProfile?.role === 'superadmin') {
      return true;
    }
    
    // Admins can only delete from courses they manage
    if (userProfile?.role === 'admin' && userProfile?.adminCourses?.includes(courseId)) {
      return true;
    }
    
    return false;
  };

  const deleteFolder = async (folderId) => {
    if (!window.confirm('Are you sure you want to delete this folder? All files will be removed.')) {
      return;
    }

    try {
      // Get folder to count files
      const folderDoc = await getDoc(doc(db, 'folders', folderId));
      const folderData = folderDoc.data();
      const filesCount = folderData?.files?.length || 0;
      const uploaderId = folderData?.uploadedById;

      // Soft delete folder by marking it as deleted
      await updateDoc(doc(db, 'folders', folderId), {
        deleted: true,
        deletedAt: new Date().toISOString(),
        deletedBy: user.uid
      });

      // Update course to remove this folder metadata from folders array
      const courseRef = doc(db, 'courses', courseId);
      const courseDoc = await getDoc(courseRef);
      if (courseDoc.exists()) {
        const currentFolders = courseDoc.data().folders || [];
        const updatedFolders = currentFolders.filter(f => f.id !== folderId);
        await updateDoc(courseRef, { folders: updatedFolders });
      }

      // Contributions updated automatically by cloud function

      // Refresh data
      await fetchCourseData();
      toast.success('Folder deleted successfully');
    } catch (error) {
      console.error('Error deleting folder:', error);
      toast.error('Failed to delete folder');
    }
  };

  const deleteFile = async (folderId, fileIndex, fileUrl) => {
    if (!window.confirm('Are you sure you want to delete this file?')) {
      return;
    }

    try {
      // Get folder document
      const folderRef = doc(db, 'folders', folderId);
      const folderDoc = await getDoc(folderRef);
      
      if (folderDoc.exists()) {
        const folderData = folderDoc.data();
        const currentFiles = folderData.files || [];
        const uploaderId = folderData.uploadedById;
        const updatedFiles = currentFiles.filter((_, index) => index !== fileIndex);
        
        // Update folder with new files array
        await updateDoc(folderRef, { files: updatedFiles });
        
        // Delete file from storage
        try {
          const fileRef = ref(storage, fileUrl);
          await deleteObject(fileRef);
        } catch (storageError) {
          console.warn('Could not delete file from storage:', storageError);
        }

        // Contributions updated automatically by cloud function
        
        // Refresh data
        await fetchCourseData();
        toast.success('File deleted successfully');
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      toast.error('Failed to delete file');
    }
  };

  const toggleFolder = async (folderId) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
        // Fetch folder details if not already loaded
        fetchFolderDetails(folderId);
      }
      return newSet;
    });
  };

  const fetchFolderDetails = async (folderId) => {
    // Check if folder already has files loaded
    const folder = resources.find(r => r.id === folderId);
    if (folder && folder.files) {
      return; // Already loaded
    }

    try {
      // Fetch the full folder document with files
      const folderDoc = await getDoc(doc(db, 'folders', folderId));
      if (folderDoc.exists()) {
        const folderData = folderDoc.data();
        // Update the resources with full folder data
        setResources(prev => prev.map(r => 
          r.id === folderId ? { ...r, ...folderData } : r
        ));
      }
    } catch (error) {
      console.error('Error fetching folder details:', error);
    }
  };

  const toggleNews = (index) => {
    setExpandedNews(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const canManageNews = () => {
    if (userProfile?.role === 'superadmin') return true;
    if (userProfile?.role === 'admin' && userProfile?.adminCourses?.includes(courseId)) return true;
    return false;
  };

  const handleAddNews = async () => {
    if (!newsTitle.trim() || !newsText.trim()) {
      toast.error('Please fill in title and text');
      return;
    }

    try {
      setUploadingNews(true);
      const fileUrls = [];

      // Upload files if any
      for (const file of newsFiles) {
        const fileRef = ref(storage, `news/${courseId}/${Date.now()}_${file.name}`);
        await uploadBytes(fileRef, file);
        const url = await getDownloadURL(fileRef);
        fileUrls.push({
          name: file.name,
          url: url,
          size: file.size
        });
      }

      // Create news object
      const newsItem = {
        title: newsTitle,
        text: newsText,
        files: fileUrls,
        createdAt: new Date().toISOString(),
        createdBy: userProfile.displayName,
        createdById: user.uid
      };

      // Update course with new news item
      const courseRef = doc(db, 'courses', courseId);
      const currentNews = course.news || [];
      await updateDoc(courseRef, {
        news: [...currentNews, newsItem]
      });

      // Update local state
      setCourse({ ...course, news: [...currentNews, newsItem] });
      
      // Reset form
      setNewsTitle('');
      setNewsText('');
      setNewsFiles([]);
      setShowAddNews(false);
      toast.success('News posted successfully');
    } catch (error) {
      console.error('Error adding news:', error);
      toast.error('Failed to post news');
    } finally {
      setUploadingNews(false);
    }
  };

  const handleDeleteNews = async (index) => {
    if (!window.confirm('Are you sure you want to delete this news?')) {
      return;
    }

    try {
      const courseRef = doc(db, 'courses', courseId);
      const currentNews = course.news || [];
      const updatedNews = currentNews.filter((_, i) => i !== index);
      
      await updateDoc(courseRef, {
        news: updatedNews
      });

      setCourse({ ...course, news: updatedNews });
      toast.success('News deleted successfully');
    } catch (error) {
      console.error('Error deleting news:', error);
      toast.error('Failed to delete news');
    }
  };

  const renderResourceTree = (resources) => {
    const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'superadmin';
    
    // Helper function to check if file can be viewed (PDF and images)
    const canViewFile = (fileName) => {
      const ext = fileName.split('.').pop().toLowerCase();
      return ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(ext);
    };
    
    // Helper function to get file type description
    const getFileType = (fileName) => {
      const ext = fileName.split('.').pop().toLowerCase();
      const typeMap = {
        'pdf': 'PDF Document',
        'doc': 'Word Document',
        'docx': 'Word Document',
        'xls': 'Excel Spreadsheet',
        'xlsx': 'Excel Spreadsheet',
        'ppt': 'PowerPoint Presentation',
        'pptx': 'PowerPoint Presentation',
        'txt': 'Text File',
        'html': 'HTML File',
        'css': 'CSS File',
        'js': 'JavaScript File',
        'json': 'JSON File',
        'xml': 'XML File',
        'zip': 'ZIP Archive',
        'rar': 'RAR Archive',
        'jpg': 'JPEG Image',
        'jpeg': 'JPEG Image',
        'png': 'PNG Image',
        'gif': 'GIF Image',
        'bmp': 'Bitmap Image',
        'svg': 'SVG Image',
        'mp4': 'MP4 Video',
        'mp3': 'MP3 Audio',
        'wav': 'WAV Audio',
      };
      return typeMap[ext] || `${ext.toUpperCase()} File`;
    };
    
    return resources.map((resource) => {
      const isExpanded = expandedFolders.has(resource.id);
      const fileCount = resource.files?.length || 0;
      const isPending = resource.moderationStatus === 'pending';

      return (
        <div key={resource.id} className="mb-1">
          <div className={`w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-100 rounded-lg transition-colors group relative ${isPending ? 'border-l-2 border-l-gray-400' : ''} ${resource.isImportant ? 'border-l-2 border-l-purple-300 bg-purple-50/30' : ''}`}>
            <button
              onClick={() => toggleFolder(resource.id)}
              className="flex items-center gap-2 flex-1 min-w-0"
            >
              {isExpanded ? (
                <ChevronDown size={16} className="text-gray-500 flex-shrink-0" />
              ) : (
                <ChevronRight size={16} className="text-gray-500 flex-shrink-0" />
              )}
              <Folder size={18} className={isPending ? 'text-gray-500' : resource.isImportant ? 'text-yellow-500' : 'text-blue-500'} />
              <span className="font-medium text-gray-800 truncate">{resource.name}</span>
              {resource.isImportant && (
                <Star size={14} className="text-yellow-500 fill-yellow-500 flex-shrink-0" />
              )}
              {isPending && (
                <span className="px-2 py-0.5 bg-gray-200 text-gray-700 text-xs rounded-full whitespace-nowrap flex-shrink-0">
                  Unmoderated
                </span>
              )}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/course/${courseId}/upload?folder=${encodeURIComponent(resource.name)}`);
              }}
              className="p-1 hover:bg-green-100 rounded transition-colors flex-shrink-0"
              title="Upload to this folder"
            >
              <Upload size={16} className="text-green-600" />
            </button>
            <span className="text-xs text-gray-400 cursor-pointer hover:text-blue-600 whitespace-nowrap flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                if (resource.uploadedById) {
                  navigate(`/user/${resource.uploadedById}`);
                }
              }}
            >
              {resource.uploadedBy}
            </span>
            {canDeleteFromCourse() && (
              <button 
                className="p-1 hover:bg-red-100 rounded transition-colors flex-shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteFolder(resource.id);
                }}
                title="Delete folder"
              >
                <Trash2 size={16} className="text-red-600" />
              </button>
            )}
          </div>
          
          {isExpanded && (
            <div className="ml-6 border-l-2 border-gray-200 pl-2 mt-1">
              {fileCount === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-500">
                  No files in this folder yet
                </div>
              ) : (
                <div className="space-y-1">
                  {resource.files.map((file, index) => {
                    // Get file uploader from folder data or file-specific data
                    const uploaderName = file.uploadedBy || resource.uploadedBy || 'Unknown';
                    const uploaderId = file.uploadedById || resource.uploadedById;
                    const isFilePending = file.moderationStatus === 'pending';
                    const isViewable = canViewFile(file.name);
                    const fileType = getFileType(file.name);
                    
                    return (
                      <div
                        key={index}
                        className={`flex items-center gap-2 px-4 py-2 hover:bg-gray-100 rounded-lg transition-colors group relative cursor-pointer ${isFilePending ? 'border-l-2 border-l-gray-400' : ''}`}
                        onClick={() => {
                          if (isViewable) {
                            window.open(`/viewer?url=${encodeURIComponent(file.url)}&name=${encodeURIComponent(file.name)}&size=${file.size}&courseId=${courseId}`, '_blank');
                          } else {
                            // Force download
                            toast.success(`Downloading ${file.name}...`);
                            const downloadUrl = file.url.includes('?') 
                              ? `${file.url}&response-content-disposition=attachment`
                              : `${file.url}?response-content-disposition=attachment`;
                            const link = document.createElement('a');
                            link.href = downloadUrl;
                            link.download = file.name;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }
                        }}
                      >
                        <FileText size={18} className={isFilePending ? 'text-gray-500 flex-shrink-0' : 'text-gray-400 flex-shrink-0'} />
                        <span className="text-gray-700 flex-1 truncate min-w-0" title={file.name}>
                          {file.name}
                        </span>
                        {isFilePending && (
                          <span className="px-2 py-0.5 bg-gray-200 text-gray-700 text-xs rounded-full whitespace-nowrap flex-shrink-0">
                            Unmoderated
                          </span>
                        )}
                        <span 
                          className="text-xs text-gray-400 cursor-pointer hover:text-blue-600 whitespace-nowrap flex-shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (uploaderId) {
                              navigate(`/user/${uploaderId}`);
                            }
                          }}
                          title="View uploader profile"
                        >
                          {uploaderName}
                        </span>
                        {canDeleteFromCourse() && (
                          <button
                            className="p-1 hover:bg-red-100 rounded transition-colors flex-shrink-0"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              deleteFile(resource.id, index, file.url);
                            }}
                            title="Delete file"
                          >
                            <Trash2 size={14} className="text-red-600" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      );
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl text-gray-600">Loading course...</div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl text-gray-600">Course not found</div>
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
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-2 md:py-3 pr-16 lg:pr-8">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-2"
          >
            <ArrowLeft size={20} />
            <span className="text-sm md:text-base">Back to courses</span>
          </button>
          
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">{course.name}</h1>
            {(course.code || course.semester) && (
              <p className="text-gray-600">
                {course.code}{course.code && course.semester && ' • '}{course.semester}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 md:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-6">
          {/* Resources and News Section */}
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 min-h-[600px]">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-800">Course Resources</h2>
                <button 
                  onClick={() => navigate(`/course/${courseId}/upload`)}
                  className="flex items-center gap-2 px-3 md:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm md:text-base whitespace-nowrap"
                >
                  <Upload size={18} />
                  <span className="hidden sm:inline">Add Resources</span>
                  <span className="sm:hidden">Add</span>
                </button>
              </div>

              {filteredResources.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  {searchQuery ? 'No results found' : 'No folders available yet'}
                </div>
              ) : (
                <div className="space-y-1">
                  {renderResourceTree(filteredResources)}
                </div>
              )}
            </div>

            {/* Course News Section */}
            <div className="bg-white rounded-lg shadow-sm p-4 md:p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Newspaper size={20} className="text-blue-600" />
                  <h2 className="text-lg font-semibold text-gray-800">Course News</h2>
                </div>
              {canManageNews() && (
                <button
                  onClick={() => setShowAddNews(true)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  <Plus size={16} />
                  Add News
                </button>
              )}
            </div>

            {(!course.news || course.news.length === 0) ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                No news posted yet
              </div>
            ) : (
              <div className="space-y-1">
                {course.news.map((news, index) => {
                  const isExpanded = expandedNews.has(index);
                  return (
                    <div key={index}>
                      <div className="px-4 py-3 bg-white hover:bg-gray-50 rounded-lg transition-colors group border border-gray-100 relative">
                        <div className="flex items-center justify-between gap-3">
                          <button
                            onClick={() => toggleNews(index)}
                            className="flex items-center gap-2 flex-1 min-w-0"
                          >
                            {isExpanded ? (
                              <ChevronDown size={16} className="text-gray-500 flex-shrink-0" />
                            ) : (
                              <ChevronRight size={16} className="text-gray-500 flex-shrink-0" />
                            )}
                            <Newspaper size={18} className="text-blue-500 flex-shrink-0" />
                            <span className="font-medium text-gray-800 truncate">{news.title}</span>
                          </button>
                          {canManageNews() && (
                            <button
                              onClick={() => handleDeleteNews(index)}
                              className="p-1 hover:bg-red-100 rounded transition-colors flex-shrink-0"
                              title="Delete news"
                            >
                              <Trash2 size={16} className="text-red-600" />
                            </button>
                          )}
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-2 text-xs text-gray-500 mt-1 ml-9">
                          <span>by {news.postedBy || news.createdBy || 'Admin'}</span>
                          <span>•</span>
                          <span>{new Date(news.postedAt || news.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="ml-6 border-l-2 border-gray-200 pl-2 mt-1">
                          <div className="px-4 py-3 space-y-2">
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{news.content || news.text}</p>
                            
                            {/* Display attachments from new format */}
                            {news.attachments && news.attachments.length > 0 && (
                              <div className="space-y-1">
                                {news.attachments.map((attachment, attachmentIndex) => (
                                  <a
                                    key={attachmentIndex}
                                    href={attachment.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                                  >
                                    <FileText size={18} className="text-gray-400 flex-shrink-0" />
                                    {attachment.name}
                                  </a>
                                ))}
                              </div>
                            )}
                            
                            {/* Display files from old format */}
                            {news.files && news.files.length > 0 && (
                              <div className="space-y-1">
                                {news.files.map((file, fileIndex) => (
                                  <a
                                    key={fileIndex}
                                    href={file.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                                  >
                                    <FileText size={18} className="text-gray-400 flex-shrink-0" />
                                    {file.name}
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            {/* Course Admins Section */}
            {courseAdmins.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm p-4">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Course Admins</h2>
                <div className="space-y-2">
                  {courseAdmins.map((admin) => (
                    <div 
                      key={admin.uid} 
                      className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors"
                      onClick={() => navigate(`/user/${admin.uid}`)}
                    >
                      <Avatar
                        photoURL={admin.photoURL}
                        displayName={admin.displayName}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-800 truncate text-sm">{admin.displayName}</div>
                        <div className="text-xs text-gray-500 truncate">{admin.email}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top Contributors Section */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Top Contributors</h2>
              
              {leaderboard.length === 0 ? (
                <div className="text-center py-6 text-gray-500 text-sm">
                  No contributors yet
                </div>
              ) : (
                <div className="space-y-2">
                  {leaderboard.slice(0, 5).map((contributor) => (
                    <div 
                      key={contributor.id} 
                      className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors"
                      onClick={() => navigate(`/user/${contributor.id}`)}
                    >
                      <div className="text-lg font-bold text-gray-300 w-6">#{contributor.rank}</div>
                      <Avatar
                        photoURL={contributor.photoURL}
                        displayName={contributor.name}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          {contributor.rank === 1 && <span className="text-lg">🏆</span>}
                          {contributor.rank === 2 && <span className="text-lg">🥈</span>}
                          {contributor.rank === 3 && <span className="text-lg">🥉</span>}
                          <span className="font-medium text-gray-800 text-sm truncate">{contributor.name}</span>
                        </div>
                        <div className="text-xs text-gray-500">{contributor.contributions} Contributions</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add News Modal */}
      {showAddNews && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Add Course News</h2>
              <button
                onClick={() => {
                  setShowAddNews(false);
                  setNewsTitle('');
                  setNewsText('');
                  setNewsFiles([]);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  value={newsTitle}
                  onChange={(e) => setNewsTitle(e.target.value)}
                  placeholder="Enter news title"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Content *
                </label>
                <textarea
                  value={newsText}
                  onChange={(e) => setNewsText(e.target.value)}
                  placeholder="Enter news content"
                  rows={6}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Attachments (Optional)
                </label>
                <input
                  type="file"
                  multiple
                  onChange={(e) => setNewsFiles(Array.from(e.target.files))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {newsFiles.length > 0 && (
                  <div className="mt-2 text-sm text-gray-600">
                    {newsFiles.length} file(s) selected
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-4 mt-6">
              <button
                onClick={handleAddNews}
                disabled={uploadingNews}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400"
              >
                {uploadingNews ? 'Posting...' : 'Post News'}
              </button>
              <button
                onClick={() => {
                  setShowAddNews(false);
                  setNewsTitle('');
                  setNewsText('');
                  setNewsFiles([]);
                }}
                disabled={uploadingNews}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoursePage;
