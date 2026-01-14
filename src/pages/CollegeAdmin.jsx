import { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
  addDoc,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import {
  Building2,
  Users,
  BookOpen,
  Link as LinkIcon,
  Plus,
  X,
  Save,
  Trash2,
  Shield,
  UserPlus,
  UserMinus,
  Search,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import Avatar from "../components/Avatar";

const CollegeAdmin = () => {
  const { userProfile } = useAuth();
  const { isDarkMode } = useTheme();
  const [college, setCollege] = useState(null);
  const [courses, setCourses] = useState([]);
  const [collegeStudents, setCollegeStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showLinksModal, setShowLinksModal] = useState(false);
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);

  // Form states
  const [editingLinks, setEditingLinks] = useState([]);
  const [newCourseName, setNewCourseName] = useState("");
  const [searchStudents, setSearchStudents] = useState("");

  useEffect(() => {
    if (
      userProfile?.role === "superadmin" ||
      (userProfile?.role === "collegeadmin" && userProfile?.collegeId)
    ) {
      fetchCollegeData();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile]);

  const fetchCollegeData = async () => {
    try {
      // For superadmin without collegeId, show first college or all colleges
      let targetCollegeId = userProfile.collegeId;

      if (userProfile?.role === "superadmin" && !userProfile?.collegeId) {
        // Get first college for superadmin to view
        const allCollegesSnapshot = await getDocs(collection(db, "colleges"));
        if (!allCollegesSnapshot.empty) {
          targetCollegeId = allCollegesSnapshot.docs[0].data().collegeId;
        }
      }

      if (!targetCollegeId) {
        setLoading(false);
        return;
      }

      // Fetch college details
      const collegesQuery = query(
        collection(db, "colleges"),
        where("collegeId", "==", targetCollegeId)
      );
      const collegesSnapshot = await getDocs(collegesQuery);

      if (!collegesSnapshot.empty) {
        const collegeDoc = collegesSnapshot.docs[0];
        const collegeData = { id: collegeDoc.id, ...collegeDoc.data() };
        setCollege(collegeData);
        setEditingLinks(collegeData.links || []);
      }

      // Fetch courses for this college
      const coursesQuery = query(
        collection(db, "courses"),
        where("collegeId", "==", targetCollegeId)
      );
      const coursesSnapshot = await getDocs(coursesQuery);
      const coursesList = coursesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setCourses(coursesList);

      // Fetch students from this college
      const studentsQuery = query(
        collection(db, "users"),
        where("collegeId", "==", targetCollegeId)
      );
      const studentsSnapshot = await getDocs(studentsQuery);
      const studentsList = studentsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setCollegeStudents(studentsList);

      setLoading(false);
    } catch (error) {
      console.error("Error fetching college data:", error);
      setLoading(false);
    }
  };

  const updateCollegeLinks = async () => {
    try {
      const collegeRef = doc(db, "colleges", college.id);
      await updateDoc(collegeRef, { links: editingLinks });

      setCollege({ ...college, links: editingLinks });
      setShowLinksModal(false);
      toast.success("Links updated successfully");
    } catch (error) {
      console.error("Error updating links:", error);
      toast.error("Failed to update links");
    }
  };

  const addLink = () => {
    setEditingLinks([...editingLinks, { name: "", url: "" }]);
  };

  const updateLink = (index, field, value) => {
    const newLinks = [...editingLinks];
    newLinks[index][field] = value;
    setEditingLinks(newLinks);
  };

  const removeLink = (index) => {
    setEditingLinks(editingLinks.filter((_, i) => i !== index));
  };

  const createCourse = async () => {
    if (!newCourseName.trim()) {
      toast.error("Please enter a course name");
      return;
    }

    try {
      const newCourseRef = await addDoc(collection(db, "courses"), {
        name: newCourseName,
        collegeId: userProfile.collegeId,
        folders: [],
        createdAt: new Date().toISOString(),
      });

      // Update college's courses array
      const collegeRef = doc(db, "colleges", college.id);
      const updatedCourses = [...(college.courses || []), newCourseRef.id];
      await updateDoc(collegeRef, { courses: updatedCourses });

      toast.success("Course created successfully");
      setNewCourseName("");
      setShowCourseModal(false);
      fetchCollegeData();
    } catch (error) {
      console.error("Error creating course:", error);
      toast.error("Failed to create course");
    }
  };

  const deleteCourse = async (courseId) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this course? All folders and enrollments will be removed."
      )
    ) {
      return;
    }

    try {
      // Delete course document
      await deleteDoc(doc(db, "courses", courseId));

      // Update college's courses array
      const collegeRef = doc(db, "colleges", college.id);
      const updatedCourses = (college.courses || []).filter(
        (id) => id !== courseId
      );
      await updateDoc(collegeRef, { courses: updatedCourses });

      // Remove course from all users' enrolledCourses and adminCourses
      const usersSnapshot = await getDocs(collection(db, "users"));
      const updatePromises = [];

      usersSnapshot.docs.forEach((userDoc) => {
        const userData = userDoc.data();
        const enrolledCourses = (userData.enrolledCourses || []).filter(
          (id) => id !== courseId
        );
        const adminCourses = (userData.adminCourses || []).filter(
          (id) => id !== courseId
        );

        if (
          userData.enrolledCourses?.includes(courseId) ||
          userData.adminCourses?.includes(courseId)
        ) {
          updatePromises.push(
            updateDoc(doc(db, "users", userDoc.id), {
              enrolledCourses,
              adminCourses,
            })
          );
        }
      });

      await Promise.all(updatePromises);

      toast.success("Course deleted successfully");
      fetchCollegeData();
    } catch (error) {
      console.error("Error deleting course:", error);
      toast.error("Failed to delete course");
    }
  };

  const makeAdmin = async (userId, courseId) => {
    try {
      const userRef = doc(db, "users", userId);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        const adminCourses = userData.adminCourses || [];

        if (adminCourses.includes(courseId)) {
          toast.error("User is already an admin of this course");
          return;
        }

        await updateDoc(userRef, {
          role: "admin",
          adminCourses: [...adminCourses, courseId],
        });

        toast.success("Admin assigned successfully");
        fetchCollegeData();
      }
    } catch (error) {
      console.error("Error making admin:", error);
      toast.error("Failed to assign admin");
    }
  };

  const removeAdmin = async (userId, courseId) => {
    if (!window.confirm("Are you sure you want to remove this admin?")) {
      return;
    }

    try {
      const userRef = doc(db, "users", userId);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        const adminCourses = (userData.adminCourses || []).filter(
          (id) => id !== courseId
        );

        // If user has no more admin courses, change role back to user
        const newRole = adminCourses.length === 0 ? "user" : "admin";

        await updateDoc(userRef, {
          role: newRole,
          adminCourses: adminCourses,
        });

        toast.success("Admin removed successfully");
        fetchCollegeData();
      }
    } catch (error) {
      console.error("Error removing admin:", error);
      toast.error("Failed to remove admin");
    }
  };

  const getAdminsForCourse = (courseId) => {
    return collegeStudents.filter(
      (student) =>
        student.role === "admin" && student.adminCourses?.includes(courseId)
    );
  };

  const filteredStudents = collegeStudents.filter(
    (student) =>
      student.displayName
        ?.toLowerCase()
        .includes(searchStudents.toLowerCase()) ||
      student.email?.toLowerCase().includes(searchStudents.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }

  if (
    userProfile?.role !== "superadmin" &&
    userProfile?.role !== "collegeadmin"
  ) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Building2 size={64} className="text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Access Denied
          </h2>
          <p className="text-gray-600">You don't have college admin access.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: { background: "#363636", color: "#fff" },
          success: { style: { background: "#10b981" } },
          error: { style: { background: "#ef4444" } },
        }}
      />

      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-8 py-8">
          <div className="flex items-center gap-3 mb-2">
            <Building2 size={40} />
            <div>
              <h1 className="text-3xl font-bold">College Admin Panel</h1>
              <p className="text-purple-100">{college?.name}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="max-w-7xl mx-auto px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm mb-1">Total Courses</p>
                <p className="text-3xl font-bold text-gray-800">
                  {courses.length}
                </p>
              </div>
              <BookOpen size={40} className="text-purple-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm mb-1">Total Students</p>
                <p className="text-3xl font-bold text-gray-800">
                  {collegeStudents.length}
                </p>
              </div>
              <Users size={40} className="text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm mb-1">Quick Links</p>
                <p className="text-3xl font-bold text-gray-800">
                  {college?.links?.length || 0}
                </p>
              </div>
              <LinkIcon size={40} className="text-green-500" />
            </div>
          </div>
        </div>

        {/* Quick Links Management */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
              <LinkIcon size={24} />
              Quick Links Management
            </h2>
            <button
              onClick={() => setShowLinksModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Save size={18} />
              Edit Links
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(college?.links || []).map((link, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg"
              >
                <LinkIcon size={18} className="text-purple-600" />
                <div className="flex-1">
                  <div className="font-medium text-gray-800">{link.name}</div>
                  <div className="text-sm text-gray-500 truncate">
                    {link.url}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Courses Management */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
              <BookOpen size={24} />
              Courses Management
            </h2>
            <button
              onClick={() => setShowCourseModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Plus size={18} />
              Add Course
            </button>
          </div>

          <div className="space-y-4">
            {courses.map((course) => {
              const admins = getAdminsForCourse(course.id);
              return (
                <div
                  key={course.id}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">
                        {course.name}
                      </h3>
                      <p className="text-sm text-gray-500">
                        Created{" "}
                        {new Date(course.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedCourse(course);
                          setShowAdminModal(true);
                        }}
                        className="flex items-center gap-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                      >
                        <Shield size={16} />
                        Manage Admins
                      </button>
                      <button
                        onClick={() => deleteCourse(course.id)}
                        className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>

                  {admins.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        Course Admins:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {admins.map((admin) => (
                          <div
                            key={admin.id}
                            className="flex items-center gap-2 px-3 py-1 bg-blue-50 rounded-full text-sm"
                          >
                            <Avatar
                              photoURL={admin.photoURL}
                              displayName={admin.displayName}
                              size="xs"
                            />
                            <span className="text-gray-700">
                              {admin.displayName}
                            </span>
                            <button
                              onClick={() => removeAdmin(admin.id, course.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Edit Links Modal */}
      {showLinksModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="text-xl font-bold text-gray-800">
                Edit Quick Links
              </h3>
              <button
                onClick={() => setShowLinksModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {editingLinks.map((link, index) => (
                <div key={index} className="flex gap-3 items-start">
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      placeholder="Link Name"
                      value={link.name}
                      onChange={(e) =>
                        updateLink(index, "name", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <input
                      type="url"
                      placeholder="URL"
                      value={link.url}
                      onChange={(e) => updateLink(index, "url", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <button
                    onClick={() => removeLink(index)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              ))}

              <button
                onClick={addLink}
                className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-purple-500 hover:text-purple-600 transition-colors"
              >
                <Plus size={20} className="inline mr-2" />
                Add Link
              </button>
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setShowLinksModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={updateCollegeLinks}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Course Modal */}
      {showCourseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-800">
                Create New Course
              </h3>
              <button
                onClick={() => setShowCourseModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6">
              <input
                type="text"
                placeholder="Course Name"
                value={newCourseName}
                onChange={(e) => setNewCourseName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setShowCourseModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createCourse}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Create Course
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Admins Modal */}
      {showAdminModal && selectedCourse && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="text-xl font-bold text-gray-800">
                Manage Admins - {selectedCourse.name}
              </h3>
              <button
                onClick={() => setShowAdminModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-4">
                <div className="relative">
                  <Search
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                    size={20}
                  />
                  <input
                    type="text"
                    placeholder="Search students..."
                    value={searchStudents}
                    onChange={(e) => setSearchStudents(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredStudents.map((student) => {
                  const isAdmin = student.adminCourses?.includes(
                    selectedCourse.id
                  );
                  return (
                    <div
                      key={student.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar
                          photoURL={student.photoURL}
                          displayName={student.displayName}
                          size="md"
                        />
                        <div>
                          <div className="font-medium text-gray-800">
                            {student.displayName}
                          </div>
                          <div className="text-sm text-gray-500">
                            {student.email}
                          </div>
                        </div>
                      </div>
                      {isAdmin ? (
                        <button
                          onClick={() =>
                            removeAdmin(student.id, selectedCourse.id)
                          }
                          className="flex items-center gap-2 px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                        >
                          <UserMinus size={16} />
                          Remove Admin
                        </button>
                      ) : (
                        <button
                          onClick={() =>
                            makeAdmin(student.id, selectedCourse.id)
                          }
                          className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                        >
                          <UserPlus size={16} />
                          Make Admin
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CollegeAdmin;
