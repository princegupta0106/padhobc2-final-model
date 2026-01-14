import { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  deleteDoc,
  setDoc,
  getDoc,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import {
  Shield,
  User,
  Trash2,
  Plus,
  Save,
  Building2,
  BookOpen,
  X,
  Link as LinkIcon,
  GraduationCap,
  Upload,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import Avatar from "../components/Avatar";
import { useNavigate } from "react-router-dom";

const SuperAdmin = () => {
  const { userProfile } = useAuth();
  const { isDarkMode } = useTheme();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [skills, setSkills] = useState([]);
  const [deletedItems, setDeletedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [editingCollege, setEditingCollege] = useState(null);
  const [editingSkill, setEditingSkill] = useState(null);
  const [editingCourse, setEditingCourse] = useState(null);
  const [selectedCourses, setSelectedCourses] = useState([]);
  const [showCreateCourse, setShowCreateCourse] = useState(false);
  const [showCreateCollege, setShowCreateCollege] = useState(false);
  const [showDeletedItems, setShowDeletedItems] = useState(false);
  const [newCourse, setNewCourse] = useState({ name: "", collegeId: "" });
  const [newCollege, setNewCollege] = useState({
    collegeId: "",
    name: "",
    extensionUrl: "",
    emailExtensions: [],
    logo: "",
    links: [],
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch all users
        const usersSnapshot = await getDocs(collection(db, "users"));
        const usersList = usersSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Fetch all colleges
        const collegesSnapshot = await getDocs(collection(db, "colleges"));
        const collegesList = collegesSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Fetch all courses
        const coursesSnapshot = await getDocs(collection(db, "courses"));
        const coursesList = coursesSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Fetch all skills
        const skillsSnapshot = await getDocs(collection(db, "skills"));
        const skillsList = skillsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Fetch deleted items (folders)
        const foldersSnapshot = await getDocs(collection(db, "folders"));
        const deletedFolders = foldersSnapshot.docs
          .filter((doc) => doc.data().deleted === true)
          .map((doc) => ({
            id: doc.id,
            type: "folder",
            ...doc.data(),
          }));

        setUsers(usersList);
        setColleges(collegesList);
        setCourses(coursesList);
        setSkills(skillsList);
        setDeletedItems(deletedFolders);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching data:", error);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const updateUserRole = async (userId, role, adminCourses = []) => {
    try {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        role,
        adminCourses: role === "admin" ? adminCourses : [],
        isPremium: editingUser.isPremium || false,
      });

      // Update local state
      setUsers(
        users.map((u) =>
          u.id === userId
            ? {
                ...u,
                role,
                adminCourses: role === "admin" ? adminCourses : [],
                isPremium: editingUser.isPremium || false,
              }
            : u
        )
      );

      setEditingUser(null);
      toast.success("User updated successfully");
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error("Failed to update user");
    }
  };

  const startEditingUser = (user) => {
    setEditingUser(user);
    setSelectedCourses(user.adminCourses || []);
  };

  const toggleCourseSelection = (courseId) => {
    setSelectedCourses((prev) =>
      prev.includes(courseId)
        ? prev.filter((id) => id !== courseId)
        : [...prev, courseId]
    );
  };

  const createCourse = async () => {
    if (!newCourse.name.trim()) {
      toast.error("Please enter a course name");
      return;
    }

    try {
      // Create course with folders array
      const docRef = await addDoc(collection(db, "courses"), {
        name: newCourse.name,
        collegeId: newCourse.collegeId || null,
        folders: [],
        createdAt: new Date().toISOString(),
      });

      // Find the parent college and update its courses array (only if college is specified)
      if (newCourse.collegeId) {
        const parentCollege = colleges.find(
          (c) => c.collegeId === newCourse.collegeId
        );
        if (parentCollege) {
          const collegeRef = doc(db, "colleges", parentCollege.id);
          const updatedCourses = [...(parentCollege.courses || []), docRef.id];
          await updateDoc(collegeRef, {
            courses: updatedCourses,
          });

          // Update local state
          setColleges(
            colleges.map((c) =>
              c.id === parentCollege.id ? { ...c, courses: updatedCourses } : c
            )
          );
        }
      }

      const createdCourse = {
        id: docRef.id,
        name: newCourse.name,
        collegeId: newCourse.collegeId,
        folders: [],
        createdAt: new Date().toISOString(),
      };

      setCourses([...courses, createdCourse]);
      setNewCourse({ name: "", collegeId: "" });
      setShowCreateCourse(false);
      toast.success("Course created successfully");
    } catch (error) {
      console.error("Error creating course:", error);
      toast.error("Failed to create course");
    }
  };

  const createCollege = async () => {
    if (
      !newCollege.collegeId.trim() ||
      !newCollege.name.trim() ||
      newCollege.emailExtensions.length === 0
    ) {
      toast.error(
        "Please fill in College ID, Name, and at least one Email Extension"
      );
      return;
    }

    try {
      const docRef = await addDoc(collection(db, "colleges"), {
        collegeId: newCollege.collegeId,
        name: newCollege.name,
        extensionUrl: newCollege.extensionUrl,
        emailExtensions: newCollege.emailExtensions,
        logo: newCollege.logo,
        courses: [],
        links: newCollege.links.filter((link) => link.name && link.url), // Only save valid links
        createdAt: new Date().toISOString(),
      });

      const createdCollege = {
        id: docRef.id,
        collegeId: newCollege.collegeId,
        name: newCollege.name,
        extensionUrl: newCollege.extensionUrl,
        emailExtensions: newCollege.emailExtensions,
        logo: newCollege.logo,
        courses: [],
        links: newCollege.links.filter((link) => link.name && link.url),
        createdAt: new Date().toISOString(),
      };

      setColleges([...colleges, createdCollege]);
      setNewCollege({
        collegeId: "",
        name: "",
        extensionUrl: "",
        emailExtensions: [],
        logo: "",
        links: [],
      });
      setShowCreateCollege(false);
      toast.success("College created successfully");
    } catch (error) {
      console.error("Error creating college:", error);
      toast.error("Failed to create college");
    }
  };

  const deleteCourse = async (courseId) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this course? This will also remove it from the parent college."
      )
    ) {
      return;
    }

    try {
      const courseToDelete = courses.find((c) => c.id === courseId);

      // Remove course from parent college's courses array
      const parentCollege = colleges.find(
        (c) => c.collegeId === courseToDelete.collegeId
      );
      if (parentCollege) {
        const collegeRef = doc(db, "colleges", parentCollege.id);
        const updatedCourses = (parentCollege.courses || []).filter(
          (id) => id !== courseId
        );
        await updateDoc(collegeRef, { courses: updatedCourses });
      }

      // Delete the course
      await deleteDoc(doc(db, "courses", courseId));

      setCourses(courses.filter((c) => c.id !== courseId));
      toast.success("Course deleted successfully");
    } catch (error) {
      console.error("Error deleting course:", error);
      toast.error("Failed to delete course");
    }
  };

  const restoreItem = async (item) => {
    try {
      if (item.type === "folder") {
        await updateDoc(doc(db, "folders", item.id), {
          deleted: false,
          deletedAt: null,
          deletedBy: null,
        });
        setDeletedItems(deletedItems.filter((i) => i.id !== item.id));
        toast.success("Folder restored successfully");
      }
    } catch (error) {
      console.error("Error restoring item:", error);
      toast.error("Failed to restore item");
    }
  };

  const permanentlyDeleteItem = async (item) => {
    if (
      !window.confirm(
        "Are you sure you want to permanently delete this? This cannot be undone!"
      )
    ) {
      return;
    }

    try {
      if (item.type === "folder") {
        await deleteDoc(doc(db, "folders", item.id));
        setDeletedItems(deletedItems.filter((i) => i.id !== item.id));
        toast.success("Item permanently deleted");
      }
    } catch (error) {
      console.error("Error permanently deleting item:", error);
      toast.error("Failed to delete item");
    }
  };

  const deleteCollege = async (collegeId) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this college? All associated courses will also be affected."
      )
    ) {
      return;
    }

    try {
      await deleteDoc(doc(db, "colleges", collegeId));
      setColleges(colleges.filter((c) => c.id !== collegeId));
      toast.success("College deleted successfully");
    } catch (error) {
      console.error("Error deleting college:", error);
      toast.error("Failed to delete college");
    }
  };

  const updateCollegeLinks = async (college) => {
    try {
      const collegeRef = doc(db, "colleges", college.id);
      const validLinks = college.links.filter((link) => link.name && link.url);

      await updateDoc(collegeRef, {
        links: validLinks,
      });

      setColleges(
        colleges.map((c) =>
          c.id === college.id ? { ...c, links: validLinks } : c
        )
      );

      setEditingCollege(null);
      toast.success("Links updated successfully");
    } catch (error) {
      console.error("Error updating links:", error);
      toast.error("Failed to update links");
    }
  };

  const updateCollege = async (college) => {
    if (
      !college.collegeId.trim() ||
      !college.name.trim() ||
      college.emailExtensions.length === 0
    ) {
      toast.error(
        "Please fill in College ID, Name, and at least one Email Extension"
      );
      return;
    }

    try {
      const collegeRef = doc(db, "colleges", college.id);
      const validLinks = college.links.filter((link) => link.name && link.url);
      const validExtensions = college.emailExtensions.filter((ext) =>
        ext.trim()
      );

      await updateDoc(collegeRef, {
        collegeId: college.collegeId,
        name: college.name,
        extensionUrl: college.extensionUrl || "",
        emailExtensions: validExtensions,
        logo: college.logo || "",
        links: validLinks,
      });

      setColleges(
        colleges.map((c) =>
          c.id === college.id
            ? {
                ...college,
                links: validLinks,
                emailExtensions: validExtensions,
              }
            : c
        )
      );

      setEditingCollege(null);
      toast.success("College updated successfully");
    } catch (error) {
      console.error("Error updating college:", error);
      toast.error("Failed to update college");
    }
  };

  const updateCourse = async (course) => {
    try {
      const courseRef = doc(db, "courses", course.id);
      const oldCollegeId = courses.find((c) => c.id === course.id)?.collegeId;

      // Update course document
      await updateDoc(courseRef, {
        collegeId: course.collegeId || null,
      });

      // If college changed, update both old and new college's courses arrays
      if (oldCollegeId !== course.collegeId) {
        // Remove from old college if it had one
        if (oldCollegeId) {
          const oldCollege = colleges.find((c) => c.collegeId === oldCollegeId);
          if (oldCollege) {
            const oldCollegeRef = doc(db, "colleges", oldCollege.id);
            const updatedOldCourses = (oldCollege.courses || []).filter(
              (id) => id !== course.id
            );
            await updateDoc(oldCollegeRef, { courses: updatedOldCourses });
          }
        }

        // Add to new college if specified
        if (course.collegeId) {
          const newCollege = colleges.find(
            (c) => c.collegeId === course.collegeId
          );
          if (newCollege) {
            const newCollegeRef = doc(db, "colleges", newCollege.id);
            const updatedNewCourses = [
              ...(newCollege.courses || []),
              course.id,
            ];
            await updateDoc(newCollegeRef, { courses: updatedNewCourses });
          }
        }
      }

      // Update local state
      setCourses(
        courses.map((c) =>
          c.id === course.id ? { ...c, collegeId: course.collegeId || null } : c
        )
      );

      setEditingCourse(null);
      toast.success("Course updated successfully");

      // Refresh data to get updated college courses
      const collegesSnapshot = await getDocs(collection(db, "colleges"));
      const collegesList = collegesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setColleges(collegesList);
    } catch (error) {
      console.error("Error updating course:", error);
      toast.error("Failed to update course");
    }
  };

  if (userProfile?.role !== "superadmin") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-sm text-center">
          <Shield size={48} className="text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            Access Denied
          </h1>
          <p className="text-gray-600">
            You don't have permission to access this page.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: "#363636",
            color: "#fff",
          },
          success: {
            style: {
              background: "#10b981",
            },
          },
          error: {
            style: {
              background: "#ef4444",
            },
          },
        }}
      />
      <div className="max-w-7xl mx-auto px-8">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <Shield size={32} className="text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-800">
                Super Admin Panel
              </h1>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => navigate("/bulk-upload")}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <Upload size={18} />
                Bulk Upload
              </button>
              <button
                onClick={() => setShowDeletedItems(true)}
                className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
              >
                <Trash2 size={18} />
                Deleted ({deletedItems.length})
              </button>
              <button
                onClick={() => setShowCreateCollege(true)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Building2 size={18} />
                New College
              </button>
              <button
                onClick={() => setShowCreateCourse(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <BookOpen size={18} />
                New Course
              </button>
            </div>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-blue-50 p-6 rounded-lg">
              <p className="text-sm text-blue-600 font-medium mb-2">
                Total Users
              </p>
              <p className="text-3xl font-bold text-blue-900">{users.length}</p>
            </div>
            <div className="bg-green-50 p-6 rounded-lg">
              <p className="text-sm text-green-600 font-medium mb-2">
                Total Colleges
              </p>
              <p className="text-3xl font-bold text-green-900">
                {colleges.length}
              </p>
            </div>
            <div className="bg-yellow-50 p-6 rounded-lg">
              <p className="text-sm text-yellow-600 font-medium mb-2">
                Total Courses
              </p>
              <p className="text-3xl font-bold text-yellow-900">
                {courses.length}
              </p>
            </div>
            <div className="bg-purple-50 p-6 rounded-lg">
              <p className="text-sm text-purple-600 font-medium mb-2">Admins</p>
              <p className="text-3xl font-bold text-purple-900">
                {users.filter((u) => u.role === "admin").length}
              </p>
            </div>
          </div>

          {/* Users Table */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Manage Users
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                      Email
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                      Role
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                      Admin Courses
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar
                            photoURL={user.photoURL}
                            displayName={user.displayName}
                            size="sm"
                          />
                          <span className="text-sm font-medium text-gray-800">
                            {user.displayName}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {user.email}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            user.role === "superadmin"
                              ? "bg-red-100 text-red-800"
                              : user.role === "collegeadmin"
                              ? "bg-purple-100 text-purple-800"
                              : user.role === "admin"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {user.role || "user"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {user.isPremium && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                            ⭐ Premium
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {user.role === "admin" && user.adminCourses?.length > 0
                          ? `${user.adminCourses.length} courses`
                          : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => startEditingUser(user)}
                            className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded hover:bg-blue-200 transition-colors"
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Colleges Management */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Manage Colleges
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {colleges.map((college) => (
                <div
                  key={college.id}
                  className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">
                        {college.name}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {college.collegeId}
                      </p>
                    </div>
                    <button
                      onClick={() => deleteCollege(college.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Delete College"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  <div className="space-y-2 mb-4">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Courses:</span>{" "}
                      {college.courses?.length || 0}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Links:</span>{" "}
                      {college.links?.length || 0}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Email Extensions:</span>{" "}
                      {college.emailExtensions?.length || 0}
                    </p>
                  </div>

                  <button
                    onClick={() =>
                      setEditingCollege({
                        ...college,
                        links: college.links || [],
                        emailExtensions: college.emailExtensions || [],
                      })
                    }
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    Edit College
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Courses Management */}
          <div>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Manage Courses
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                      Course Name
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                      College
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                      Folders
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {courses.map((course) => {
                    const college = colleges.find(
                      (c) => c.collegeId === course.collegeId
                    );
                    return (
                      <tr key={course.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-800">
                          {course.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {course.collegeId
                            ? college?.name || course.collegeId
                            : "Skill Course"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {course.folders?.length || 0} folders
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditingCourse(course)}
                              className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded hover:bg-blue-200 transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deleteCourse(course.id)}
                              className="px-3 py-1 bg-red-100 text-red-700 text-sm rounded hover:bg-red-200 transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Skills Management */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-800">
                Manage Skills
              </h2>
              <p className="text-sm text-gray-600">
                Add or remove courses from each skill category
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                      Skill Name
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                      Skill ID
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                      Courses
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {skills
                    .filter((s) =>
                      [
                        "tech",
                        "productManagement",
                        "supplyChain",
                        "promptEngineering",
                        "finance",
                      ].includes(s.id)
                    )
                    .map((skill) => (
                      <tr key={skill.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-800">
                          {skill.id === "tech" && "Tech"}
                          {skill.id === "productManagement" &&
                            "Product Management"}
                          {skill.id === "supplyChain" && "Supply Chain"}
                          {skill.id === "promptEngineering" &&
                            "Prompt Engineering"}
                          {skill.id === "finance" && "Finance"}
                          {![
                            "tech",
                            "productManagement",
                            "supplyChain",
                            "promptEngineering",
                            "finance",
                          ].includes(skill.id) && skill.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {skill.id}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {skill.courses?.length || 0} courses
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => {
                              setEditingSkill(skill);
                            }}
                            className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded hover:bg-blue-200 transition-colors"
                          >
                            Edit Courses
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Edit College Modal */}
        {editingCollege && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl p-8 max-w-3xl w-full max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-800">
                  Edit College
                </h2>
                <button
                  onClick={() => setEditingCollege(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="overflow-y-auto flex-1 space-y-6">
                {/* College ID */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    College ID *
                  </label>
                  <input
                    type="text"
                    value={editingCollege.collegeId}
                    onChange={(e) =>
                      setEditingCollege({
                        ...editingCollege,
                        collegeId: e.target.value,
                      })
                    }
                    placeholder="e.g., BITS_PILANI"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* College Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    College Name *
                  </label>
                  <input
                    type="text"
                    value={editingCollege.name}
                    onChange={(e) =>
                      setEditingCollege({
                        ...editingCollege,
                        name: e.target.value,
                      })
                    }
                    placeholder="e.g., BITS Pilani"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Email Extensions */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Extensions *
                  </label>
                  <div className="space-y-2">
                    {editingCollege.emailExtensions.map((ext, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          value={ext}
                          onChange={(e) => {
                            const updated = [...editingCollege.emailExtensions];
                            updated[index] = e.target.value.toLowerCase();
                            setEditingCollege({
                              ...editingCollege,
                              emailExtensions: updated,
                            });
                          }}
                          placeholder="e.g., @pilani.bits-pilani.ac.in"
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const updated =
                              editingCollege.emailExtensions.filter(
                                (_, i) => i !== index
                              );
                            setEditingCollege({
                              ...editingCollege,
                              emailExtensions: updated,
                            });
                          }}
                          className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        setEditingCollege({
                          ...editingCollege,
                          emailExtensions: [
                            ...editingCollege.emailExtensions,
                            "",
                          ],
                        })
                      }
                      className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-500"
                    >
                      + Add Email Extension
                    </button>
                  </div>
                </div>

                {/* Website URL */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Website URL
                  </label>
                  <input
                    type="url"
                    value={editingCollege.extensionUrl || ""}
                    onChange={(e) =>
                      setEditingCollege({
                        ...editingCollege,
                        extensionUrl: e.target.value,
                      })
                    }
                    placeholder="https://www.college.edu"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Logo URL */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Logo URL
                  </label>
                  <input
                    type="url"
                    value={editingCollege.logo || ""}
                    onChange={(e) =>
                      setEditingCollege({
                        ...editingCollege,
                        logo: e.target.value,
                      })
                    }
                    placeholder="https://example.com/logo.png"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Links Section */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    College Links
                  </label>
                  <div className="space-y-2">
                    {editingCollege.links.map((link, index) => (
                      <div
                        key={index}
                        className="flex gap-2 items-start p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex-1 space-y-2">
                          <input
                            type="text"
                            value={link.name}
                            onChange={(e) => {
                              const updatedLinks = [...editingCollege.links];
                              updatedLinks[index].name = e.target.value;
                              setEditingCollege({
                                ...editingCollege,
                                links: updatedLinks,
                              });
                            }}
                            placeholder="Link name (e.g., Library Portal)"
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          <input
                            type="url"
                            value={link.url}
                            onChange={(e) => {
                              const updatedLinks = [...editingCollege.links];
                              updatedLinks[index].url = e.target.value;
                              setEditingCollege({
                                ...editingCollege,
                                links: updatedLinks,
                              });
                            }}
                            placeholder="URL (e.g., https://library.college.edu)"
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                        <button
                          onClick={() => {
                            const updatedLinks = editingCollege.links.filter(
                              (_, i) => i !== index
                            );
                            setEditingCollege({
                              ...editingCollege,
                              links: updatedLinks,
                            });
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => {
                      setEditingCollege({
                        ...editingCollege,
                        links: [...editingCollege.links, { name: "", url: "" }],
                      });
                    }}
                    className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 text-gray-600 hover:text-blue-600 transition-colors"
                  >
                    <LinkIcon size={16} />
                    Add Link
                  </button>
                </div>
              </div>

              <div className="flex gap-4 mt-6 pt-4 border-t">
                <button
                  onClick={() => updateCollege(editingCollege)}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Save size={18} />
                  Save Changes
                </button>
                <button
                  onClick={() => setEditingCollege(null)}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit User Modal */}
        {editingUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-2xl p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">
                Edit User: {editingUser.displayName}
              </h2>

              {/* Premium Status Toggle */}
              <div className="mb-6">
                <label className="flex items-center gap-3 p-4 border-2 border-amber-200 rounded-lg cursor-pointer hover:bg-amber-50 bg-amber-50/50">
                  <input
                    type="checkbox"
                    checked={editingUser.isPremium || false}
                    onChange={(e) =>
                      setEditingUser({
                        ...editingUser,
                        isPremium: e.target.checked,
                      })
                    }
                    className="w-5 h-5 text-amber-600 rounded focus:ring-amber-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-800">
                        Premium Member
                      </p>
                      <span className="text-amber-500">⭐</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Give this user premium status and benefits
                    </p>
                  </div>
                </label>
              </div>

              {/* Role Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Select Role
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="role"
                      value="user"
                      checked={editingUser.role === "user"}
                      onChange={(e) =>
                        setEditingUser({ ...editingUser, role: e.target.value })
                      }
                      className="w-4 h-4"
                    />
                    <div>
                      <p className="font-medium text-gray-800">User</p>
                      <p className="text-sm text-gray-500">
                        Regular user access
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="role"
                      value="admin"
                      checked={editingUser.role === "admin"}
                      onChange={(e) =>
                        setEditingUser({ ...editingUser, role: e.target.value })
                      }
                      className="w-4 h-4"
                    />
                    <div>
                      <p className="font-medium text-gray-800">Admin</p>
                      <p className="text-sm text-gray-500">
                        Can manage selected courses
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="role"
                      value="collegeadmin"
                      checked={editingUser.role === "collegeadmin"}
                      onChange={(e) =>
                        setEditingUser({ ...editingUser, role: e.target.value })
                      }
                      className="w-4 h-4"
                    />
                    <div>
                      <p className="font-medium text-gray-800">College Admin</p>
                      <p className="text-sm text-gray-500">
                        Can manage all courses in their college
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="role"
                      value="superadmin"
                      checked={editingUser.role === "superadmin"}
                      onChange={(e) =>
                        setEditingUser({ ...editingUser, role: e.target.value })
                      }
                      className="w-4 h-4"
                    />
                    <div>
                      <p className="font-medium text-gray-800">Super Admin</p>
                      <p className="text-sm text-gray-500">
                        Full system access
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Course Selection for Admin */}
              {editingUser.role === "admin" && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Select Courses to Manage ({selectedCourses.length} selected)
                  </label>
                  <div className="border rounded-lg max-h-60 overflow-y-auto">
                    {courses.map((course) => (
                      <label
                        key={course.id}
                        className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                      >
                        <input
                          type="checkbox"
                          checked={selectedCourses.includes(course.id)}
                          onChange={() => toggleCourseSelection(course.id)}
                          className="w-4 h-4"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-gray-800">
                            {course.name}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-4">
                <button
                  onClick={() =>
                    updateUserRole(
                      editingUser.id,
                      editingUser.role,
                      selectedCourses
                    )
                  }
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Save size={18} />
                  Save Changes
                </button>
                <button
                  onClick={() => {
                    setEditingUser(null);
                    setSelectedCourses([]);
                  }}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create Course Modal */}
        {showCreateCourse && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-800">
                  Create New Course
                </h2>
                <button
                  onClick={() => {
                    setShowCreateCourse(false);
                    setNewCourse({ name: "", collegeId: "" });
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Course Name *
                  </label>
                  <input
                    type="text"
                    value={newCourse.name}
                    onChange={(e) =>
                      setNewCourse({ ...newCourse, name: e.target.value })
                    }
                    placeholder="e.g., MACHINE LEARNING"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    College (Optional - leave empty for skill courses)
                  </label>
                  <select
                    value={newCourse.collegeId}
                    onChange={(e) =>
                      setNewCourse({ ...newCourse, collegeId: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">No College (Skill Course)</option>
                    {colleges.map((college) => (
                      <option key={college.id} value={college.collegeId}>
                        {college.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-4 mt-6">
                <button
                  onClick={createCourse}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus size={18} />
                  Create Course
                </button>
                <button
                  onClick={() => {
                    setShowCreateCourse(false);
                    setNewCourse({ name: "", collegeId: "" });
                  }}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create College Modal */}
        {showCreateCollege && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-800">
                  Create New College
                </h2>
                <button
                  onClick={() => {
                    setShowCreateCollege(false);
                    setNewCollege({
                      collegeId: "",
                      name: "",
                      extensionUrl: "",
                      emailExtensions: [],
                      logo: "",
                      links: [],
                    });
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    College ID *
                  </label>
                  <input
                    type="text"
                    value={newCollege.collegeId}
                    onChange={(e) =>
                      setNewCollege({
                        ...newCollege,
                        collegeId: e.target.value.toUpperCase(),
                      })
                    }
                    placeholder="e.g., BITS_PILANI"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Use UPPERCASE with underscores
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    College Name *
                  </label>
                  <input
                    type="text"
                    value={newCollege.name}
                    onChange={(e) =>
                      setNewCollege({ ...newCollege, name: e.target.value })
                    }
                    placeholder="e.g., BITS Pilani"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Extensions *
                  </label>
                  <div className="space-y-2">
                    {newCollege.emailExtensions.map((ext, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          value={ext}
                          onChange={(e) => {
                            const updated = [...newCollege.emailExtensions];
                            updated[index] = e.target.value.toLowerCase();
                            setNewCollege({
                              ...newCollege,
                              emailExtensions: updated,
                            });
                          }}
                          placeholder="e.g., @pilani.bits-pilani.ac.in"
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const updated = newCollege.emailExtensions.filter(
                              (_, i) => i !== index
                            );
                            setNewCollege({
                              ...newCollege,
                              emailExtensions: updated,
                            });
                          }}
                          className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        setNewCollege({
                          ...newCollege,
                          emailExtensions: [...newCollege.emailExtensions, ""],
                        })
                      }
                      className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-green-500 hover:text-green-500"
                    >
                      + Add Email Extension
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Email domains for student verification (e.g., @college.edu)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Website URL
                  </label>
                  <input
                    type="url"
                    value={newCollege.extensionUrl}
                    onChange={(e) =>
                      setNewCollege({
                        ...newCollege,
                        extensionUrl: e.target.value,
                      })
                    }
                    placeholder="https://www.college.edu"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Logo URL
                  </label>
                  <input
                    type="url"
                    value={newCollege.logo}
                    onChange={(e) =>
                      setNewCollege({ ...newCollege, logo: e.target.value })
                    }
                    placeholder="https://example.com/logo.png"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>

                {/* Links Section */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quick Links
                  </label>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {newCollege.links.map((link, index) => (
                      <div
                        key={index}
                        className="flex gap-2 items-start p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex-1 space-y-2">
                          <input
                            type="text"
                            value={link.name}
                            onChange={(e) => {
                              const updatedLinks = [...newCollege.links];
                              updatedLinks[index].name = e.target.value;
                              setNewCollege({
                                ...newCollege,
                                links: updatedLinks,
                              });
                            }}
                            placeholder="Link name (e.g., Library Portal)"
                            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          />
                          <input
                            type="url"
                            value={link.url}
                            onChange={(e) => {
                              const updatedLinks = [...newCollege.links];
                              updatedLinks[index].url = e.target.value;
                              setNewCollege({
                                ...newCollege,
                                links: updatedLinks,
                              });
                            }}
                            placeholder="URL (e.g., https://library.college.edu)"
                            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          />
                        </div>
                        <button
                          onClick={() => {
                            const updatedLinks = newCollege.links.filter(
                              (_, i) => i !== index
                            );
                            setNewCollege({
                              ...newCollege,
                              links: updatedLinks,
                            });
                          }}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      setNewCollege({
                        ...newCollege,
                        links: [...newCollege.links, { name: "", url: "" }],
                      });
                    }}
                    className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-500 hover:bg-green-50 text-gray-600 hover:text-green-600 transition-colors"
                  >
                    <LinkIcon size={16} />
                    Add Link
                  </button>
                </div>
              </div>

              <div className="flex gap-4 mt-6">
                <button
                  onClick={createCollege}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Plus size={18} />
                  Create College
                </button>
                <button
                  onClick={() => {
                    setShowCreateCollege(false);
                    setNewCollege({
                      collegeId: "",
                      name: "",
                      extensionUrl: "",
                      emailExtensions: [],
                      logo: "",
                      links: [],
                    });
                  }}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Deleted Items Modal */}
        {showDeletedItems && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl p-8 max-w-4xl w-full max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-800">
                  Deleted Items
                </h2>
                <button
                  onClick={() => setShowDeletedItems(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>

              {deletedItems.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Trash2 size={48} className="mx-auto mb-4 opacity-50" />
                  <p>No deleted items</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {deletedItems.map((item) => (
                    <div
                      key={item.id}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded">
                              {item.type}
                            </span>
                            <h3 className="font-semibold text-gray-800">
                              {item.name}
                            </h3>
                          </div>
                          <p className="text-sm text-gray-600 mb-1">
                            Deleted: {new Date(item.deletedAt).toLocaleString()}
                          </p>
                          {item.files && (
                            <p className="text-sm text-gray-600">
                              Files: {item.files.length}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => restoreItem(item)}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                          >
                            Restore
                          </button>
                          <button
                            onClick={() => permanentlyDeleteItem(item)}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                          >
                            Delete Permanently
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Edit Skill Modal */}
        {editingSkill && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-800">
                  Edit Courses - {editingSkill.id === "tech" && "Tech"}
                  {editingSkill.id === "productManagement" &&
                    "Product Management"}
                  {editingSkill.id === "supplyChain" && "Supply Chain"}
                  {editingSkill.id === "promptEngineering" &&
                    "Prompt Engineering"}
                  {editingSkill.id === "finance" && "Finance"}
                  {![
                    "tech",
                    "productManagement",
                    "supplyChain",
                    "promptEngineering",
                    "finance",
                  ].includes(editingSkill.id) && editingSkill.name}
                </h2>
                <button
                  onClick={() => setEditingSkill(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Courses
                  </label>
                  <div className="border border-gray-300 rounded-lg p-4 max-h-96 overflow-y-auto space-y-2">
                    {courses.map((course) => {
                      const college = colleges.find(
                        (c) => c.collegeId === course.collegeId
                      );
                      return (
                        <label
                          key={course.id}
                          className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={
                              editingSkill.courses?.includes(course.id) || false
                            }
                            onChange={(e) => {
                              const currentCourses = editingSkill.courses || [];
                              if (e.target.checked) {
                                setEditingSkill({
                                  ...editingSkill,
                                  courses: [...currentCourses, course.id],
                                });
                              } else {
                                setEditingSkill({
                                  ...editingSkill,
                                  courses: currentCourses.filter(
                                    (id) => id !== course.id
                                  ),
                                });
                              }
                            }}
                            className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-800">
                              {course.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {course.collegeId
                                ? college?.name || course.collegeId
                                : "Skill Course (No College)"}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {editingSkill.courses?.length || 0} courses selected
                  </p>
                </div>
              </div>

              <div className="flex gap-4 mt-6">
                <button
                  onClick={async () => {
                    try {
                      await setDoc(
                        doc(db, "skills", editingSkill.id),
                        {
                          courses: editingSkill.courses || [],
                        },
                        { merge: true }
                      );

                      setSkills(
                        skills.map((s) =>
                          s.id === editingSkill.id
                            ? { ...s, courses: editingSkill.courses }
                            : s
                        )
                      );

                      setEditingSkill(null);
                      toast.success("Skill updated successfully");
                    } catch (error) {
                      console.error("Error updating skill:", error);
                      toast.error("Failed to update skill");
                    }
                  }}
                  className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Save Changes
                </button>
                <button
                  onClick={() => setEditingSkill(null)}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Course Modal */}
        {editingCourse && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-800">
                  Edit Course
                </h2>
                <button
                  onClick={() => setEditingCourse(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Course Name
                  </label>
                  <input
                    type="text"
                    value={editingCourse.name}
                    disabled
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Assign to College
                  </label>
                  <select
                    value={editingCourse.collegeId || ""}
                    onChange={(e) =>
                      setEditingCourse({
                        ...editingCourse,
                        collegeId: e.target.value || null,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Skill Course (No College)</option>
                    {colleges.map((college) => (
                      <option key={college.id} value={college.collegeId}>
                        {college.name} ({college.collegeId})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {editingCourse.collegeId
                      ? "College course - visible to college students"
                      : "Skill course - visible in Skills section"}
                  </p>
                </div>
              </div>

              <div className="flex gap-4 mt-6">
                <button
                  onClick={() => updateCourse(editingCourse)}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Save Changes
                </button>
                <button
                  onClick={() => setEditingCourse(null)}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SuperAdmin;
