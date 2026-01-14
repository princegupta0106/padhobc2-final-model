import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, doc, updateDoc, query, where, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Upload, Folder, FileText, CheckCircle, XCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
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
const notifyCourseAdmins = async (courseId, uploaderId, uploaderName, courseName, folderCount, fileCount) => {
  try {
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
          type: 'bulk_upload',
          courseId: courseId,
          courseName: courseName,
          uploaderId: uploaderId,
          uploaderName: uploaderName,
          folderCount: folderCount,
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

const BulkUpload = () => {
  const { userProfile, user } = useAuth();
  const navigate = useNavigate();
  const [colleges, setColleges] = useState([]);
  const [selectedCollege, setSelectedCollege] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [folderStructure, setFolderStructure] = useState({});
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState([]);
  const [currentStep, setCurrentStep] = useState('select'); // select, preview, upload, complete
  const [selectedCourses, setSelectedCourses] = useState([]);
  const [isPaused, setIsPaused] = useState(false);
  const [currentCourseIndex, setCurrentCourseIndex] = useState(0);

  const getModerationStatus = () => {
    // Admins and superadmins get auto-approved, normal users get pending
    if (userProfile?.role === 'superadmin') return 'approved';
    if (userProfile?.role === 'admin') return 'approved';
    return 'pending'; // Normal users get pending status
  };

  useEffect(() => {
    fetchColleges();
  }, []);

  const fetchColleges = async () => {
    try {
      const collegesSnapshot = await getDocs(collection(db, 'colleges'));
      const collegesList = collegesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setColleges(collegesList);
    } catch (error) {
      console.error('Error fetching colleges:', error);
    }
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
    const files = Array.from(e.target.files);
    
    // Filter out desktop.ini files
    const filteredFiles = files.filter(file => {
      const fileName = file.name.toLowerCase();
      return fileName !== 'desktop.ini';
    });
    
    // Validate each file
    for (const file of filteredFiles) {
      const validation = validateFileType(file);
      if (!validation.valid) {
        toast.error(validation.message);
        e.target.value = ''; // Clear the input
        return;
      }
    }
    
    setSelectedFiles(filteredFiles);

    // Parse folder structure
    // Expected structure: TopFolder/CourseName/FolderName/file.pdf
    // We skip the top folder and treat each subfolder as a course
    const structure = {};
    filteredFiles.forEach(file => {
      const path = file.webkitRelativePath || file.name;
      const parts = path.split('/');
      
      if (parts.length >= 4) {
        // Skip first part (top folder), second part is course name
        const courseName = parts[1]; // Course name
        const folderName = parts.slice(2, -1).join('/'); // Folder path within course
        const fileName = parts[parts.length - 1]; // File name

        if (!structure[courseName]) {
          structure[courseName] = {};
        }
        if (!structure[courseName][folderName]) {
          structure[courseName][folderName] = [];
        }
        structure[courseName][folderName].push(file);
      }
    });

    setFolderStructure(structure);
    setSelectedCourses(Object.keys(structure)); // Select all courses by default
    setCurrentStep('preview');
  };

  const uploadCourse = async (courseName) => {
    try {
      setUploading(true);
      const courseProgress = {
        courseName,
        status: 'uploading',
        folders: [],
        totalFiles: 0,
        uploadedFiles: 0
      };
      setUploadProgress([courseProgress]);

      // Find or create course
      const coursesQuery = selectedCollege 
        ? query(
            collection(db, 'courses'),
            where('name', '==', courseName),
            where('collegeId', '==', selectedCollege)
          )
        : query(
            collection(db, 'courses'),
            where('name', '==', courseName),
            where('collegeId', '==', '')
          );
      
      const coursesSnapshot = await getDocs(coursesQuery);

      let courseId;
      if (coursesSnapshot.empty) {
        // Create new course
        const courseRef = await addDoc(collection(db, 'courses'), {
          name: courseName,
          collegeId: selectedCollege || '',
          folders: [],
          createdAt: new Date().toISOString()
        });
        courseId = courseRef.id;

        // Add course to college (only if college is selected)
        if (selectedCollege) {
          const college = colleges.find(c => c.collegeId === selectedCollege);
          if (college) {
            const collegeRef = doc(db, 'colleges', college.id);
            // Fetch the latest college data to ensure we have the current courses array
            const collegeDoc = await getDoc(collegeRef);
            const currentCourses = collegeDoc.data()?.courses || [];
            
            // Add the new course ID if it's not already there
            if (!currentCourses.includes(courseId)) {
              await updateDoc(collegeRef, {
                courses: [...currentCourses, courseId]
              });
            }
          }
        }
      } else {
        courseId = coursesSnapshot.docs[0].id;
      }

      const folders = folderStructure[courseName];
      const folderNames = Object.keys(folders);
      
      // Calculate total files
      const totalFiles = Object.values(folders).reduce((sum, files) => sum + files.length, 0);
      courseProgress.totalFiles = totalFiles;

      // Upload each folder
      for (const folderName of folderNames) {
        const folderProgress = {
          name: folderName,
          status: 'uploading',
          filesUploaded: 0,
          totalFiles: folders[folderName].length
        };
        courseProgress.folders.push(folderProgress);
        setUploadProgress([{ ...courseProgress }]);

        try {
          // Check if folder exists
          const foldersSnapshot = await getDocs(query(
            collection(db, 'folders'),
            where('courseId', '==', courseId),
            where('name', '==', folderName)
          ));

          let folderId;
          let existingFiles = [];

          if (foldersSnapshot.empty) {
            // Create new folder
            const folderRef = await addDoc(collection(db, 'folders'), {
              courseId: courseId,
              name: folderName,
              uploadedBy: userProfile.displayName,
              uploadedById: user.uid,
              createdAt: new Date().toISOString(),
              files: [],
              isImportant: false,
              moderationStatus: getModerationStatus()
            });
            folderId = folderRef.id;

            // Add folder metadata to course document
            const courseRef = doc(db, 'courses', courseId);
            const courseDoc = await getDoc(courseRef);
            const courseFolders = courseDoc.data().folders || [];
            
            const newFolderMetadata = {
              id: folderId,
              name: folderName,
              fileCount: 0, // Will be updated after files are uploaded
              isImportant: false,
              uploadedAt: new Date().toISOString()
            };
            
            await updateDoc(courseRef, {
              folders: [...courseFolders, newFolderMetadata]
            });
          } else {
            folderId = foldersSnapshot.docs[0].id;
            existingFiles = foldersSnapshot.docs[0].data().files || [];
          }

          // Upload files in this folder
          const files = folders[folderName];
          const uploadedFiles = [];

          for (const file of files) {
            try {
              // Compress file if it's HTML, HTM, or TXT
              let fileToUpload = file;
              let uploadFileName = file.name;
              if (shouldCompressFile(file.name)) {
                try {
                  fileToUpload = await compressFile(file);
                  uploadFileName = file.name + '.gz';
                } catch (error) {
                  console.error('Compression error:', error);
                }
              }
              
              // Upload to storage
              const timestamp = Date.now();
              const sanitizedFileName = uploadFileName.replace(/[^a-zA-Z0-9.-]/g, '_');
              const storageRef = ref(storage, `courses/${courseId}/${folderId}/${timestamp}_${sanitizedFileName}`);
              await uploadBytes(storageRef, fileToUpload);
              const downloadURL = await getDownloadURL(storageRef);

              const fileData = {
                name: uploadFileName,
                originalName: file.name,
                url: downloadURL,
                size: fileToUpload.size,
                mimeType: fileToUpload.type,
                compressed: shouldCompressFile(file.name),
                uploadedAt: new Date().toISOString(),
                uploadedBy: userProfile.displayName,
                uploadedById: user.uid,
                moderationStatus: getModerationStatus()
              };
              
              uploadedFiles.push(fileData);

              folderProgress.filesUploaded++;
              courseProgress.uploadedFiles++;
              setUploadProgress([{ ...courseProgress }]);
            } catch (error) {
              console.error(`Error uploading file ${file.name}:`, error);
              toast.error(`Failed to upload ${file.name}`);
            }
          }

          // Update folder with files only if we successfully uploaded files
          if (uploadedFiles.length > 0) {
            const folderRef = doc(db, 'folders', folderId);
            await updateDoc(folderRef, {
              files: [...existingFiles, ...uploadedFiles],
              updatedAt: new Date().toISOString()
            });

            // Update folder metadata in course document
            const courseRef = doc(db, 'courses', courseId);
            const courseDoc = await getDoc(courseRef);
            const courseFolders = courseDoc.data().folders || [];
            
            // Find and update the folder metadata
            const updatedFolders = courseFolders.map(folder => {
              if (folder.id === folderId) {
                return {
                  ...folder,
                  fileCount: existingFiles.length + uploadedFiles.length
                };
              }
              return folder;
            });
            
            await updateDoc(courseRef, {
              folders: updatedFolders
            });

            // Contributions updated automatically by cloud function
          }

          folderProgress.status = 'completed';
          setUploadProgress([{ ...courseProgress }]);
        } catch (error) {
          console.error(`Error processing folder ${folderName}:`, error);
          folderProgress.status = 'error';
          setUploadProgress([{ ...courseProgress }]);
          toast.error(`Failed to process folder: ${folderName}`);
        }
      }

      courseProgress.status = 'completed';
      setUploadProgress([{ ...courseProgress }]);
      
      // Notify course admins if uploader is not admin/superadmin
      if (userProfile?.role !== 'superadmin' && userProfile?.role !== 'admin') {
        await notifyCourseAdmins(
          courseId,
          user.uid,
          userProfile?.displayName || user?.displayName,
          courseName,
          Object.keys(folders).length,
          courseProgress.totalFiles
        );
      }
      
      toast.success(`Successfully uploaded ${courseName}`);
    } catch (error) {
      console.error('Error uploading course:', error);
      toast.error('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const uploadAllCourses = async () => {
    setCurrentStep('upload');
    setUploading(true);
    setIsPaused(false);
    setCurrentCourseIndex(0);
    
    const coursesToUpload = Object.keys(folderStructure).filter(course => 
      selectedCourses.includes(course)
    );
    
    const allProgress = coursesToUpload.map(courseName => ({
      courseName,
      status: 'pending',
      folders: [],
      totalFiles: 0,
      uploadedFiles: 0
    }));
    setUploadProgress(allProgress);

    for (let i = 0; i < coursesToUpload.length; i++) {
      if (isPaused) {
        break;
      }
      
      setCurrentCourseIndex(i);
      const courseName = coursesToUpload[i];
      
      // Update status to uploading
      const updatedProgress = [...allProgress];
      updatedProgress[i].status = 'uploading';
      setUploadProgress(updatedProgress);
      
      await uploadSingleCourse(courseName, i, updatedProgress);
    }

    if (!isPaused) {
      setCurrentStep('complete');
      setUploading(false);
    }
  };

  const uploadSingleCourse = async (courseName, courseIndex, progressArray) => {
    try {
      const courseProgress = progressArray[courseIndex];

      // Find or create course
      const coursesQuery = selectedCollege 
        ? query(
            collection(db, 'courses'),
            where('name', '==', courseName),
            where('collegeId', '==', selectedCollege)
          )
        : query(
            collection(db, 'courses'),
            where('name', '==', courseName),
            where('collegeId', '==', '')
          );
      
      const coursesSnapshot = await getDocs(coursesQuery);

      let courseId;
      if (coursesSnapshot.empty) {
        // Create new course
        const courseRef = await addDoc(collection(db, 'courses'), {
          name: courseName,
          collegeId: selectedCollege || '',
          folders: [],
          createdAt: new Date().toISOString()
        });
        courseId = courseRef.id;

        // Add course to college (only if college is selected)
        if (selectedCollege) {
          const college = colleges.find(c => c.collegeId === selectedCollege);
          if (college) {
            const collegeRef = doc(db, 'colleges', college.id);
            // Fetch the latest college data to ensure we have the current courses array
            const collegeDoc = await getDoc(collegeRef);
            const currentCourses = collegeDoc.data()?.courses || [];
            
            // Add the new course ID if it's not already there
            if (!currentCourses.includes(courseId)) {
              await updateDoc(collegeRef, {
                courses: [...currentCourses, courseId]
              });
              
              // Update local state
              setColleges(prev => prev.map(c => 
                c.id === college.id 
                  ? { ...c, courses: [...currentCourses, courseId] }
                  : c
              ));
            }
          }
        }
      } else {
        courseId = coursesSnapshot.docs[0].id;
      }

      const folders = folderStructure[courseName];
      const folderNames = Object.keys(folders);
      
      // Calculate total files
      const totalFiles = Object.values(folders).reduce((sum, files) => sum + files.length, 0);
      courseProgress.totalFiles = totalFiles;

      // Upload each folder
      for (const folderName of folderNames) {
        if (isPaused) break;
        
        const folderProgress = {
          name: folderName,
          status: 'uploading',
          filesUploaded: 0,
          totalFiles: folders[folderName].length
        };
        courseProgress.folders.push(folderProgress);
        
        setUploadProgress([...progressArray]);

        try {
          // Check if folder exists
          const foldersSnapshot = await getDocs(query(
            collection(db, 'folders'),
            where('courseId', '==', courseId),
            where('name', '==', folderName)
          ));

          let folderId;
          let existingFiles = [];

          if (foldersSnapshot.empty) {
            // Create new folder
            const folderRef = await addDoc(collection(db, 'folders'), {
              courseId,
              name: folderName,
              files: [],
              uploadedBy: userProfile.displayName,
              uploadedById: user.uid,
              createdAt: new Date().toISOString(),
              isImportant: false
            });
            folderId = folderRef.id;
          } else {
            folderId = foldersSnapshot.docs[0].id;
            existingFiles = foldersSnapshot.docs[0].data().files || [];
          }

          // Upload files
          const uploadedFiles = [];
          let filesUploadedCount = 0;
          
          for (const file of folders[folderName]) {
            if (isPaused) break;
            
            try {
              // Compress file if it's HTML, HTM, or TXT
              let fileToUpload = file;
              let uploadFileName = file.name;
              if (shouldCompressFile(file.name)) {
                try {
                  fileToUpload = await compressFile(file);
                  uploadFileName = file.name + '.gz';
                } catch (error) {
                  console.error('Compression error:', error);
                }
              }
              
              const storageRef = ref(storage, `courses/${courseId}/${folderName}/${uploadFileName}`);
              await uploadBytes(storageRef, fileToUpload);
              const fileUrl = await getDownloadURL(storageRef);

              const fileData = {
                name: uploadFileName,
                originalName: file.name,
                url: fileUrl,
                size: fileToUpload.size,
                compressed: shouldCompressFile(file.name),
                uploadedAt: new Date().toISOString(),
                uploadedBy: userProfile.displayName,
                uploadedById: user.uid,
                moderationStatus: userProfile?.role === 'superadmin' ? 'approved' : 'pending'
              };
              
              uploadedFiles.push(fileData);
              filesUploadedCount++;

              folderProgress.filesUploaded++;
              courseProgress.uploadedFiles++;
              setUploadProgress([...progressArray]);
            } catch (error) {
              console.error(`Error uploading file ${file.name}:`, error);
              toast.error(`Failed to upload ${file.name}`);
            }
          }

          // Update folder with files only if we successfully uploaded files
          if (uploadedFiles.length > 0) {
            const folderRef = doc(db, 'folders', folderId);
            const updatedFiles = [...existingFiles, ...uploadedFiles];
            
            await updateDoc(folderRef, {
              files: updatedFiles,
              updatedAt: new Date().toISOString()
            });

            // Contributions updated automatically by cloud function
          }

          folderProgress.status = 'completed';
          setUploadProgress([...progressArray]);
        } catch (error) {
          console.error(`Error processing folder ${folderName}:`, error);
          folderProgress.status = 'error';
          setUploadProgress([...progressArray]);
          toast.error(`Failed to process folder: ${folderName}`);
        }
      }

      courseProgress.status = 'completed';
      setUploadProgress([...progressArray]);
      
      // Notify course admins if uploader is not a superadmin
      if (userProfile?.role !== 'superadmin') {
        await notifyCourseAdmins(
          courseId,
          user.uid,
          userProfile?.displayName || user?.displayName,
          courseName,
          Object.keys(folders).length,
          courseProgress.totalFiles
        );
      }
      
      toast.success(`Successfully uploaded ${courseName}`);
    } catch (error) {
      console.error('Error uploading course:', error);
      const updatedProgress = [...progressArray];
      updatedProgress[courseIndex].status = 'error';
      setUploadProgress(updatedProgress);
      toast.error(`Failed to upload ${courseName}`);
    }
  };

  const pauseUpload = () => {
    setIsPaused(true);
    setUploading(false);
    toast.info('Upload paused');
  };

  const resumeUpload = async () => {
    setIsPaused(false);
    setUploading(true);
    toast.info('Resuming upload...');

    const coursesToUpload = Object.keys(folderStructure).filter(course => 
      selectedCourses.includes(course)
    );
    
    const currentProgress = [...uploadProgress];

    for (let i = currentCourseIndex; i < coursesToUpload.length; i++) {
      if (isPaused) {
        break;
      }
      
      const courseName = coursesToUpload[i];
      
      // Skip already completed courses
      if (currentProgress[i].status === 'completed') {
        continue;
      }
      
      setCurrentCourseIndex(i);
      currentProgress[i].status = 'uploading';
      setUploadProgress(currentProgress);
      
      await uploadSingleCourse(courseName, i, currentProgress);
    }

    if (!isPaused) {
      setCurrentStep('complete');
      setUploading(false);
    }
  };

  const toggleCourseSelection = (courseName) => {
    setSelectedCourses(prev => 
      prev.includes(courseName) 
        ? prev.filter(c => c !== courseName)
        : [...prev, courseName]
    );
  };

  const reset = () => {
    setSelectedFiles([]);
    setFolderStructure({});
    setUploadProgress([]);
    setSelectedCourses([]);
    setIsPaused(false);
    setCurrentCourseIndex(0);
    setCurrentStep('select');
  };

  if (userProfile?.role !== 'superadmin' && userProfile?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h2>
          <p className="text-gray-600">Only admins can access bulk upload</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-2"
          >
            <ArrowLeft size={20} />
            <span>Back to Home</span>
          </button>
          <h1 className="text-3xl font-bold text-gray-800">Bulk Course Upload</h1>
          <p className="text-gray-600 mt-1">Upload entire course folders with their structure intact</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        {/* Step 1: Select Files */}
        {currentStep === 'select' && (
          <div className="bg-white rounded-lg shadow-sm p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Step 1: Select College & Folder</h2>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select College
              </label>
              <select
                value={selectedCollege}
                onChange={(e) => setSelectedCollege(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">No College (Skill Course)</option>
                {colleges.map(college => (
                  <option key={college.id} value={college.collegeId}>
                    {college.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">Leave as "No College" to create a skill course available to all users</p>
            </div>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
              <Upload size={48} className="text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                Select Course Folder
              </h3>
              <p className="text-gray-600 mb-4">
                Choose a folder containing your courses. Structure: Course → Subfolders → Files
              </p>
              <label className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors">
                <input
                  type="file"
                  webkitdirectory="true"
                  directory="true"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
                Choose Folder
              </label>
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-2">Expected Folder Structure:</h4>
              <div className="text-sm text-blue-800 font-mono">
                <div>📁 AllCourses/ (the folder you select)</div>
                <div className="ml-4">📁 CourseName1/</div>
                <div className="ml-8">📁 SubfolderName/</div>
                <div className="ml-12">📄 file1.pdf</div>
                <div className="ml-4">📁 CourseName2/</div>
                <div className="ml-8">📁 SubfolderName/</div>
                <div className="ml-12">📄 file2.pdf</div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Preview */}
        {currentStep === 'preview' && (
          <div className="bg-white rounded-lg shadow-sm p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Step 2: Preview & Select Courses</h2>
            
            <div className="mb-6 flex items-center justify-between">
              <p className="text-gray-600">
                Found <strong>{Object.keys(folderStructure).length}</strong> course(s) with{' '}
                <strong>{selectedFiles.length}</strong> file(s)
              </p>
              <button
                onClick={() => {
                  const allCourses = Object.keys(folderStructure);
                  setSelectedCourses(
                    selectedCourses.length === allCourses.length ? [] : allCourses
                  );
                }}
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                {selectedCourses.length === Object.keys(folderStructure).length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div className="space-y-4 max-h-96 overflow-y-auto mb-6">
              {Object.entries(folderStructure).map(([courseName, folders]) => (
                <div key={courseName} className={`border-2 rounded-lg p-4 transition-all ${selectedCourses.includes(courseName) ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                  <div className="flex items-start gap-3 mb-3">
                    <input
                      type="checkbox"
                      checked={selectedCourses.includes(courseName)}
                      onChange={() => toggleCourseSelection(courseName)}
                      className="mt-1 w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Folder size={20} className="text-blue-600" />
                        <h3 className="font-semibold text-gray-800">{courseName}</h3>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {Object.keys(folders).length} folder(s), {Object.values(folders).reduce((sum, files) => sum + files.length, 0)} file(s)
                      </p>
                    </div>
                  </div>
                  
                  <div className="ml-11 space-y-2">
                    {Object.entries(folders).map(([folderName, files]) => (
                      <div key={folderName} className="flex items-start gap-2">
                        <Folder size={16} className="text-gray-400 mt-1" />
                        <div>
                          <p className="text-sm font-medium text-gray-700">{folderName}</p>
                          <p className="text-xs text-gray-500">{files.length} file(s)</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-4 mt-6">
              <button
                onClick={reset}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={uploadAllCourses}
                disabled={uploading || selectedCourses.length === 0}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {uploading ? 'Uploading...' : `Upload ${selectedCourses.length} Course(s)`}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Upload Progress */}
        {(currentStep === 'upload' || currentStep === 'complete') && (
          <div className="bg-white rounded-lg shadow-sm p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">
              {currentStep === 'upload' ? 'Uploading Courses...' : 'Upload Complete!'}
            </h2>

            {/* Pause/Resume Controls */}
            {currentStep === 'upload' && (
              <div className="mb-6 flex items-center justify-between bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="text-sm text-gray-700">
                    <span className="font-semibold">Progress:</span> {uploadProgress.filter(c => c.status === 'completed').length} / {uploadProgress.length} courses completed
                  </div>
                </div>
                <div className="flex gap-2">
                  {!isPaused ? (
                    <button
                      onClick={pauseUpload}
                      disabled={!uploading}
                      className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors disabled:bg-gray-400"
                    >
                      Pause
                    </button>
                  ) : (
                    <button
                      onClick={resumeUpload}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Resume
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-4 max-h-[500px] overflow-y-auto">
              {uploadProgress.map((course, idx) => (
                <div key={idx} className={`border-2 rounded-lg p-4 ${
                  course.status === 'completed' ? 'border-green-300 bg-green-50' :
                  course.status === 'uploading' ? 'border-blue-300 bg-blue-50' :
                  course.status === 'error' ? 'border-red-300 bg-red-50' :
                  'border-gray-200 bg-gray-50'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Folder size={20} className={
                        course.status === 'completed' ? 'text-green-600' :
                        course.status === 'uploading' ? 'text-blue-600' :
                        course.status === 'error' ? 'text-red-600' :
                        'text-gray-400'
                      } />
                      <h3 className="font-semibold text-gray-800">{course.courseName}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      {course.status === 'completed' ? (
                        <>
                          <span className="text-sm text-green-600 font-medium">Completed</span>
                          <CheckCircle size={20} className="text-green-600" />
                        </>
                      ) : course.status === 'uploading' ? (
                        <div className="text-sm text-blue-600 font-medium">
                          Uploading: {course.uploadedFiles}/{course.totalFiles} files
                        </div>
                      ) : course.status === 'error' ? (
                        <>
                          <span className="text-sm text-red-600 font-medium">Failed</span>
                          <XCircle size={20} className="text-red-600" />
                        </>
                      ) : (
                        <span className="text-sm text-gray-500">Pending</span>
                      )}
                    </div>
                  </div>

                  {course.folders.length > 0 && (
                    <div className="ml-6 space-y-2">
                      {course.folders.map((folder, folderIdx) => (
                        <div key={folderIdx} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <Folder size={16} className="text-gray-400" />
                            <span className="text-gray-700">{folder.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">
                              {folder.filesUploaded}/{folder.totalFiles}
                            </span>
                            {folder.status === 'completed' && (
                              <CheckCircle size={16} className="text-green-600" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {currentStep === 'complete' && (
              <div className="flex gap-4 mt-6">
                <button
                  onClick={reset}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Upload More Courses
                </button>
                <button
                  onClick={() => navigate('/')}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Go to Home
                </button>
              </div>
            )}

            {isPaused && currentStep === 'upload' && (
              <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800 text-center">
                  ⏸️ Upload paused. Click Resume to continue uploading remaining courses.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BulkUpload;
