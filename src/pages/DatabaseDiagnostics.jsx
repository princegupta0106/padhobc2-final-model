import { useState } from 'react';
import { collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { AlertTriangle, CheckCircle, XCircle, RefreshCw, Trash2, Database } from 'lucide-react';

export default function DatabaseDiagnostics() {
  const [loading, setLoading] = useState(false);
  const [diagnostics, setDiagnostics] = useState(null);
  const [fixing, setFixing] = useState(false);
  const [logs, setLogs] = useState([]);

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { message, type, timestamp }]);
    console.log(`[${timestamp}] ${message}`);
  };

  const runDiagnostics = async () => {
    setLoading(true);
    setLogs([]);
    addLog('Starting database diagnostics...', 'info');

    try {
      // Fetch all courses
      const coursesSnapshot = await getDocs(collection(db, 'courses'));
      const courses = {};
      coursesSnapshot.docs.forEach(doc => {
        courses[doc.id] = { id: doc.id, ...doc.data() };
      });
      addLog(`Found ${Object.keys(courses).length} courses`, 'info');

      // Fetch all folders
      const foldersSnapshot = await getDocs(collection(db, 'folders'));
      const folders = {};
      foldersSnapshot.docs.forEach(doc => {
        folders[doc.id] = { id: doc.id, ...doc.data() };
      });
      addLog(`Found ${Object.keys(folders).length} folders`, 'info');

      const results = {
        totalCourses: Object.keys(courses).length,
        totalFolders: Object.keys(folders).length,
        orphanedFolders: [],
        emptyFolders: [],
        coursesWithMixedFolders: [],
        coursesWithStringFolders: [],
        coursesWithObjectFolders: [],
        coursesWithoutFolders: [],
        foldersMissingFromCourses: [],
        duplicateFolderRefs: []
      };

      // Check each folder
      for (const [folderId, folder] of Object.entries(folders)) {
        // Check if folder's course exists
        if (!folder.courseId) {
          addLog(`⚠️ Folder "${folder.name}" has no courseId`, 'warning');
          results.orphanedFolders.push({ id: folderId, ...folder });
        } else if (!courses[folder.courseId]) {
          addLog(`❌ Folder "${folder.name}" references non-existent course: ${folder.courseId}`, 'error');
          results.orphanedFolders.push({ id: folderId, ...folder });
        }

        // Check if folder is empty
        const fileCount = (folder.files || []).length;
        if (fileCount === 0) {
          results.emptyFolders.push({ id: folderId, name: folder.name, courseId: folder.courseId });
        }
      }

      // Check each course
      for (const [courseId, course] of Object.entries(courses)) {
        const courseFolders = course.folders || [];

        if (courseFolders.length === 0) {
          results.coursesWithoutFolders.push({ id: courseId, name: course.name });
          continue;
        }

        // Check folder array type
        const hasStrings = courseFolders.some(f => typeof f === 'string');
        const hasObjects = courseFolders.some(f => typeof f === 'object');

        if (hasStrings && hasObjects) {
          results.coursesWithMixedFolders.push({ id: courseId, name: course.name, folders: courseFolders });
        } else if (hasStrings) {
          results.coursesWithStringFolders.push({ id: courseId, name: course.name, count: courseFolders.length });
        } else if (hasObjects) {
          results.coursesWithObjectFolders.push({ id: courseId, name: course.name, count: courseFolders.length });
        }

        // Check for duplicate folder IDs
        const folderIds = hasStrings 
          ? courseFolders 
          : courseFolders.map(f => f.id || f);
        const uniqueIds = new Set(folderIds);
        if (uniqueIds.size !== folderIds.length) {
          results.duplicateFolderRefs.push({ id: courseId, name: course.name });
        }

        // Check if all course folders exist in folders collection
        for (const folderRef of courseFolders) {
          const folderId = typeof folderRef === 'string' ? folderRef : folderRef.id;
          if (folderId && !folders[folderId]) {
            results.foldersMissingFromCourses.push({
              courseId: courseId,
              courseName: course.name,
              folderId: folderId
            });
          }
        }
      }

      // Check reverse: folders not referenced in their courses
      for (const [folderId, folder] of Object.entries(folders)) {
        if (!folder.courseId || !courses[folder.courseId]) continue;

        const course = courses[folder.courseId];
        const courseFolders = course.folders || [];
        
        const isReferenced = courseFolders.some(f => {
          const id = typeof f === 'string' ? f : f.id;
          return id === folderId;
        });

        if (!isReferenced) {
          addLog(`⚠️ Folder "${folder.name}" (${folderId}) exists but not in course "${course.name}" folders array`, 'warning');
        }
      }

      setDiagnostics(results);
      addLog('Diagnostics complete!', 'success');
      
    } catch (error) {
      addLog(`Error: ${error.message}`, 'error');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fixDatabase = async () => {
    if (!diagnostics) return;
    
    setFixing(true);
    addLog('Starting database repair...', 'info');

    try {
      let fixed = 0;

      // 1. Delete empty orphaned folders
      addLog(`Deleting ${diagnostics.emptyFolders.length} empty folders...`, 'info');
      for (const folder of diagnostics.emptyFolders) {
        if (diagnostics.orphanedFolders.some(o => o.id === folder.id)) {
          await deleteDoc(doc(db, 'folders', folder.id));
          addLog(`✅ Deleted empty orphaned folder: ${folder.name}`, 'success');
          fixed++;
        }
      }

      // 2. Convert all courses to use string folder IDs (consistent format)
      addLog('Standardizing folder references to string IDs...', 'info');
      for (const course of [...diagnostics.coursesWithObjectFolders, ...diagnostics.coursesWithMixedFolders]) {
        const courseRef = doc(db, 'courses', course.id);
        const courseDoc = await getDocs(collection(db, 'courses'));
        const currentData = courseDoc.docs.find(d => d.id === course.id)?.data();
        
        if (currentData && currentData.folders) {
          const stringFolders = currentData.folders.map(f => 
            typeof f === 'string' ? f : f.id
          ).filter(id => id); // Remove any null/undefined

          // Remove duplicates
          const uniqueFolders = [...new Set(stringFolders)];

          await updateDoc(courseRef, { folders: uniqueFolders });
          addLog(`✅ Standardized folder IDs for course: ${course.name}`, 'success');
          fixed++;
        }
      }

      // 3. Remove references to non-existent folders from courses
      addLog('Removing invalid folder references...', 'info');
      for (const item of diagnostics.foldersMissingFromCourses) {
        const courseRef = doc(db, 'courses', item.courseId);
        const courseSnapshot = await getDocs(collection(db, 'courses'));
        const courseData = courseSnapshot.docs.find(d => d.id === item.courseId)?.data();
        
        if (courseData && courseData.folders) {
          const cleanedFolders = courseData.folders.filter(f => {
            const id = typeof f === 'string' ? f : f.id;
            return id !== item.folderId;
          });

          await updateDoc(courseRef, { folders: cleanedFolders });
          addLog(`✅ Removed invalid folder ref from: ${item.courseName}`, 'success');
          fixed++;
        }
      }

      addLog(`✅ Fixed ${fixed} issues!`, 'success');
      addLog('Running diagnostics again to verify...', 'info');
      
      // Re-run diagnostics
      await runDiagnostics();
      
    } catch (error) {
      addLog(`Error during fix: ${error.message}`, 'error');
      console.error(error);
    } finally {
      setFixing(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-3 mb-6">
          <Database className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold">Database Diagnostics & Repair</h1>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-red-800 mb-2 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Database Health Check
          </h3>
          <p className="text-red-700 text-sm">
            This tool analyzes your database for inconsistencies and can repair common issues.
          </p>
        </div>

        <div className="flex gap-4 mb-6">
          <button
            onClick={runDiagnostics}
            disabled={loading || fixing}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center gap-2"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Running...' : 'Run Diagnostics'}
          </button>

          {diagnostics && (
            <button
              onClick={fixDatabase}
              disabled={loading || fixing}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center gap-2"
            >
              <CheckCircle className="w-5 h-5" />
              {fixing ? 'Fixing...' : 'Auto-Fix Issues'}
            </button>
          )}
        </div>

        {/* Results */}
        {diagnostics && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-3xl font-bold text-blue-600">{diagnostics.totalCourses}</div>
                <div className="text-sm text-gray-600">Total Courses</div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="text-3xl font-bold text-purple-600">{diagnostics.totalFolders}</div>
                <div className="text-sm text-gray-600">Total Folders</div>
              </div>
            </div>

            {/* Issues */}
            <div className="space-y-4">
              {diagnostics.orphanedFolders.length > 0 && (
                <div className="border border-red-300 bg-red-50 rounded-lg p-4">
                  <h3 className="font-semibold text-red-800 mb-2 flex items-center gap-2">
                    <XCircle className="w-5 h-5" />
                    Orphaned Folders ({diagnostics.orphanedFolders.length})
                  </h3>
                  <div className="text-sm text-red-700 space-y-1">
                    {diagnostics.orphanedFolders.slice(0, 10).map(f => (
                      <div key={f.id}>• {f.name} (courseId: {f.courseId || 'none'})</div>
                    ))}
                    {diagnostics.orphanedFolders.length > 10 && (
                      <div className="text-red-600 font-semibold">...and {diagnostics.orphanedFolders.length - 10} more</div>
                    )}
                  </div>
                </div>
              )}

              {diagnostics.emptyFolders.length > 0 && (
                <div className="border border-yellow-300 bg-yellow-50 rounded-lg p-4">
                  <h3 className="font-semibold text-yellow-800 mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    Empty Folders ({diagnostics.emptyFolders.length})
                  </h3>
                  <div className="text-sm text-yellow-700 space-y-1">
                    {diagnostics.emptyFolders.slice(0, 10).map(f => (
                      <div key={f.id}>• {f.name}</div>
                    ))}
                    {diagnostics.emptyFolders.length > 10 && (
                      <div className="text-yellow-600 font-semibold">...and {diagnostics.emptyFolders.length - 10} more</div>
                    )}
                  </div>
                </div>
              )}

              {diagnostics.coursesWithMixedFolders.length > 0 && (
                <div className="border border-orange-300 bg-orange-50 rounded-lg p-4">
                  <h3 className="font-semibold text-orange-800 mb-2">
                    Courses with Mixed Folder Format ({diagnostics.coursesWithMixedFolders.length})
                  </h3>
                  <div className="text-sm text-orange-700">
                    {diagnostics.coursesWithMixedFolders.map(c => (
                      <div key={c.id}>• {c.name}</div>
                    ))}
                  </div>
                </div>
              )}

              {diagnostics.foldersMissingFromCourses.length > 0 && (
                <div className="border border-red-300 bg-red-50 rounded-lg p-4">
                  <h3 className="font-semibold text-red-800 mb-2">
                    Invalid Folder References ({diagnostics.foldersMissingFromCourses.length})
                  </h3>
                  <div className="text-sm text-red-700 space-y-1">
                    {diagnostics.foldersMissingFromCourses.slice(0, 10).map((item, i) => (
                      <div key={i}>• {item.courseName} → missing folder: {item.folderId}</div>
                    ))}
                  </div>
                </div>
              )}

              {diagnostics.coursesWithStringFolders.length > 0 && (
                <div className="border border-green-300 bg-green-50 rounded-lg p-4">
                  <h3 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    Courses with String Folder IDs ({diagnostics.coursesWithStringFolders.length})
                  </h3>
                  <p className="text-sm text-green-700">These are using the correct format ✓</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Logs */}
        {logs.length > 0 && (
          <div className="mt-6 bg-gray-900 rounded-lg p-4 max-h-96 overflow-y-auto">
            <h3 className="text-white font-semibold mb-2">Activity Log:</h3>
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
