# Firebase Database Structure

## Collections

### 1. users
```
{
  uid: string,
  displayName: string,
  email: string,
  photoURL: string,
  enrolledCourses: array[courseId],
  contributions: number,
  createdAt: timestamp
}
```

### 2. courses
```
{
  code: string,          // e.g., "ME F316"
  name: string,          // e.g., "MANUFACTURING MANAGEMENT"
  semester: string,      // e.g., "I-Semester 2025-26"
  progress: number,      // 0-100
  createdAt: timestamp
}
```

### 3. resources
```
{
  courseId: string,      // Reference to course
  name: string,          // File name
  path: string,          // Full path with folders e.g., "24-25 1st Sem/Papers/exam.pdf"
  tag: string,           // "Paper", "Slide", "Book", etc.
  uploadedBy: string,    // User display name
  uploadedById: string,  // User uid
  url: string,           // Download URL from Firebase Storage
  uploadedAt: timestamp
}
```

### 4. leaderboard
```
{
  userId: string,        // User uid
  displayName: string,
  contributions: number,
  lastUpdated: timestamp
}
```

## Sample Data for Testing

Use this structure to add test data to Firestore:

### Sample Courses:
1. {
   code: "ME F316",
   name: "MANUFACTURING MANAGEMENT",
   semester: "I-Semester 2025-26",
   progress: 0
}

2. {
   code: "CS F407",
   name: "ARTIFICIAL INTELLIGENCE",
   semester: "I-Semester 2025-26",
   progress: 9
}

3. {
   code: "ME F317",
   name: "ENGINES MOTORS, AND MOBILITY",
   semester: "I-Semester 2025-26",
   progress: 4
}

4. {
   code: "ME F315",
   name: "ADV MANUFACTURING PROCESSES",
   semester: "I-Semester 2025-26",
   progress: 0
}

5. {
   code: "BITS F464",
   name: "MACHINE LEARNING",
   semester: "I-Semester 2025-26",
   progress: 0
}

### Sample Resources:
{
  courseId: "BITS_F464",
  name: "Slides 2024-2025 sem 2",
  path: "Slides 2024-2025 sem 2",
  tag: "Paper",
  uploadedBy: "ADITYA PATHAK",
  uploadedById: "user123",
  url: "#"
}

{
  courseId: "BITS_F464",
  name: "24-25 1st Sem Paper",
  path: "24-25 1st Sem Paper",
  tag: "Paper",
  uploadedBy: "SAMARTH SANJAY LANDE",
  uploadedById: "user456",
  url: "#"
}

{
  courseId: "BITS_F464",
  name: "Compre Qp -1.jpeg",
  path: "24-25 1st Sem Paper/Compre Qp -1.jpeg",
  tag: "Paper",
  uploadedBy: "Anonymous",
  uploadedById: "user789",
  url: "#"
}

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
    
    // Courses collection
    match /courses/{courseId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null; // Can be restricted to admin
    }
    
    // Resources collection
    match /resources/{resourceId} {
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

## Setup Instructions

1. Go to Firebase Console (https://console.firebase.google.com/)
2. Create a new project or select existing
3. Enable Authentication > Sign-in methods > Google
4. Enable Firestore Database
5. Create the collections above
6. Add the security rules
7. Copy your Firebase config to src/firebase/config.js
