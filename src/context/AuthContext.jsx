import { createContext, useContext, useEffect, useState } from 'react';
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, googleProvider, db, storage } from '../firebase/config';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Create or update user document in Firestore
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        // Extract domain after @ from email
        const emailDomain = user.email.split('@')[1];
        
        // Find matching college (only fetch once)
        const collegesSnapshot = await getDocs(collection(db, 'colleges'));
        let matchedCollegeId = null;
        
        collegesSnapshot.docs.forEach(doc => {
          const collegeData = doc.data();
          const emailExtensions = collegeData.emailExtensions || [];
          
          for (const collegeEmail of emailExtensions) {
            if (collegeEmail) {
              const cleanCollegeEmail = collegeEmail.replace('@', '');
              if (emailDomain === cleanCollegeEmail) {
                matchedCollegeId = collegeData.collegeId;
                break;
              }
            }
          }
        });
        
        if (!userSnap.exists()) {

          const newUserData = {
            uid: user.uid,
            displayName: user.displayName,
            email: user.email,
            photoURL: '/person.svg',
            bio: '',
            collegeId: matchedCollegeId, // Will be null if no match
            enrolledCourses: [],
            contributions: 0,
            xp: 0,
            time: [], // Array of {courseId, minutes}
            dailyTime: [], // Array of {date, totalMinutes}
            isPremium: false,
            role: 'user', 
            adminCourses: [], // Course IDs that this admin can manage
            createdAt: new Date().toISOString()
          };
          await setDoc(userRef, newUserData);
          setUserProfile(newUserData);
        } else {
          // User exists - check if collegeId needs to be updated
          const existingData = userSnap.data();
          
          // If collegeId doesn't match the current email domain, update it
          if (existingData.collegeId !== matchedCollegeId) {
            await updateDoc(userRef, { collegeId: matchedCollegeId });
            setUserProfile({ ...existingData, collegeId: matchedCollegeId });
          } else {
            setUserProfile(existingData);
          }
        }
        
        setUser(user);
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    try {
      // Set persistence to LOCAL so users stay logged in
      await setPersistence(auth, browserLocalPersistence);
      await signInWithPopup(auth, googleProvider);
      return true;
    } catch (error) {
      console.error('Error signing in with Google:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  const updateUserProfile = async (updates) => {
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, updates);
      
      // Refresh user profile
      const userSnap = await getDoc(userRef);
      setUserProfile(userSnap.data());
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  };

  const uploadProfileImage = async (file) => {
    try {
      const imageRef = ref(storage, `profileImages/${user.uid}`);
      await uploadBytes(imageRef, file);
      const photoURL = await getDownloadURL(imageRef);
      
      await updateUserProfile({ photoURL });
      return photoURL;
    } catch (error) {
      console.error('Error uploading profile image:', error);
      throw error;
    }
  };

  const value = {
    user,
    userProfile,
    loading,
    signInWithGoogle,
    logout,
    updateUserProfile,
    uploadProfileImage
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
