import { 
  getDocs as firebaseGetDocs,
  getDoc as firebaseGetDoc,
  addDoc as firebaseAddDoc,
  updateDoc as firebaseUpdateDoc,
  deleteDoc as firebaseDeleteDoc,
  setDoc as firebaseSetDoc
} from 'firebase/firestore';
import { limitedRequest } from './requestLimiter';

// Wrapped Firestore methods with rate limiting
export const getDocs = async (...args) => {
  return limitedRequest(() => firebaseGetDocs(...args));
};

export const getDoc = async (...args) => {
  return limitedRequest(() => firebaseGetDoc(...args));
};

export const addDoc = async (...args) => {
  return limitedRequest(() => firebaseAddDoc(...args));
};

export const updateDoc = async (...args) => {
  return limitedRequest(() => firebaseUpdateDoc(...args));
};

export const deleteDoc = async (...args) => {
  return limitedRequest(() => firebaseDeleteDoc(...args));
};

export const setDoc = async (...args) => {
  return limitedRequest(() => firebaseSetDoc(...args));
};

// Re-export other Firestore functions that don't need rate limiting
export {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  endBefore,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
