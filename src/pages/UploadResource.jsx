import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { collection, addDoc, doc, updateDoc, getDoc, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { Upload, X, FileText, Folder } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { updateUserXP } from '../utils/xpCalculator';
import pako from 'pako';

// Helper function to check if file should be compressed
const shouldCompressFile = (fileName) => {
  const ext = fileName.toLowerCase().split('.').pop();
  return ['html', 'htm', 'txt'].includes(ext);
};

// Helper function to compress file
const compressFile = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const compressed = pako.gzip(text);
        const blob = new Blob([compressed], { type: 'application/gzip' });
        const compressedFile = new File([blob], file.name + '.gz', { type: 'application/gzip' });
        resolve(compressedFile);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
};

// Helper function to notify course admins
const notifyCourseAdmins = async (courseId, uploaderId, uploaderName, type, itemName, fileCount = 0) => {
  try {
    // Get the course to find its name
    const courseDoc = await getDoc(doc(db, 'courses', courseId));
    const courseName = courseDoc.exists() ? courseDoc.data().name : 'Unknown Course';

    // Find all admins for this course
    const adminsQuery = query(
      collection(db, 'users'),
      where('adminCourses', 'array-contains', courseId)
    );
    const adminsSnapshot = await getDocs(adminsQuery);
    
    // Create notifications for each admin (except the uploader if they're also an admin)
    const notificationPromises = adminsSnapshot.docs
      .filter(adminDoc => adminDoc.id !== uploaderId)
      .map(adminDoc => {
        return addDoc(collection(db, 'notifications'), {
          userId: adminDoc.id,
          type: 'upload',
          courseId: courseId,
          courseName: courseName,
          uploaderId: uploaderId,
          uploaderName: uploaderName,
          itemType: type, // 'folder' or 'files'
          itemName: itemName,
          fileCount: fileCount,
          read: false,
          createdAt: new Date().toISOString()
        });
      });
    
    await Promise.all(notificationPromises);
  } catch (error) {
    console.error('Error creating notifications:', error);
  }
};

const UploadResource = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, userProfile } = useAuth();
  const [folderName, setFolderName] = useState('');
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Pre-fill folder name if coming from folder + button
  useEffect(() => {
    const folderParam = searchParams.get('folder');
    if (folderParam) {
      setFolderName(folderParam);
    }
  }, [searchParams]);

  const getModerationStatus = () => {
    // Admins and superadmins get auto-approved, normal users get pending
    if (userProfile?.role === 'superadmin') return 'approved';
    if (userProfile?.role === 'admin' && userProfile?.adminCourses?.includes(courseId)) {
      return 'approved';
    }
    const status = 'pending'; // Normal users get pending status
    console.log('Setting moderation status:', status, 'for user role:', userProfile?.role);
    return status;
  };

  // Validate that file extension matches actual file type
  const validateFileType = (file) => {
    const fileName = file.name.toLowerCase();
    const fileType = file.type.toLowerCase();
    const extension = fileName.split('.').pop();

    // Define valid MIME types for each extension
    const validTypes = {
      'pdf': ['application/pdf'],
      'doc': ['application/msword'],
      'docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      'xls': ['application/vnd.ms-excel'],
      'xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
      'ppt': ['application/vnd.ms-powerpoint'],
      'pptx': ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
      'txt': ['text/plain'],
      'html': ['text/html'],
      'htm': ['text/html'],
      'css': ['text/css'],
      'js': ['text/javascript', 'application/javascript'],
      'json': ['application/json'],
      'xml': ['application/xml', 'text/xml'],
      'zip': ['application/zip', 'application/x-zip-compressed'],
      'rar': ['application/x-rar-compressed', 'application/vnd.rar'],
      'jpg': ['image/jpeg'],
      'jpeg': ['image/jpeg'],
      'png': ['image/png'],
      'gif': ['image/gif'],
      'bmp': ['image/bmp'],
      'webp': ['image/webp'],
      'svg': ['image/svg+xml'],
      'mp4': ['video/mp4'],
      'mp3': ['audio/mpeg'],
      'wav': ['audio/wav', 'audio/x-wav']
    };

    // If extension is not in our list, allow it (unknown types)
    if (!validTypes[extension]) {
      return { valid: true };
    }

    // Check if actual file type matches expected types for this extension
    const expectedTypes = validTypes[extension];
    if (expectedTypes.includes(fileType)) {
      return { valid: true };
    }

    // File type doesn't match extension
    return {
      valid: false,
      message: `File "${file.name}" has extension .${extension} but is actually a ${fileType || 'different file type'}. Please rename the file with the correct extension.`
    };
  };

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    
    // Validate each file
    for (const file of selectedFiles) {
      const validation = validateFileType(file);
      if (!validation.valid) {
        toast.error(validation.message);
        e.target.value = ''; // Clear the input
        return;
      }
    }
    
    setFiles(selectedFiles);
  };

  const handleUpload = async () => {
    if (!folderName.trim()) {
      toast.error('Please enter a folder name');
      return;
    }

    if (files.length === 0) {
      toast.error('Please select files to upload');
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);

      // Check if folder already exists
      const foldersQuery = query(
        collection(db, 'folders'),
        where('courseId', '==', courseId),
        where('name', '==', folderName)
      );
      const existingFolders = await getDocs(foldersQuery);

      if (!existingFolders.empty) {
        // Add files to existing folder
        const existingFolderDoc = existingFolders.docs[0];
        const existingFolderData = existingFolderDoc.data();
        const existingFiles = existingFolderData.files || [];

        const uploadedFiles = [];

        // Upload each file to Firebase Storage
        let uploadedCount = 0;
        for (const file of files) {
          // Compress file if it's HTML, HTM, or TXT
          let fileToUpload = file;
          let uploadFileName = file.name;
          if (shouldCompressFile(file.name)) {
            try {
              fileToUpload = await compressFile(file);
              uploadFileName = file.name + '.gz';
              toast.success(`Compressed ${file.name}`);
            } catch (error) {
              console.error('Compression error:', error);
              toast.error(`Failed to compress ${file.name}, uploading uncompressed`);
            }
          }
          
          const fileRef = ref(storage, `courses/${courseId}/${folderName}/${uploadFileName}`);
          await uploadBytes(fileRef, fileToUpload);
          const downloadURL = await getDownloadURL(fileRef);

          uploadedFiles.push({
            name: uploadFileName,
            originalName: file.name,
            url: downloadURL,
            size: fileToUpload.size,
            mimeType: fileToUpload.type,
            compressed: shouldCompressFile(file.name),
            uploadedAt: new Date().toISOString(),
            uploadedBy: userProfile?.displayName || user?.displayName,
            uploadedById: user?.uid,
            moderationStatus: 'approved'
          });

          uploadedCount++;
          setUploadProgress(Math.round((uploadedCount / files.length) * 100));
        }

        // Update existing folder with new files
        // Mark each new file with uploader info for moderation
        const newFilesWithMeta = uploadedFiles.map(file => ({
          ...file,
          uploadedById: user?.uid,
          uploadedBy: userProfile?.displayName || user?.displayName,
          moderationStatus: getModerationStatus()
        }));
        
        await updateDoc(doc(db, 'folders', existingFolderDoc.id), {
          files: [...existingFiles, ...newFilesWithMeta]
        });

        // Contributions will be updated automatically by cloud function

        toast.success(`Added ${files.length} files to existing folder`);
        navigate(`/course/${courseId}`);
      } else {
        // Create new folder
        const uploadedFiles = [];

        // Upload each file to Firebase Storage
        let uploadedCount = 0;
        for (const file of files) {
          // Compress file if it's HTML, HTM, or TXT
          let fileToUpload = file;
          let uploadFileName = file.name;
          if (shouldCompressFile(file.name)) {
            try {
              fileToUpload = await compressFile(file);
              uploadFileName = file.name + '.gz';
              toast.success(`Compressed ${file.name}`);
            } catch (error) {
              console.error('Compression error:', error);
              toast.error(`Failed to compress ${file.name}, uploading uncompressed`);
            }
          }
          
          const fileRef = ref(storage, `courses/${courseId}/${folderName}/${uploadFileName}`);
          await uploadBytes(fileRef, fileToUpload);
          const downloadURL = await getDownloadURL(fileRef);

          uploadedFiles.push({
            name: uploadFileName,
            originalName: file.name,
            url: downloadURL,
            size: fileToUpload.size,
            mimeType: fileToUpload.type,
            compressed: shouldCompressFile(file.name),
            uploadedAt: new Date().toISOString(),
            uploadedBy: userProfile?.displayName || user?.displayName,
            uploadedById: user?.uid,
            moderationStatus: getModerationStatus()
          });

          uploadedCount++;
          setUploadProgress(Math.round((uploadedCount / files.length) * 100));
        }

        // Create folder document with files array
        const moderationStatus = getModerationStatus();
        console.log('Creating folder with moderation status:', moderationStatus);
        const folderDocRef = await addDoc(collection(db, 'folders'), {
          courseId,
          name: folderName,
          uploadedBy: userProfile?.displayName || user?.displayName,
          uploadedById: user?.uid,
          createdAt: new Date().toISOString(),
          uploadedAt: new Date().toISOString(),
          files: uploadedFiles,
          moderationStatus: moderationStatus,
          moderatedBy: null,
          moderatedAt: null,
          isImportant: false
        });

        // Update parent course's folders array with metadata
        const courseDocRef = doc(db, 'courses', courseId);
        const courseSnapshot = await getDoc(courseDocRef);
        
        if (courseSnapshot.exists()) {
          const courseData = courseSnapshot.data();
          const currentFolders = courseData.folders || [];
          
          // Add new folder metadata
          const newFolderMetadata = {
            id: folderDocRef.id,
            name: folderName,
            fileCount: uploadedFiles.length,
            isImportant: false,
            uploadedAt: new Date().toISOString()
          };
          
          await updateDoc(courseDocRef, {
            folders: [...currentFolders, newFolderMetadata]
          });
        }

        // Contributions and XP will be updated automatically by cloud function

        toast.success(`Folder created with ${files.length} files successfully`);
        navigate(`/course/${courseId}`);
      };
    } catch (error) {
      console.error('Error uploading files:', error);
      toast.error('Failed to upload files. Please try again');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const removeFile = (index) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: { background: '#363636', color: '#fff' },
          success: { style: { background: '#10b981' } },
          error: { style: { background: '#ef4444' } },
        }}
      />
      <div className="max-w-4xl mx-auto px-8">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-gray-800">Upload Resources</h1>
            <button
              onClick={() => navigate(`/course/${courseId}`)}
              className="text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
          </div>

          <div className="space-y-6">
            {/* Folder Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Folder Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Folder className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  placeholder="e.g., 2024-25 Semester 1 Papers"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={uploading}
                />
              </div>
            </div>

            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Files <span className="text-red-500">*</span>
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
                <input
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                  disabled={uploading}
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer flex flex-col items-center"
                >
                  <Upload size={48} className="text-gray-400 mb-4" />
                  <p className="text-gray-600 mb-2">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-sm text-gray-500">
                    PDFs, Images, Documents (Max 50MB each)
                  </p>
                </label>
              </div>
            </div>

            {/* Selected Files List */}
            {files.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">
                  Selected Files ({files.length})
                </h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {files.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <FileText size={20} className="text-gray-400" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {file.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeFile(index)}
                        className="p-1 hover:bg-gray-200 rounded"
                        disabled={uploading}
                      >
                        <X size={18} className="text-gray-600" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upload Progress */}
            {uploading && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    Uploading...
                  </span>
                  <span className="text-sm text-gray-600">{uploadProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* Upload Button */}
            <div className="flex gap-4 pt-4">
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                <Upload size={20} />
                {uploading ? 'Uploading...' : 'Upload Resources'}
              </button>
              <button
                onClick={() => navigate(`/course/${courseId}`)}
                disabled={uploading}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:bg-gray-100"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadResource;
