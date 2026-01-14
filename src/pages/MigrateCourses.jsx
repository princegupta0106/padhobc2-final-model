import { useState } from 'react';
import { collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { Shield, CheckCircle, XCircle, Loader } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

const MigrateCourses = () => {
  const { userProfile } = useAuth();
  const [migrating, setMigrating] = useState(false);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({
    totalCourses: 0,
    processed: 0,
    updated: 0,
    skipped: 0,
    errors: 0
  });

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { message, type, timestamp }]);
  };

  const migrateCourses = async () => {
    if (!window.confirm('This will update all course documents with folder metadata. Continue?')) {
      return;
    }

    setMigrating(true);
    setLogs([]);
    setStats({ totalCourses: 0, processed: 0, updated: 0, skipped: 0, errors: 0 });

    try {
      addLog('Starting migration...', 'info');
      
      // Fetch all courses
      const coursesSnapshot = await getDocs(collection(db, 'courses'));
      const totalCourses = coursesSnapshot.docs.length;
      
      addLog(`Found ${totalCourses} courses to process`, 'info');
      setStats(prev => ({ ...prev, totalCourses }));

      let processed = 0;
      let updated = 0;
      let skipped = 0;
      let errors = 0;

      // Process each course
      for (const courseDoc of coursesSnapshot.docs) {
        const courseId = courseDoc.id;
        const courseName = courseDoc.data().name;

        try {
          addLog(`Processing: ${courseName} (${courseId})`, 'info');

          // Fetch all folders for this course
          const foldersQuery = query(
            collection(db, 'folders'),
            where('courseId', '==', courseId)
          );
          const foldersSnapshot = await getDocs(foldersQuery);

          // Build folder metadata
          const foldersMetadata = foldersSnapshot.docs
            .filter(doc => !doc.data().deleted)
            .map(doc => {
              const folderData = doc.data();
              return {
                id: doc.id,
                name: folderData.name,
                fileCount: folderData.files?.length || 0,
                isImportant: folderData.isImportant || false,
                uploadedAt: folderData.uploadedAt || null
              };
            });

          // Update course document
          const courseRef = doc(db, 'courses', courseId);
          await updateDoc(courseRef, {
            folders: foldersMetadata
          });

          addLog(`✓ Updated ${courseName}: ${foldersMetadata.length} folders`, 'success');
          updated++;

        } catch (error) {
          addLog(`✗ Error processing ${courseName}: ${error.message}`, 'error');
          errors++;
        }

        processed++;
        setStats(prev => ({ ...prev, processed, updated, errors }));
      }

      addLog('Migration completed!', 'success');
      toast.success('Migration completed successfully!');

    } catch (error) {
      addLog(`Fatal error: ${error.message}`, 'error');
      toast.error('Migration failed!');
    }

    setMigrating(false);
  };

  if (userProfile?.role !== 'superadmin') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-sm text-center">
          <Shield size={48} className="text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h1>
          <p className="text-gray-600">Only super admins can access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <Toaster position="top-right" />
      
      <div className="max-w-5xl mx-auto px-8">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <div className="flex items-center gap-3 mb-6">
            <Shield size={32} className="text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-800">Course Migration</h1>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-yellow-800 font-medium">⚠️ Warning</p>
            <p className="text-yellow-700 text-sm mt-1">
              This will update all course documents to include folder metadata. 
              This operation is necessary to optimize database queries and reduce costs.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-gray-600 text-sm">Total Courses</p>
              <p className="text-2xl font-bold text-gray-800">{stats.totalCourses}</p>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-blue-600 text-sm">Processed</p>
              <p className="text-2xl font-bold text-blue-800">{stats.processed}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-green-600 text-sm">Updated</p>
              <p className="text-2xl font-bold text-green-800">{stats.updated}</p>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <p className="text-yellow-600 text-sm">Skipped</p>
              <p className="text-2xl font-bold text-yellow-800">{stats.skipped}</p>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <p className="text-red-600 text-sm">Errors</p>
              <p className="text-2xl font-bold text-red-800">{stats.errors}</p>
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={migrateCourses}
            disabled={migrating}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {migrating ? (
              <>
                <Loader size={20} className="animate-spin" />
                Migrating...
              </>
            ) : (
              'Start Migration'
            )}
          </button>

          {/* Logs */}
          {logs.length > 0 && (
            <div className="mt-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-3">Migration Log</h2>
              <div className="bg-gray-900 text-gray-100 rounded-lg p-4 max-h-96 overflow-y-auto font-mono text-sm">
                {logs.map((log, index) => (
                  <div key={index} className={`flex items-start gap-2 mb-1 ${
                    log.type === 'error' ? 'text-red-400' : 
                    log.type === 'success' ? 'text-green-400' : 
                    'text-gray-300'
                  }`}>
                    <span className="text-gray-500">[{log.timestamp}]</span>
                    {log.type === 'error' && <XCircle size={16} className="mt-0.5" />}
                    {log.type === 'success' && <CheckCircle size={16} className="mt-0.5" />}
                    <span>{log.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MigrateCourses;
