# Course Management App

A modern course management platform built with React, Tailwind CSS, and Firebase.

## Features

✅ **Google Authentication** - Secure sign-in with Google accounts  
✅ **Course Cards** - Beautiful gradient cards with pattern backgrounds  
✅ **Search & Enroll** - Search all courses and enroll/unenroll easily  
✅ **Course Resources** - Collapsible folder structure for course materials  
✅ **Leaderboard** - Track top contributors  
✅ **Fixed Sidebar** - Easy navigation with scrollable main content  
✅ **Responsive Design** - Works on all screen sizes  

## Tech Stack

- **React 18** - UI framework
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Firebase** - Authentication & Database
- **React Router** - Navigation
- **Lucide React** - Icons

## Project Structure

```
src/
├── components/
│   ├── Layout.jsx          # Main layout with sidebar
│   ├── Sidebar.jsx         # Navigation sidebar
│   └── CourseCard.jsx      # Course card component
├── pages/
│   ├── Login.jsx           # Login page
│   ├── Home.jsx            # Home page with course cards
│   └── CoursePage.jsx      # Individual course page
├── context/
│   └── AuthContext.jsx     # Authentication context
├── firebase/
│   └── config.js           # Firebase configuration
├── utils/
│   └── patterns.js         # Card pattern backgrounds
├── App.jsx                 # Main app with routing
└── main.jsx                # App entry point
```

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Firebase

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Enable **Google Authentication**:
   - Go to Authentication > Sign-in method
   - Enable Google provider
4. Create **Firestore Database**:
   - Go to Firestore Database
   - Create database in production mode
5. Copy your Firebase configuration
6. Update `src/firebase/config.js` with your config:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### 3. Add Sample Data to Firestore

See `FIREBASE_SETUP.md` for detailed database structure and sample data.

Create these collections in Firestore:
- `users` - User profiles
- `courses` - Course information
- `resources` - Course materials
- `leaderboard` - Contribution rankings

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Usage

1. **Sign In** - Click "Sign in with Google" on the login page
2. **Browse Courses** - View all enrolled courses on the home page
3. **Search** - Use the search bar to find courses
4. **Enroll/Unenroll** - Hover over a course card to enroll or unenroll
5. **View Course** - Click on a course card to see resources
6. **Browse Resources** - Expand/collapse folders to view course materials

## Database Structure

### Firestore Collections

**users**
```javascript
{
  uid: string,
  displayName: string,
  email: string,
  photoURL: string,
  enrolledCourses: array,
  contributions: number,
  createdAt: timestamp
}
```

**courses**
```javascript
{
  code: string,
  name: string,
  semester: string,
  progress: number,
  createdAt: timestamp
}
```

**resources**
```javascript
{
  courseId: string,
  name: string,
  path: string,
  tag: string,
  uploadedBy: string,
  uploadedById: string,
  url: string,
  uploadedAt: timestamp
}
```

## Features to Add Later

- [ ] File upload functionality
- [ ] Calendar integration
- [ ] Timetable creator
- [ ] CGPA calculator
- [ ] Resume builder
- [ ] Download resources
- [ ] Real-time notifications
- [ ] Admin panel

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## License

MIT
