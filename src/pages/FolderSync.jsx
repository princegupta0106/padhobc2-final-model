import { useState } from 'react';
import { collection, getDocs, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase/config';

export default function FolderSync() {
  const [syncing, setSyncing] = useState(false);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ checked: 0, fixed: 0, errors: 0 });

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { message, type, timestamp }]);
    console.log(`[${timestamp}] ${message}`);
  };

  const syncFoldersWithCourses = async () => {
    setSyncing(true);
    setLogs([]);
    setStats({ checked: 0, fixed: 0, errors: 0 });

    try {
      addLog('Starting folder-course synchronization...', 'info');

      // Fetch all folders
      addLog('Fetching all folders...', 'info');
      const foldersSnapshot = await getDocs(collection(db, 'folders'));
      const folders = foldersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      addLog(`Found ${folders.length} folders`, 'success');

      // Fetch all courses
      addLog('Fetching all courses...', 'info');
      const coursesSnapshot = await getDocs(collection(db, 'courses'));
      const courses = {};
      coursesSnapshot.docs.forEach(doc => {
        courses[doc.id] = {
          id: doc.id,
          ...doc.data()
        };
      });
      addLog(`Found ${Object.keys(courses).length} courses`, 'success');

      let checked = 0;
      let fixed = 0;
      let errors = 0;

      // Check each folder
      for (const folder of folders) {
        checked++;
        
        if (!folder.courseId) {
          addLog(`⚠️ Folder "${folder.name}" (${folder.id}) has no courseId`, 'warning');
          continue;
        }

        const course = courses[folder.courseId];
        
        if (!course) {
          addLog(`❌ Folder "${folder.name}" references non-existent course: ${folder.courseId}`, 'error');
          errors++;
          continue;
        }

        // Check if course has this folder in its folders array
        const courseFolders = course.folders || [];
        
        if (!courseFolders.includes(folder.id)) {
          try {
            // Add folder ID to course's folders array
            const courseRef = doc(db, 'courses', course.id);
            await updateDoc(courseRef, {
              folders: arrayUnion(folder.id)
            });

            addLog(
              `✅ FIXED: Added folder "${folder.name}" (${folder.id}) to course "${course.name}" (${course.id})`,
              'success'
            );
            fixed++;

            // Update local course data
            courses[course.id].folders = [...courseFolders, folder.id];
          } catch (error) {
            addLog(
              `❌ ERROR: Failed to add folder "${folder.name}" to course "${course.name}": ${error.message}`,
              'error'
            );
            errors++;
          }
        }
      }

      setStats({ checked, fixed, errors });
      addLog('', 'info');
      addLog('=== SYNC COMPLETE ===', 'info');
      addLog(`Total folders checked: ${checked}`, 'info');
      addLog(`Folders added to courses: ${fixed}`, 'success');
      addLog(`Errors encountered: ${errors}`, errors > 0 ? 'error' : 'info');

    } catch (error) {
      addLog(`Fatal error: ${error.message}`, 'error');
      console.error('Sync error:', error);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-3xl font-bold mb-4">Folder-Course Sync Tool</h1>
        <p className="text-gray-600 mb-6">
          This tool checks all folders and ensures their IDs are properly included in their associated course's folders array.
        </p>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-yellow-800 mb-2">⚠️ Important Notes:</h3>
          <ul className="list-disc list-inside text-yellow-700 text-sm space-y-1">
            <li>This will modify course documents in Firestore</li>
            <li>Only missing folder IDs will be added (no duplicates)</li>
            <li>Detailed logs will appear below and in the browser console</li>
            <li>This is a temporary utility page - can be removed after sync</li>
          </ul>
        </div>

        <div className="mb-6">
          <button
            onClick={syncFoldersWithCourses}
            disabled={syncing}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            {syncing ? 'Syncing...' : 'Start Sync'}
          </button>
        </div>

        {/* Stats */}
        {stats.checked > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{stats.checked}</div>
              <div className="text-sm text-gray-600">Folders Checked</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{stats.fixed}</div>
              <div className="text-sm text-gray-600">Folders Added</div>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{stats.errors}</div>
              <div className="text-sm text-gray-600">Errors</div>
            </div>
          </div>
        )}

        {/* Logs */}
        {logs.length > 0 && (
          <div className="bg-gray-900 rounded-lg p-4 max-h-96 overflow-y-auto">
            <h3 className="text-white font-semibold mb-2">Sync Log:</h3>
            <div className="font-mono text-sm space-y-1">
              {logs.map((log, index) => (
                <div
                  key={index}
                  className={`${
                    log.type === 'error' ? 'text-red-400' :
                    log.type === 'success' ? 'text-green-400' :
                    log.type === 'warning' ? 'text-yellow-400' :
                    'text-gray-300'
                  }`}
                >
                  <span className="text-gray-500">[{log.timestamp}]</span> {log.message}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
