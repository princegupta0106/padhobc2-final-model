# Firebase Database Structure

## Collections

### 1. colleges
```
{
  collegeId: string,         // Unique identifier (e.g., "BITS_PILANI")
  name: string,              // Display name (e.g., "BITS Pilani")
  extensionUrl: string,      // Website URL
  emailExtension: string,    // Email domain for authentication (e.g., "@pilani.bits-pilani.ac.in")
  collegeGroup: string,      // Optional group name for shared resources (e.g., "BITS")
  logo: string,              // Logo URL (optional)
  courses: array[string],    // Array of course document IDs
  links: array[object],      // Quick links for the college
  createdAt: timestamp
}
```

**College Groups:**
Colleges with the same `collegeGroup` value will share course resources. This is useful for multi-campus institutions like BITS Pilani, where students from @pilani.bits-pilani.ac.in, @goa.bits-pilani.ac.in, and @hyderabad.bits-pilani.ac.in can all access courses from any campus in the group.

### 2. courses
```
{
  name: string,              // Course name (e.g., "MACHINE LEARNING")
  collegeId: string,         // College identifier (e.g., "BITS_PILANI")
  folders: array[string],    // Array of folder document IDs
  createdAt: timestamp
}
```

### 3. folders
```
{
  courseId: string,          // Reference to course document ID
  name: string,              // Folder name
  uploadedBy: string,        // User display name
  uploadedById: string,      // User uid
  uploadedAt: timestamp,
  files: array[{             // Array of files in this folder
    name: string,            // File name
    url: string,             // Download URL from Firebase Storage
    size: number,            // File size in bytes
    mimeType: string,        // File MIME type
    uploadedAt: timestamp
  }]
}
```

### 4. users
```
{
  uid: string,
  displayName: string,
  email: string,
  photoURL: string,
  bio: string,
  collegeId: string,        // College identifier (e.g., "BITS_PILANI")
  role: string,             // 'user', 'admin', 'superadmin'
  adminCourses: array,      // Array of course IDs admin can manage (for admins only)
  enrolledCourses: array,   // Array of course IDs user is enrolled in
  contributions: number,
  createdAt: timestamp
}
```

### 5. leaderboard
```
{
  userId: string,
  displayName: string,
  contributions: number,
  lastUpdated: timestamp
}
```

## Database Relationships

- **colleges** → **courses**: One-to-many (one college has many courses)
- **courses** → **folders**: One-to-many (one course has many folders)
- **folders** → **files**: One-to-many (one folder contains many files as array)
- **users** → **courses**: Many-to-many via `enrolledCourses` array
- **admins** → **courses**: Many-to-many via `adminCourses` array

## Role Permissions

### 👤 User (role: 'user')
- Can view courses from their college
- Can enroll/unenroll in courses
- Can view resources
- Cannot upload resources

### 🛡️ Admin (role: 'admin')
- All user permissions
- Can upload resources to assigned courses (specified in `adminCourses`)
- Can manage resources for their assigned courses
- Limited to specific courses

### ⚡ Super Admin (role: 'superadmin')
- Full system access
- Can upload to all courses
- Can manage all users
- Can assign/remove admin roles
- Can assign courses to admins
- Access to Super Admin panel

### 3. courses (Deprecated - Now stored in colleges.courses array)
```
Note: Courses are now stored within the college documents for faster access.
This collection can be kept for backward compatibility or removed.

The courses are now embedded directly in the colleges collection as an array,
which eliminates the need for a separate query and provides faster search
capabilities.
```

### 4. resources (Folders with Files Array)
```
{
  courseCode: string,    // Course code (e.g., "BITS F464")
  name: string,          // Folder name
  path: string,          // Full path e.g., "24-25 1st Sem"
  type: string,          // Always "folder"
  uploadedBy: string,    // User display name
  uploadedById: string,  // User uid
  uploadedAt: timestamp,
  files: array[{         // Array of files in this folder
    name: string,        // File name
    url: string,         // Download URL from Firebase Storage
    size: number,        // File size in bytes
    mimeType: string,    // File MIME type
    uploadedAt: timestamp
  }]
}
```

### 5. leaderboard
```
{
  userId: string,        // User uid
  displayName: string,
  contributions: number,
  lastUpdated: timestamp
}
```

## Important Features

### 🏫 College-Based Access
- Each course has a `collegeId` field
- Users only see courses from their own college
- Users can select their college in the profile page
- Default college: BITS_PILANI

### 📁 Folder Structure
- Each folder is a separate document in the `folders` collection
- Folders contain an array of files
- Files are stored in Firebase Storage
- Each folder belongs to one course via `courseId` reference

### 👤 User Profile
- Users can upload custom profile pictures
- Edit display name and bio
- Select college from dropdown
- View contribution count

## Available Colleges

```javascript
BITS_PILANI      - BITS Pilani
IIT_BOMBAY       - IIT Bombay
IIT_DELHI        - IIT Delhi
IIT_MADRAS       - IIT Madras
IIT_KANPUR       - IIT Kanpur
NIT_TRICHY       - NIT Trichy
IIIT_HYDERABAD   - IIIT Hyderabad
OTHER            - Other
```

## Setup Instructions

1. Go to Firebase Console (https://console.firebase.google.com/)
2. Enable Authentication > Sign-in methods > Google
3. Enable Firestore Database
4. Enable Firebase Storage (for profile images)
5. Copy your Firebase config to src/firebase/config.js
6. Use the **Seed Data** page in the app to add sample data

## Firebase Security Rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Colleges collection
    match /colleges/{collegeId} {
      allow read: if request.auth != null;
      allow write: if false; // Only backend/admin should write
    }
    
    // Courses collection
    match /courses/{courseId} {
      allow read: if request.auth != null;
      allow write: if false; // Only backend/admin should write
    }
    
    // Folders collection
    match /folders/{folderId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null && 
        resource.data.uploadedById == request.auth.uid;
    }
    
    // Leaderboard collection
    match /leaderboard/{userId} {
      allow read: if request.auth != null;
      allow write: if false; // Only backend can update
    }
  }
}
```

## Storage Rules (for profile images and resources)

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /profileImages/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    match /courses/{courseId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```
