import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth } from './firebase';
import { db } from './firebase';

const LOGIN_FAILURE_KEY = 'flarecms-login-failures';
const LOGIN_LOCK_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;

export const loginFirebase = async (email, password) => {
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(LOGIN_FAILURE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (
        data.blockedUntil &&
        Date.now() < data.blockedUntil &&
        data.email === email.trim().toLowerCase()
      ) {
        throw new Error('Too many failed attempts. Try again later.');
      }
    }
  }

  try {
    const response = await signInWithEmailAndPassword(auth, email, password);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(LOGIN_FAILURE_KEY);
    }
    return response;
  } catch (err) {
    if (typeof window !== 'undefined') {
      const normalizedEmail = email.trim().toLowerCase();
      const raw = localStorage.getItem(LOGIN_FAILURE_KEY);
      const data = raw ? JSON.parse(raw) : { count: 0, email: normalizedEmail };
      const isSameEmail = data.email === normalizedEmail;
      const count = isSameEmail ? data.count + 1 : 1;
      const blockedUntil = count >= MAX_LOGIN_ATTEMPTS ? Date.now() + LOGIN_LOCK_WINDOW_MS : null;
      localStorage.setItem(
        LOGIN_FAILURE_KEY,
        JSON.stringify({ count, email: normalizedEmail, blockedUntil })
      );
    }
    throw err;
  }
};

export const logoutFirebase = async () => {
  return await signOut(auth);
};

export const observeAuthState = (callback) => {
  return onAuthStateChanged(auth, callback);
};

export const signupFirebase = async (email, password, displayName) => {
  const credentials = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(credentials.user, { displayName });
  await setDoc(doc(db, 'users', credentials.user.uid), {
    email: email.trim().toLowerCase(),
    displayName: displayName.trim(),
    role: 'user',
    createdAt: serverTimestamp()
  }, { merge: true });
  return credentials;
};

export const sendResetPasswordEmail = async (email) => {
  return await sendPasswordResetEmail(auth, email.trim().toLowerCase());
};
