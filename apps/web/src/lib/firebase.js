import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAnalytics, isSupported } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: 'AIzaSyCxyCtuTT4y0bgcs74wZrsTv1YEPCGIBI8',
  authDomain: 'custom-cms-1c4c7.firebaseapp.com',
  projectId: 'custom-cms-1c4c7',
  storageBucket: 'custom-cms-1c4c7.firebasestorage.app',
  messagingSenderId: '1006964701930',
  appId: '1:1006964701930:web:8e4fd4fb7f919c2ecb7593',
  measurementId: 'G-R1F5JV5R5P'
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export const analyticsPromise =
  typeof window !== 'undefined'
    ? isSupported().then((supported) => (supported ? getAnalytics(app) : null))
    : Promise.resolve(null);
