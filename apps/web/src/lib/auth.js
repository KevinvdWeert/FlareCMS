import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth } from './firebase';
import { normalizeEmail } from './validation';

const LOGIN_FAILURE_KEY = 'flarecms-login-failures';
// 15-minute lock window after MAX_LOGIN_ATTEMPTS failed logins.
const LOGIN_LOCK_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;
const IS_EMULATOR_MODE = import.meta.env.VITE_USE_EMULATORS === 'true';
const IS_DEV_MODE = import.meta.env.DEV;
const IS_LOGIN_LOCK_ENABLED = !IS_EMULATOR_MODE && !IS_DEV_MODE;

export const loginFirebase = async (email, password) => {
  const normalizedEmail = normalizeEmail(email);
  if (IS_LOGIN_LOCK_ENABLED && typeof window !== 'undefined') {
    const raw = localStorage.getItem(LOGIN_FAILURE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (
        data.blockedUntil &&
        Date.now() < data.blockedUntil &&
        data.email === normalizedEmail
      ) {
        throw new Error('Too many failed attempts. Try again later.');
      }
    }
  }

  try {
    const response = await signInWithEmailAndPassword(auth, normalizedEmail, password);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(LOGIN_FAILURE_KEY);
    }
    return response;
  } catch (err) {
    if (IS_LOGIN_LOCK_ENABLED && typeof window !== 'undefined') {
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

export const sendResetPasswordEmail = async (email) => {
  return await sendPasswordResetEmail(auth, normalizeEmail(email));
};
