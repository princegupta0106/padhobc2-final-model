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
  arrayUnion,
} from "firebase/firestore";
import { db, storage } from "../firebase/config";
import {
  ref,
  deleteObject,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import {
  BookOpen,
  Users,
  Trash2,
  FolderOpen,
  FileText,
  Shield,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  Star,
  Bell,
  Upload,
  Newspaper,
  Plus,
  Paperclip,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import toast, { Toaster } from "react-hot-toast";
import { updateUserXP } from "../utils/xpCalculator";

const Admin = () => {
  const { userProfile } = useAuth();
  const { isDarkMode } = useTheme();
  const navigate = useNavigate();
  const [managedCourses, setManagedCourses] = useState([]);
  const [coursesData, setCoursesData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [hasFetched, setHasFetched] = useState(false);
  const [pendingUploads, setPendingUploads] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [showNewsForm, setShowNewsForm] = useState(false);
  const [newsForm, setNewsForm] = useState({
    courseId: "",
    title: "",
    content: "",
  });
  const [newsAttachments, setNewsAttachments] = useState([]);

  useEffect(() => {
    if (
      !hasFetched &&
      (userProfile?.role === "superadmin" ||
        (userProfile?.role === "admin" &&
          userProfile?.adminCourses?.length > 0))
    ) {
      fetchManagedCourses();
      fetchNotifications();
      setHasFetched(true);
    } else if (!userProfile) {
      setLoading(false);
    }
  }, [userProfile?.role, userProfile?.adminCourses?.length]); // Specific dependencies

  const fetchManagedCourses = async () => {
    try {
      let adminCourses = [];

      // Fetch courses efficiently based on role
      if (userProfile?.role === "superadmin") {
        const coursesSnapshot = await getDocs(collection(db, "courses"));
        adminCourses = coursesSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
      } else {
        // For regular admins, fetch only their courses
        const coursesPromises = (userProfile?.adminCourses || []).map(
          (courseId) => getDoc(doc(db, "courses", courseId))
        );
        const courseDocs = await Promise.all(coursesPromises);
        adminCourses = courseDocs
          .filter((doc) => doc.exists())
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
      }

      // Fetch all pending uploads for admin courses
      const pendingFolders = [];
      const pendingFiles = [];

      // Fetch additional data for each course
      const enrichedCourses = await Promise.all(
        adminCourses.map(async (course) => {
          // Count folders
          const foldersQuery = query(
            collection(db, "folders"),
            where("courseId", "==", course.id)
          );
          const foldersSnapshot = await getDocs(foldersQuery);
          const folders = foldersSnapshot.docs
            .map((doc) => ({
              id: doc.id,
              ...doc.data(),
            }))
            .filter((folder) => !folder.deleted); // Exclude deleted folders

          // Separate pending folders/files
          folders.forEach((folder) => {
            // Check if entire folder is pending
            if (folder.moderationStatus === "pending") {
              console.log(
                "Found pending folder:",
                folder.name,
                folder.moderationStatus
              );
              pendingFolders.push({
                ...folder,
                courseName: course.name,
                courseId: course.id,
                type: "folder",
              });
            }
            // Check for pending files within folders
            if (folder.files) {
              folder.files.forEach((file, index) => {
                if (file.moderationStatus === "pending") {
                  console.log(
                    "Found pending file:",
                    file.name,
                    file.moderationStatus
                  );
                  pendingFiles.push({
                    ...file,
                    folderId: folder.id,
                    folderName: folder.name,
                    courseName: course.name,
                    courseId: course.id,
                    fileIndex: index,
                    type: "file",
                  });
                }
              });
            }
          });

          // Count total files
          let totalFiles = 0;
          folders.forEach((folder) => {
            totalFiles += folder.files?.length || 0;
          });

          // Count enrolled users
          const usersQuery = query(
            collection(db, "users"),
            where("enrolledCourses", "array-contains", course.id)
          );
          const usersSnapshot = await getDocs(usersQuery);

          return {
            ...course,
            foldersCount: folders.length,
            filesCount: totalFiles,
            enrolledCount: usersSnapshot.size,
            folders: folders,
          };
        })
      );

      setPendingUploads([...pendingFolders, ...pendingFiles]);
      console.log(
        "Total pending uploads:",
        pendingFolders.length + pendingFiles.length
      );
      console.log("Pending folders:", pendingFolders);
      console.log("Pending files:", pendingFiles);
      setCoursesData(enrichedCourses);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching managed courses:", error);
      setLoading(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      const notificationsQuery = query(
        collection(db, "notifications"),
        where("userId", "==", userProfile.uid)
      );
      const notificationsSnapshot = await getDocs(notificationsQuery);
      const notificationsList = notificationsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Sort by createdAt descending (newest first)
      notificationsList.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
      setNotifications(notificationsList);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      const notificationRef = doc(db, "notifications", notificationId);
      await updateDoc(notificationRef, {
        read: true,
      });

      // Update local state
      setNotifications(
        notifications.map((n) =>
          n.id === notificationId ? { ...n, read: true } : n
        )
      );
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      const notificationRef = doc(db, "notifications", notificationId);
      await deleteDoc(notificationRef);

      // Update local state
      setNotifications(notifications.filter((n) => n.id !== notificationId));
      toast.success("Notification deleted");
    } catch (error) {
      console.error("Error deleting notification:", error);
      toast.error("Failed to delete notification");
    }
  };

  const moderateFromNotification = async (notification, action) => {
    try {
      // Find the pending folder/files for this notification
      if (notification.type === "bulk_upload") {
        // For bulk uploads, navigate to the course page to moderate
        toast.info("Please moderate folders from the course page");
        navigate(`/course/${notification.courseId}`);
        return;
      }

      // For single uploads, find the folder
      const foldersQuery = query(
        collection(db, "folders"),
        where("courseId", "==", notification.courseId),
        where("uploadedById", "==", notification.uploaderId),
        where("name", "==", notification.itemName),
        where("moderationStatus", "==", "pending")
      );

      const foldersSnapshot = await getDocs(foldersQuery);

      if (foldersSnapshot.empty) {
        toast.error("Upload already moderated or not found");
        await deleteNotification(notification.id);
        return;
      }

      const folderId = foldersSnapshot.docs[0].id;

      // Call the existing moderation function
      await moderateFolder(
        folderId,
        action === "accept" ? "accepted" : "rejected"
      );

      // Delete the notification after moderation
      await deleteNotification(notification.id);
    } catch (error) {
      console.error("Error moderating from notification:", error);
      toast.error("Failed to moderate upload");
    }
  };

  const deleteFolder = async (courseId, folderId, uploaderId, filesCount) => {
    if (
      !window.confirm(
        "Are you sure you want to permanently delete this folder? All files will be removed."
      )
    ) {
      return;
    }

    const loadingToast = toast.loading("Deleting folder...");

    try {
      // Get folder data
      const folderRef = doc(db, "folders", folderId);
      const folderDoc = await getDoc(folderRef);

      if (!folderDoc.exists()) {
        toast.error("Folder not found", { id: loadingToast });
        return;
      }

      const files = folderDoc.data().files || [];

      // Delete files from storage
      for (const file of files) {
        try {
          const decodedUrl = decodeURIComponent(file.url);
          const pathMatch = decodedUrl.match(/\/o\/(.+?)\?/);
          if (pathMatch?.[1]) {
            await deleteObject(ref(storage, pathMatch[1]));
          }
        } catch (err) {
          console.error("Error deleting file:", err);
        }
      }

      // Delete folder document
      await deleteDoc(folderRef);

      // Update course
      const courseRef = doc(db, "courses", courseId);
      const courseDoc = await getDoc(courseRef);
      if (courseDoc.exists()) {
        const folders = courseDoc.data().folders || [];
        await updateDoc(courseRef, {
          folders: folders.filter((id) => id !== folderId),
        });
      }

      // Update uploader contributions
      if (uploaderId && filesCount > 0) {
        const uploaderRef = doc(db, "users", uploaderId);
        const uploaderDoc = await getDoc(uploaderRef);
        if (uploaderDoc.exists()) {
          const contributions = uploaderDoc.data().contributions || 0;
          await updateDoc(uploaderRef, {
            contributions: Math.max(0, contributions - filesCount),
          });
          // Update XP
          await updateUserXP(uploaderId);
        }
      }

      toast.success("Folder deleted successfully", { id: loadingToast });
      fetchManagedCourses();
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete folder", { id: loadingToast });
    }
  };

  const moderateFolder = async (folderId, status) => {
    const loadingToast = toast.loading(
      `${status === "accepted" ? "Accepting" : "Rejecting"} folder...`
    );

    try {
      const folderRef = doc(db, "folders", folderId);

      if (status === "rejected") {
        // If rejected, delete the folder entirely
        const folderDoc = await getDoc(folderRef);
        if (!folderDoc.exists()) {
          toast.error("Folder not found", { id: loadingToast });
          return;
        }

        const folderData = folderDoc.data();
        const files = folderData.files || [];
        const uploaderId = folderData.uploadedById;
        const courseId = folderData.courseId;

        // Delete all files from storage
        for (const file of files) {
          try {
            const decodedUrl = decodeURIComponent(file.url);
            const pathMatch = decodedUrl.match(/\/o\/(.+?)\?/);
            if (pathMatch?.[1]) {
              await deleteObject(ref(storage, pathMatch[1]));
            }
          } catch (err) {
            console.error("Error deleting file:", err);
          }
        }

        // Delete folder document
        await deleteDoc(folderRef);

        // Update course
        const courseRef = doc(db, "courses", courseId);
        const courseDoc = await getDoc(courseRef);
        if (courseDoc.exists()) {
          const folders = courseDoc.data().folders || [];
          await updateDoc(courseRef, {
            folders: folders.filter((id) => id !== folderId),
          });
        }

        // Update uploader contributions
        if (uploaderId && files.length > 0) {
          const uploaderRef = doc(db, "users", uploaderId);
          const uploaderDoc = await getDoc(uploaderRef);
          if (uploaderDoc.exists()) {
            const contributions = uploaderDoc.data().contributions || 0;
            await updateDoc(uploaderRef, {
              contributions: Math.max(0, contributions - files.length),
            });
            // Update XP
            await updateUserXP(uploaderId);
          }
        }

        toast.success("Folder rejected and removed", { id: loadingToast });
      } else {
        // If accepted, update folder status and all files to accepted
        const folderDoc = await getDoc(folderRef);
        if (!folderDoc.exists()) {
          toast.error("Folder not found", { id: loadingToast });
          return;
        }

        const folderData = folderDoc.data();
        const files = folderData.files || [];

        // Update all files to accepted status
        const updatedFiles = files.map((file) => ({
          ...file,
          moderationStatus: "accepted",
          moderatedBy: userProfile?.displayName || "Admin",
          moderatedById: userProfile?.uid || null,
          moderatedAt: new Date().toISOString(),
        }));

        await updateDoc(folderRef, {
          moderationStatus: status,
          moderatedBy: userProfile?.displayName || "Admin",
          moderatedById: userProfile?.uid || null,
          moderatedAt: new Date().toISOString(),
          files: updatedFiles,
        });

        toast.success(`Folder ${status}`, { id: loadingToast });
      }

      fetchManagedCourses();
    } catch (error) {
      console.error("Moderation error:", error);
      toast.error("Failed to moderate folder", { id: loadingToast });
    }
  };

  const toggleImportant = async (folderId, currentStatus) => {
    const loadingToast = toast.loading("Updating folder...");

    try {
      const folderRef = doc(db, "folders", folderId);
      await updateDoc(folderRef, {
        isImportant: !currentStatus,
      });

      toast.success(
        `Folder marked as ${!currentStatus ? "important" : "normal"}`,
        { id: loadingToast }
      );
      fetchManagedCourses();
    } catch (error) {
      console.error("Error toggling important:", error);
      toast.error("Failed to update folder", { id: loadingToast });
    }
  };

  const moderateFile = async (folderId, fileIndex, status) => {
    const loadingToast = toast.loading(
      `${status === "accepted" ? "Accepting" : "Rejecting"} file...`
    );

    try {
      const folderRef = doc(db, "folders", folderId);
      const folderDoc = await getDoc(folderRef);

      if (!folderDoc.exists()) {
        toast.error("Folder not found", { id: loadingToast });
        return;
      }

      const folderData = folderDoc.data();
      const files = folderData.files || [];
      const uploaderId = folderData.uploadedById;

      if (status === "rejected") {
        // Delete file from storage
        const file = files[fileIndex];
        try {
          const decodedUrl = decodeURIComponent(file.url);
          const pathMatch = decodedUrl.match(/\/o\/(.+?)\?/);
          if (pathMatch?.[1]) {
            await deleteObject(ref(storage, pathMatch[1]));
          }
        } catch (err) {
          console.error("Error deleting file from storage:", err);
        }

        // Remove file from array
        files.splice(fileIndex, 1);

        // Update uploader contributions (decrement by 1 for the deleted file)
        if (uploaderId) {
          const uploaderRef = doc(db, "users", uploaderId);
          const uploaderDoc = await getDoc(uploaderRef);
          if (uploaderDoc.exists()) {
            const contributions = uploaderDoc.data().contributions || 0;
            await updateDoc(uploaderRef, {
              contributions: Math.max(0, contributions - 1),
            });
            // Update XP
            await updateUserXP(uploaderId);
          }
        }
      } else {
        // Update file status
        files[fileIndex] = {
          ...files[fileIndex],
          moderationStatus: status,
          moderatedBy: userProfile?.displayName || "Admin",
          moderatedById: userProfile?.uid || null,
          moderatedAt: new Date().toISOString(),
        };
      }

      await updateDoc(folderRef, { files });

      toast.success(
        `File ${status === "rejected" ? "rejected and removed" : status}`,
        { id: loadingToast }
      );
      fetchManagedCourses();
    } catch (error) {
      console.error("Moderation error:", error);
      toast.error("Failed to moderate file", { id: loadingToast });
    }
  };

  const handlePostNews = async (e) => {
    e.preventDefault();

    if (
      !newsForm.courseId ||
      !newsForm.title.trim() ||
      !newsForm.content.trim()
    ) {
      toast.error("Please fill in all fields");
      return;
    }

    const loadingToast = toast.loading("Posting news...");

    try {
      const courseRef = doc(db, "courses", newsForm.courseId);

      const attachments = [];

      // Upload all attachments if provided
      if (newsAttachments.length > 0) {
        const timestamp = Date.now();
        for (let i = 0; i < newsAttachments.length; i++) {
          const file = newsAttachments[i];
          const attachmentRef = ref(
            storage,
            `news/${newsForm.courseId}/${timestamp}_${i}_${file.name}`
          );
          await uploadBytes(attachmentRef, file);
          const url = await getDownloadURL(attachmentRef);
          attachments.push({ url, name: file.name });
        }
      }

      const newNewsItem = {
        title: newsForm.title.trim(),
        content: newsForm.content.trim(),
        postedBy: userProfile?.displayName || "Admin",
        postedById: userProfile?.uid,
        postedAt: new Date().toISOString(),
        ...(attachments.length > 0 && { attachments }),
      };

      await updateDoc(courseRef, {
        news: arrayUnion(newNewsItem),
      });

      toast.success("News posted successfully", { id: loadingToast });
      setNewsForm({ courseId: "", title: "", content: "" });
      setNewsAttachments([]);
      setShowNewsForm(false);
      fetchManagedCourses();
    } catch (error) {
      console.error("Error posting news:", error);
      toast.error("Failed to post news", { id: loadingToast });
    }
  };

  const filteredCourses = coursesData.filter((course) =>
    course.name.toLowerCase().includes(searchQuery.toLowerCase())
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
    (userProfile?.role !== "admin" || !userProfile?.adminCourses?.length)
  ) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Shield size={64} className="text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Access Denied
          </h2>
          <p className="text-gray-600">
            You don't have admin access to any courses.
          </p>
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
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 md:py-6 pr-16 lg:pr-8">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 md:gap-3">
              <Shield size={24} className="text-blue-600 md:w-8 md:h-8" />
              <div>
                <h1 className="text-xl md:text-3xl font-bold text-gray-800">
                  Admin Panel
                </h1>
                <p className="text-xs md:text-sm text-gray-600 hidden sm:block">
                  Manage courses you are assigned to
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 md:py-6">
        {/* Notifications Section */}
        {notifications.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 md:p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Bell size={20} className="text-blue-600" />
              <h2 className="text-lg md:text-xl font-bold text-gray-800">
                Notifications ({notifications.filter((n) => !n.read).length}{" "}
                unread)
              </h2>
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`bg-white rounded-lg p-4 border ${
                    notification.read
                      ? "border-gray-200 opacity-60"
                      : "border-blue-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {notification.type === "bulk_upload" ? (
                          <Upload size={16} className="text-blue-600" />
                        ) : (
                          <FileText size={16} className="text-blue-600" />
                        )}
                        <span className="font-semibold text-gray-800">
                          New{" "}
                          {notification.type === "bulk_upload"
                            ? "Bulk Upload"
                            : "Upload"}
                        </span>
                        {!notification.read && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                            New
                          </span>
                        )}
                      </div>

                      <p className="text-gray-700 mb-2">
                        <button
                          onClick={() =>
                            navigate(`/user/${notification.uploaderId}`)
                          }
                          className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {notification.uploaderName}
                        </button>
                        {notification.type === "bulk_upload" ? (
                          <span>
                            {" "}
                            uploaded{" "}
                            <span className="font-medium">
                              {notification.folderCount} folders
                            </span>{" "}
                            with{" "}
                            <span className="font-medium">
                              {notification.fileCount} files
                            </span>{" "}
                            to{" "}
                          </span>
                        ) : (
                          <span>
                            {" "}
                            uploaded{" "}
                            {notification.itemType === "folder"
                              ? "a folder"
                              : "files"}{" "}
                            ({notification.fileCount} files) to{" "}
                          </span>
                        )}
                        <button
                          onClick={() =>
                            navigate(`/course/${notification.courseId}`)
                          }
                          className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {notification.courseName}
                        </button>
                      </p>

                      {notification.itemName && (
                        <p className="text-sm text-gray-600 mb-2">
                          Folder:{" "}
                          <span className="font-medium">
                            {notification.itemName}
                          </span>
                        </p>
                      )}

                      <p className="text-xs text-gray-500">
                        {new Date(notification.createdAt).toLocaleString()}
                      </p>

                      {/* Accept/Reject buttons for pending uploads */}
                      {!notification.read && (
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() =>
                              moderateFromNotification(notification, "accept")
                            }
                            className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                          >
                            <CheckCircle size={16} />
                            Accept
                          </button>
                          <button
                            onClick={() =>
                              moderateFromNotification(notification, "reject")
                            }
                            className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
                          >
                            <XCircle size={16} />
                            Reject
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      {!notification.read && (
                        <button
                          onClick={() => markAsRead(notification.id)}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium whitespace-nowrap"
                        >
                          Mark as read
                        </button>
                      )}
                      <button
                        onClick={() => deleteNotification(notification.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <XCircle size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pending Uploads Section */}
        {pendingUploads.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 md:p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Clock size={20} className="text-yellow-600" />
              <h2 className="text-lg md:text-xl font-bold text-gray-800">
                Pending Moderation ({pendingUploads.length})
              </h2>
            </div>
            <div className="space-y-3">
              {pendingUploads.map((item, index) => (
                <div
                  key={`${item.type}-${item.id || item.folderId}-${index}`}
                  className="bg-white rounded-lg p-4 border border-yellow-300"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {item.type === "folder" ? (
                          <FolderOpen size={18} className="text-blue-500" />
                        ) : (
                          <FileText size={18} className="text-purple-500" />
                        )}
                        {item.type === "file" && item.url ? (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {item.name}
                          </a>
                        ) : (
                          <span className="font-semibold text-gray-800">
                            {item.name}
                          </span>
                        )}
                        <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                          {item.type}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>
                          Course:{" "}
                          <button
                            onClick={() => navigate(`/course/${item.courseId}`)}
                            className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {item.courseName}
                          </button>
                        </p>
                        {item.type === "file" && (
                          <p>
                            Folder:{" "}
                            <span className="font-medium">
                              {item.folderName}
                            </span>
                          </p>
                        )}
                        {item.type === "folder" && (
                          <p>
                            Files:{" "}
                            <span className="font-medium">
                              {item.files?.length || 0}
                            </span>
                          </p>
                        )}
                        <p>
                          Uploaded by:{" "}
                          {item.uploadedById ? (
                            <button
                              onClick={() =>
                                navigate(`/user/${item.uploadedById}`)
                              }
                              className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              {item.uploadedBy || "Unknown"}
                            </button>
                          ) : (
                            <span className="font-medium">
                              {item.uploadedBy || "Unknown"}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(item.uploadedAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          if (item.type === "folder") {
                            moderateFolder(item.id, "accepted");
                          } else {
                            moderateFile(
                              item.folderId,
                              item.fileIndex,
                              "accepted"
                            );
                          }
                        }}
                        className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1.5 text-sm"
                        title="Accept"
                      >
                        <CheckCircle size={16} />
                        Accept
                      </button>
                      <button
                        onClick={() => {
                          if (item.type === "folder") {
                            moderateFolder(item.id, "rejected");
                          } else {
                            moderateFile(
                              item.folderId,
                              item.fileIndex,
                              "rejected"
                            );
                          }
                        }}
                        className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-1.5 text-sm"
                        title="Reject"
                      >
                        <XCircle size={16} />
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Post News Section */}
        <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Newspaper size={20} className="text-blue-600" />
              <h2 className="text-lg md:text-xl font-bold text-gray-800">
                Course News
              </h2>
            </div>
            <button
              onClick={() => setShowNewsForm(!showNewsForm)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={18} />
              Post News
            </button>
          </div>

          {showNewsForm && (
            <form
              onSubmit={handlePostNews}
              className="bg-gray-50 rounded-lg p-4 space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Course *
                </label>
                <select
                  value={newsForm.courseId}
                  onChange={(e) =>
                    setNewsForm({ ...newsForm, courseId: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Choose a course...</option>
                  {coursesData.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  value={newsForm.title}
                  onChange={(e) =>
                    setNewsForm({ ...newsForm, title: e.target.value })
                  }
                  placeholder="Enter news title..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Content <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={newsForm.content}
                  onChange={(e) =>
                    setNewsForm({ ...newsForm, content: e.target.value })
                  }
                  placeholder="Enter news content..."
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Attachments (Optional)
                </label>
                <div className="space-y-3">
                  <label className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 cursor-pointer transition-colors w-fit">
                    <Paperclip size={18} />
                    <span>Choose Files</span>
                    <input
                      type="file"
                      multiple
                      onChange={(e) =>
                        setNewsAttachments([
                          ...newsAttachments,
                          ...Array.from(e.target.files),
                        ])
                      }
                      className="hidden"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    />
                  </label>
                  {newsAttachments.length > 0 && (
                    <div className="space-y-2">
                      {newsAttachments.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded"
                        >
                          <FileText size={16} />
                          <span className="truncate flex-1">{file.name}</span>
                          <span className="text-xs text-gray-500">
                            ({(file.size / 1024).toFixed(1)} KB)
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setNewsAttachments(
                                newsAttachments.filter((_, i) => i !== index)
                              )
                            }
                            className="text-red-500 hover:text-red-700"
                          >
                            <XCircle size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  PDF, DOC, DOCX, JPG, PNG (Max 10MB each)
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Post News
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewsForm(false);
                    setNewsForm({ courseId: "", title: "", content: "" });
                  }}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-6 mb-6 md:mb-8">
          <div className="bg-white rounded-lg shadow-sm p-4 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-xs md:text-sm mb-1">
                  Managed Courses
                </p>
                <p className="text-2xl md:text-3xl font-bold text-gray-800">
                  {coursesData.length}
                </p>
              </div>
              <BookOpen size={32} className="text-blue-500 md:w-10 md:h-10" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-xs md:text-sm mb-1">
                  Total Folders
                </p>
                <p className="text-2xl md:text-3xl font-bold text-gray-800">
                  {coursesData.reduce(
                    (sum, course) => sum + course.foldersCount,
                    0
                  )}
                </p>
              </div>
              <FolderOpen
                size={32}
                className="text-green-500 md:w-10 md:h-10"
              />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-xs md:text-sm mb-1">
                  Total Files
                </p>
                <p className="text-2xl md:text-3xl font-bold text-gray-800">
                  {coursesData.reduce(
                    (sum, course) => sum + course.filesCount,
                    0
                  )}
                </p>
              </div>
              <FileText size={32} className="text-purple-500 md:w-10 md:h-10" />
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-4 md:mb-6">
          <div className="relative">
            <Search
              className="absolute left-3 md:left-4 top-1/2 transform -translate-y-1/2 text-gray-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Search courses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 md:pl-12 pr-4 py-2 md:py-3 text-sm md:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
        </div>

        {/* Courses List */}
        <div className="space-y-4 md:space-y-6">
          {filteredCourses.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-500">
              {searchQuery ? "No courses found" : "No courses assigned"}
            </div>
          ) : (
            filteredCourses.map((course) => (
              <div
                key={course.id}
                className="bg-white rounded-lg shadow-sm overflow-hidden"
              >
                {/* Course Header */}
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-3 md:p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h2 className="text-lg md:text-xl font-bold mb-1.5 md:mb-2 truncate">
                        {course.name}
                      </h2>
                      <div className="flex flex-wrap items-center gap-3 md:gap-4 text-xs md:text-sm text-blue-100">
                        <span className="flex items-center gap-1.5">
                          <FolderOpen size={14} className="md:w-4 md:h-4" />
                          {course.foldersCount} Folders
                        </span>
                        <span className="flex items-center gap-1.5">
                          <FileText size={14} className="md:w-4 md:h-4" />
                          {course.filesCount} Files
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Users size={14} className="md:w-4 md:h-4" />
                          {course.enrolledCount} Students
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => navigate(`/course/${course.id}`)}
                      className="px-3 md:px-4 py-1.5 md:py-2 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-medium text-xs md:text-sm whitespace-nowrap flex-shrink-0"
                    >
                      View Course
                    </button>
                  </div>
                </div>

                {/* Folders List */}
                <div className="p-4 md:p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">
                    Folders
                  </h3>
                  {course.folders.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">
                      No folders yet
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {course.folders.map((folder) => (
                        <div
                          key={folder.id}
                          className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
                        >
                          <div className="flex items-center gap-4 flex-1">
                            <FolderOpen
                              size={20}
                              className={
                                folder.isImportant
                                  ? "text-yellow-500"
                                  : "text-blue-500"
                              }
                            />
                            <div className="flex-1">
                              <div className="font-medium text-gray-800 flex items-center gap-2">
                                {folder.name}
                                {folder.isImportant && (
                                  <Star
                                    size={14}
                                    className="text-yellow-500 fill-yellow-500"
                                  />
                                )}
                              </div>
                              <div className="text-sm text-gray-500">
                                {folder.files?.length || 0} files • Uploaded by{" "}
                                {folder.uploadedBy}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">
                              {new Date(folder.uploadedAt).toLocaleDateString()}
                            </span>
                            <button
                              onClick={() =>
                                toggleImportant(folder.id, folder.isImportant)
                              }
                              className="opacity-0 group-hover:opacity-100 p-2 hover:bg-yellow-100 rounded-lg transition-all"
                              title={
                                folder.isImportant
                                  ? "Mark as normal"
                                  : "Mark as important"
                              }
                            >
                              <Star
                                size={16}
                                className={
                                  folder.isImportant
                                    ? "text-yellow-500 fill-yellow-500"
                                    : "text-gray-400"
                                }
                              />
                            </button>
                            <button
                              onClick={() =>
                                deleteFolder(
                                  course.id,
                                  folder.id,
                                  folder.uploadedById,
                                  folder.files?.length || 0
                                )
                              }
                              className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-100 rounded-lg transition-all"
                              title="Delete folder"
                            >
                              <Trash2 size={16} className="text-red-600" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Admin;
