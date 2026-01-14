import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { X, Download, ExternalLink, ArrowLeft } from 'lucide-react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getAuth } from 'firebase/auth';

const FileViewer = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [startTime] = useState(Date.now());
  const auth = getAuth();
  
  const fileUrl = searchParams.get('url');
  const fileName = searchParams.get('name');
  const fileSize = searchParams.get('size');
  const courseId = searchParams.get('courseId');

  useEffect(() => {
    // Track time spent viewing course materials (this is the total website time)
    return () => {
      const timeSpent = Math.round((Date.now() - startTime) / 1000);
      
      // Save to Firebase - only track file viewing time
      if (auth.currentUser && timeSpent > 3) {
        addDoc(collection(db, 'sessions'), {
          userId: auth.currentUser.uid,
          courseId: courseId || 'unknown',
          activityType: 'course_material',
          fileName: fileName,
          duration: timeSpent,
          timestamp: new Date().toISOString()
        }).catch(err => console.error('Error saving session:', err));
      }
    };
  }, []);

  const handleClose = () => {
    window.close();
    // If window doesn't close (popup blockers), navigate back
    setTimeout(() => navigate(-1), 100);
  };

  const handleDownload = () => {
    // Track download
    if (auth.currentUser) {
      addDoc(collection(db, 'downloads'), {
        userId: auth.currentUser.uid,
        courseId: courseId || 'unknown',
        fileName: fileName,
        timestamp: new Date().toISOString()
      }).catch(err => console.error('Error tracking download:', err));
    }
    window.open(fileUrl, '_blank');
  };

  const getFileType = (name) => {
    const ext = name.split('.').pop().toLowerCase();
    return ext;
  };

  const fileType = fileName ? getFileType(fileName) : '';
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(fileType);
  const isPdf = fileType === 'pdf';
  const isVideo = ['mp4', 'webm', 'ogg'].includes(fileType);
  const isAudio = ['mp3', 'wav', 'ogg'].includes(fileType);

  return (
    <div className="h-screen w-screen bg-gray-900 flex flex-col">
      {/* Back button for mobile - Show on all file types */}
      <button
        onClick={() => navigate(-1)}
        className="lg:hidden fixed top-2 left-2 z-50 p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-white shadow-lg"
        title="Go back"
      >
        <ArrowLeft size={20} />
      </button>

      {/* Minimal Header - Hide for PDFs */}
      {!isPdf && (
        <div className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <h1 className="text-white font-medium truncate text-sm">{fileName || 'File Viewer'}</h1>
            {fileSize && (
              <span className="text-gray-400 text-xs">
                {(parseFloat(fileSize) / 1024 / 1024).toFixed(2)} MB
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-gray-300 hover:text-white"
              title="Open original"
            >
              <ExternalLink size={18} />
            </button>
          </div>
        </div>
      )}

      {/* File Content */}
      <div className={`flex-1 overflow-auto bg-gray-900 flex items-center justify-center ${isPdf ? 'p-0' : 'p-4'}`}>
        {isImage && (
          <img 
            src={fileUrl} 
            alt={fileName}
            className="max-w-full max-h-full object-contain"
          />
        )}
        
        {isPdf && (
          <iframe
            src={fileUrl}
            className="w-full h-full border-0"
            title={fileName}
          />
        )}
        
        {isVideo && (
          <video 
            src={fileUrl}
            controls
            className="max-w-full max-h-full"
          >
            Your browser does not support the video tag.
          </video>
        )}
        
        {isAudio && (
          <div className="w-full max-w-2xl">
            <audio 
              src={fileUrl}
              controls
              className="w-full"
            >
              Your browser does not support the audio tag.
            </audio>
          </div>
        )}
        
        {!isImage && !isPdf && !isVideo && !isAudio && (
          <div className="text-center">
            <div className="text-gray-400 mb-4">
              <Download size={48} className="mx-auto mb-2" />
              <p>Preview not available for this file type</p>
            </div>
            <button
              onClick={handleDownload}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Open File
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileViewer;
