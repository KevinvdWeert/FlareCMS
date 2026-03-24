import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';

export const loginFirebase = async (email, password) => {
  return await signInWithEmailAndPassword(auth, email, password);
};

export const logoutFirebase = async () => {
  return await signOut(auth);
};

export const observeAuthState = (callback) => {
  return onAuthStateChanged(auth, callback);
};
