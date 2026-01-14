import { useState } from 'react';
import { collection, addDoc, deleteDoc, getDocs, doc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Upload, Trash2, CheckCircle, AlertCircle } from 'lucide-react';

const Seed = () => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState(''); // 'success' or 'error'

  const sampleColleges = [
    {
      collegeId: "BITS_PILANI",
      name: "BITS Pilani",
      extensionUrl: "pilani.bits-pilani.ac.in",
      emailExtension: "@pilani.bits-pilani.ac.in",
      logo: "",
      links: [
        { name: "Library Portal", url: "https://www.bits-pilani.ac.in/library/" },
        { name: "SWD Website", url: "https://www.bits-pilani.ac.in/swd/" },
        { name: "AUGSD Portal", url: "https://www.bits-pilani.ac.in/augsd/" },
        { name: "Nalanda (LMS)", url: "https://nalanda.bits-pilani.ac.in/" },
        { name: "ERP Portal", url: "https://erp.bits-pilani.ac.in/" }
      ]
    },
    {
      collegeId: "IIT_DELHI",
      name: "IIT Delhi",
      extensionUrl: "iitd.ac.in",
      emailExtension: "@iitd.ac.in",
      logo: "",
      links: [
        { name: "Central Library", url: "https://library.iitd.ac.in/" },
        { name: "Academic Portal", url: "https://academics.iitd.ac.in/" },
        { name: "Moodle", url: "https://moodle.iitd.ac.in/" }
      ]
    }
  ];

  const sampleCourses = [
    {
      name: "MACHINE LEARNING",
      collegeId: "BITS_PILANI"
    },
    {
      name: "ARTIFICIAL INTELLIGENCE",
      collegeId: "BITS_PILANI"
    },
    {
      name: "DATA STRUCTURES",
      collegeId: "BITS_PILANI"
    },
    {
      name: "ALGORITHMS",
      collegeId: "IIT_DELHI"
    },
    {
      name: "DATABASE SYSTEMS",
      collegeId: "IIT_DELHI"
    }
  ];

  const sampleFolders = [
    {
      courseName: "MACHINE LEARNING",
      name: "Lecture Notes",
      uploadedBy: "Prince Gupta",
      files: [
        { name: "Lecture 1 - Introduction.pdf", url: "#", size: 2048576, mimeType: "application/pdf" },
        { name: "Lecture 2 - Regression.pdf", url: "#", size: 1843200, mimeType: "application/pdf" }
      ]
    },
    {
      courseName: "ARTIFICIAL INTELLIGENCE",
      name: "Assignment Solutions",
      uploadedBy: "Prince Gupta",
      files: [
        { name: "Assignment 1.pdf", url: "#", size: 5242880, mimeType: "application/pdf" }
      ]
    },
    {
      courseName: "DATA STRUCTURES",
      name: "Practice Problems",
      uploadedBy: "Prince Gupta",
      files: [
        { name: "Trees and Graphs.pdf", url: "#", size: 3145728, mimeType: "application/pdf" }
      ]
    }
  ];

  const sampleLeaderboard = [
    {
      displayName: "Prince Gupta",
      contributions: 955
    }
  ];

  const showMessage = (text, type) => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => {
      setMessage('');
      setMessageType('');
    }, 5000);
  };

  const seedColleges = async () => {
    setLoading(true);
    try {
      let count = 0;
      for (const college of sampleColleges) {
        await addDoc(collection(db, 'colleges'), {
          ...college,
          courses: [],
          createdAt: new Date().toISOString()
        });
        count++;
      }
      showMessage(`✅ Successfully added ${count} colleges!`, 'success');
    } catch (error) {
      console.error('Error seeding colleges:', error);
      showMessage(`❌ Error seeding colleges: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const seedCourses = async () => {
    setLoading(true);
    try {
      // Get all colleges first
      const collegesSnapshot = await getDocs(collection(db, 'colleges'));
      const collegesMap = {};
      collegesSnapshot.docs.forEach(doc => {
        const collegeData = doc.data();
        collegesMap[collegeData.collegeId] = { id: doc.id, ...collegeData };
      });

      let count = 0;
      for (const course of sampleCourses) {
        // Create course with folders array
        const courseDocRef = await addDoc(collection(db, 'courses'), {
          ...course,
          folders: [],
          createdAt: new Date().toISOString()
        });

        // Update parent college's courses array
        const parentCollege = collegesMap[course.collegeId];
        if (parentCollege) {
          const updatedCourses = [...(parentCollege.courses || []), courseDocRef.id];
          await updateDoc(doc(db, 'colleges', parentCollege.id), {
            courses: updatedCourses
          });
          // Update local map
          parentCollege.courses = updatedCourses;
        }

        count++;
      }
      showMessage(`✅ Successfully added ${count} courses!`, 'success');
    } catch (error) {
      console.error('Error seeding courses:', error);
      showMessage(`❌ Error seeding courses: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const seedFolders = async () => {
    setLoading(true);
    try {
      const coursesSnapshot = await getDocs(collection(db, 'courses'));
      const coursesMap = {};
      coursesSnapshot.docs.forEach(courseDoc => {
        const courseData = courseDoc.data();
        coursesMap[courseData.name] = { id: courseDoc.id, ...courseData };
      });

      let count = 0;
      for (const folder of sampleFolders) {
        const parentCourse = coursesMap[folder.courseName];
        if (parentCourse) {
          // Create folder
          const folderDocRef = await addDoc(collection(db, 'folders'), {
            courseId: parentCourse.id,
            name: folder.name,
            uploadedBy: folder.uploadedBy,
            uploadedById: 'seed_user',
            uploadedAt: new Date().toISOString(),
            files: folder.files || []
          });

          // Update parent course's folders array
          const updatedFolders = [...(parentCourse.folders || []), folderDocRef.id];
          await updateDoc(doc(db, 'courses', parentCourse.id), {
            folders: updatedFolders
          });
          // Update local map
          parentCourse.folders = updatedFolders;

          count++;
        }
      }
      showMessage(`✅ Successfully added ${count} folders!`, 'success');
    } catch (error) {
      console.error('Error seeding folders:', error);
      showMessage(`❌ Error seeding folders: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const seedLeaderboard = async () => {
    setLoading(true);
    try {
      let count = 0;
      for (const user of sampleLeaderboard) {
        await addDoc(collection(db, 'leaderboard'), {
          ...user,
          userId: `seed_user_${count}`,
          lastUpdated: new Date().toISOString()
        });
        count++;
      }
      showMessage(`✅ Successfully added ${count} leaderboard entries!`, 'success');
    } catch (error) {
      console.error('Error seeding leaderboard:', error);
      showMessage(`❌ Error seeding leaderboard: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const seedSkills = async () => {
    setLoading(true);
    try {
      const skills = [
        { id: 'tech', name: 'Tech', courses: [] },
        { id: 'productManagement', name: 'Product Management', courses: [] },
        { id: 'supplyChain', name: 'Supply Chain', courses: [] },
        { id: 'promptEngineering', name: 'Prompt Engineering', courses: [] },
        { id: 'finance', name: 'Finance', courses: [] }
      ];

      for (const skill of skills) {
        await setDoc(doc(db, 'skills', skill.id), {
          name: skill.name,
          courses: skill.courses
        });
      }
      
      showMessage(`✅ Successfully created ${skills.length} skill categories!`, 'success');
    } catch (error) {
      console.error('Error seeding skills:', error);
      showMessage(`❌ Error seeding skills: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const seedAll = async () => {
    setLoading(true);
    try {
      await seedColleges();
      await new Promise(resolve => setTimeout(resolve, 1000));
      await seedCourses();
      await new Promise(resolve => setTimeout(resolve, 1000));
      await seedFolders();
      await new Promise(resolve => setTimeout(resolve, 1000));
      await seedLeaderboard();
      await new Promise(resolve => setTimeout(resolve, 1000));
      await seedSkills();
      showMessage('✅ All data seeded successfully!', 'success');
    } catch (error) {
      showMessage(`❌ Error seeding data: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const clearCollection = async (collectionName) => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, collectionName));
      let count = 0;
      for (const doc of snapshot.docs) {
        await deleteDoc(doc.ref);
        count++;
      }
      showMessage(`✅ Deleted ${count} documents from ${collectionName}`, 'success');
    } catch (error) {
      console.error(`Error clearing ${collectionName}:`, error);
      showMessage(`❌ Error clearing ${collectionName}: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const clearAll = async () => {
    if (!window.confirm('Are you sure you want to delete ALL data? This cannot be undone!')) {
      return;
    }

    setLoading(true);
    try {
      await clearCollection('colleges');
      await clearCollection('courses');
      await clearCollection('folders');
      await clearCollection('leaderboard');
      await clearCollection('skills');
      showMessage('✅ All collections cleared!', 'success');
    } catch (error) {
      showMessage(`❌ Error clearing collections: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-8">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Database Seeder</h1>
            <p className="text-gray-600">Add sample data to your Firebase database</p>
          </div>

          {/* Message Display */}
          {message && (
            <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
              messageType === 'success' 
                ? 'bg-green-50 text-green-800 border border-green-200' 
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {messageType === 'success' ? (
                <CheckCircle size={20} />
              ) : (
                <AlertCircle size={20} />
              )}
              <span>{message}</span>
            </div>
          )}

          {/* Warning */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-yellow-800 text-sm">
              ⚠️ <strong>Warning:</strong> This will add sample data to your database. 
              Make sure to clear existing data if needed to avoid duplicates.
            </p>
          </div>

          {/* Seed Buttons */}
          <div className="space-y-4 mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-3">Seed Data</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={seedColleges}
                disabled={loading}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400"
              >
                <Upload size={18} />
                Seed Colleges ({sampleColleges.length})
              </button>

              <button
                onClick={seedCourses}
                disabled={loading}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400"
              >
                <Upload size={18} />
                Seed Courses ({sampleCourses.length})
              </button>

              <button
                onClick={seedFolders}
                disabled={loading}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors disabled:bg-gray-400"
              >
                <Upload size={18} />
                Seed Folders ({sampleFolders.length})
              </button>

              <button
                onClick={seedLeaderboard}
                disabled={loading}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:bg-gray-400"
              >
                <Upload size={18} />
                Seed Leaderboard ({sampleLeaderboard.length})
              </button>

              <button
                onClick={seedSkills}
                disabled={loading}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors disabled:bg-gray-400"
              >
                <Upload size={18} />
                Seed Skills (5)
              </button>

              <button
                onClick={seedAll}
                disabled={loading}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-gray-400 md:col-span-2"
              >
                <Upload size={18} />
                Seed All Data
              </button>
            </div>
          </div>

          {/* Clear Buttons */}
          <div className="space-y-4 border-t pt-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-3">Clear Data</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => clearCollection('colleges')}
                disabled={loading}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors disabled:bg-gray-400"
              >
                <Trash2 size={18} />
                Clear Colleges
              </button>

              <button
                onClick={() => clearCollection('courses')}
                disabled={loading}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors disabled:bg-gray-400"
              >
                <Trash2 size={18} />
                Clear Courses
              </button>

              <button
                onClick={() => clearCollection('folders')}
                disabled={loading}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors disabled:bg-gray-400"
              >
                <Trash2 size={18} />
                Clear Folders
              </button>

              <button
                onClick={() => clearCollection('leaderboard')}
                disabled={loading}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors disabled:bg-gray-400"
              >
                <Trash2 size={18} />
                Clear Leaderboard
              </button>

              <button
                onClick={() => clearCollection('skills')}
                disabled={loading}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors disabled:bg-gray-400"
              >
                <Trash2 size={18} />
                Clear Skills
              </button>

              <button
                onClick={clearAll}
                disabled={loading}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-400 md:col-span-2"
              >
                <Trash2 size={18} />
                Clear All Data
              </button>
            </div>
          </div>

          {/* Data Preview */}
          <div className="mt-8 border-t pt-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Sample Data Preview</h2>
            
            <div className="space-y-4">
              <details className="border rounded-lg">
                <summary className="px-4 py-3 cursor-pointer font-medium text-gray-700 hover:bg-gray-50">
                  Colleges ({sampleColleges.length})
                </summary>
                <div className="px-4 py-3 bg-gray-50 text-sm">
                  <pre className="overflow-x-auto">{JSON.stringify(sampleColleges, null, 2)}</pre>
                </div>
              </details>

              <details className="border rounded-lg">
                <summary className="px-4 py-3 cursor-pointer font-medium text-gray-700 hover:bg-gray-50">
                  Courses ({sampleCourses.length})
                </summary>
                <div className="px-4 py-3 bg-gray-50 text-sm">
                  <pre className="overflow-x-auto">{JSON.stringify(sampleCourses, null, 2)}</pre>
                </div>
              </details>

              <details className="border rounded-lg">
                <summary className="px-4 py-3 cursor-pointer font-medium text-gray-700 hover:bg-gray-50">
                  Folders ({sampleFolders.length})
                </summary>
                <div className="px-4 py-3 bg-gray-50 text-sm">
                  <pre className="overflow-x-auto">{JSON.stringify(sampleFolders, null, 2)}</pre>
                </div>
              </details>

              <details className="border rounded-lg">
                <summary className="px-4 py-3 cursor-pointer font-medium text-gray-700 hover:bg-gray-50">
                  Leaderboard ({sampleLeaderboard.length})
                </summary>
                <div className="px-4 py-3 bg-gray-50 text-sm">
                  <pre className="overflow-x-auto">{JSON.stringify(sampleLeaderboard, null, 2)}</pre>
                </div>
              </details>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Seed;
