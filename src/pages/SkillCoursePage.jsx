import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { ChevronDown, ChevronRight, Folder, FileText, Upload, Trash2, ArrowLeft, Star } from 'lucide-react';
import { db, storage } from '../firebase/config';
import toast, { Toaster } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import Fuse from 'fuse.js';
import { TypeAnimation } from 'react-type-animation';
import { updateUserXP } from '../utils/xpCalculator';
import pako from 'pako';

const SkillCoursePage = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const [course, setCourse] = useState(null);
  const [resources, setResources] = useState([]);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [skillId, setSkillId] = useState(null);

  useEffect(() => {
    fetchCourseData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  const fetchCourseData = async () => {
    try {
      // Fetch course details
      const courseDoc = await getDoc(doc(db, 'courses', courseId));
      if (!courseDoc.exists()) {
        navigate('/skills');
        return;
      }

      const courseData = { id: courseDoc.id, ...courseDoc.data() };
      
      // Verify this is a skill course (no collegedfsId)
      if (courseData.collegeId) {
        toast.error('This is not a skill course');
        navigate('/skills');
        return;
      }
      
      setCourse(courseData);

      // Find which skill this course belongs to
      const skillsSnapshot = await getDocs(collection(db, 'skills'));
      let foundSkillId = null;
      skillsSnapshot.docs.forEach(doc => {
        const skillData = doc.data();
        if (skillData.courses && skillData.courses.includes(courseId)) {
          foundSkillId = doc.id;
        }
      });
      setSkillId(foundSkillId);

      // Fetch folders for this course
      const foldersQuery = query(
        collection(db, 'folders'),
        where('courseId', '==', courseId)
      );
      const foldersSnapshot = await getDocs(foldersQuery);
      const foldersList = foldersSnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter(folder => !folder.deleted)
        .sort((a, b) => {
          if (a.isImportant && !b.isImportant) return -1;
          if (!a.isImportant && b.isImportant) return 1;
          return a.name.localeCompare(b.name);
        });

      setResources(foldersList);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching course data:', error);
      setLoading(false);
    }
  };

  const filteredResources = useMemo(() => {
    if (!searchQuery.trim()) {
      return resources;
    }

    const searchableItems = [];
    resources.forEach(folder => {
      searchableItems.push({
        type: 'folder',
        data: folder,
        searchText: folder.name
      });
      
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
    const folderIds = new Set();
    results.forEach(result => {
      folderIds.add(result.item.data.id);
    });

    return resources.filter(folder => folderIds.has(folder.id));
  }, [resources, searchQuery]);

  const canDeleteFromCourse = () => {
    return userProfile?.role === 'superadmin';
  };

  const deleteFolder = async (folderId) => {
    if (!window.confirm('Are you sure you want to delete this folder? All files will be removed.')) {
      return;
    }

    try {
      const folderDoc = await getDoc(doc(db, 'folders', folderId));
      const folderData = folderDoc.data();
      const filesCount = folderData?.files?.length || 0;
      const uploaderId = folderData?.uploadedById;

      await updateDoc(doc(db, 'folders', folderId), {
        deleted: true,
        deletedAt: new Date().toISOString(),
        deletedBy: user.uid
      });

      const courseRef = doc(db, 'courses', courseId);
      const courseDoc = await getDoc(courseRef);
      if (courseDoc.exists()) {
        const currentFolders = courseDoc.data().folders || [];
        const updatedFolders = currentFolders.filter(id => id !== folderId);
        await updateDoc(courseRef, { folders: updatedFolders });
      }

      // Contributions updated automatically by cloud function

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
      const folderRef = doc(db, 'folders', folderId);
      const folderDoc = await getDoc(folderRef);
      
      if (folderDoc.exists()) {
        const folderData = folderDoc.data();
        const currentFiles = folderData.files || [];
        const uploaderId = folderData.uploadedById;
        const updatedFiles = currentFiles.filter((_, index) => index !== fileIndex);
        
        await updateDoc(folderRef, { files: updatedFiles });
        
        try {
          const fileRef = ref(storage, fileUrl);
          await deleteObject(fileRef);
        } catch (storageError) {
          console.warn('Could not delete file from storage:', storageError);
        }

        // Contributions updated automatically by cloud function
        
        await fetchCourseData();
        toast.success('File deleted successfully');
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      toast.error('Failed to delete file');
    }
  };

  const toggleFolder = (path) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  const renderResourceTree = (resources) => {
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
              <span className="text-xs text-gray-500 whitespace-nowrap flex-shrink-0">({fileCount} files)</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/skill-course/${courseId}/upload?folder=${encodeURIComponent(resource.name)}`);
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
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 md:py-6 pr-16 lg:pr-8">
          <button
            onClick={() => navigate(skillId ? `/skills/${skillId}` : '/skills')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-3 md:mb-4"
          >
            <ArrowLeft size={20} />
            <span className="text-sm md:text-base">Back to Skills</span>
          </button>
          
          <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">{course.name}</h1>
              <p className="text-sm text-purple-600 font-medium">Skill Course</p>
            </div>
            
            <button 
              onClick={() => navigate(`/skill-course/${courseId}/upload`)}
              className="flex items-center gap-2 px-3 md:px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm md:text-base whitespace-nowrap"
            >
              <Upload size={18} />
              <span className="hidden sm:inline">Add Resources</span>
              <span className="sm:hidden">Add</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-4 md:py-8">
        <div className="bg-white rounded-lg shadow-sm p-4 md:p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-800">Course Resources</h2>
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
      </div>
    </div>
  );
};

export default SkillCoursePage;
