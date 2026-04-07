import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Default config
const firebaseConfig = {
  apiKey: "REPLACE_WITH_YOUR_API_KEY",
  authDomain: "indika-app.firebaseapp.com",
  projectId: "indika-app",
  storageBucket: "indika-app.appspot.com",
  messagingSenderId: "REPLACE_WITH_YOUR_ID",
  appId: "REPLACE_WITH_YOUR_APP_ID"
};

// We'll use a dynamic approach to check for the config file
// Since import() is for async, we'll just try to use a global or a safer pattern
// In this environment, if the file exists, it will be available.
// However, for compilation safety, we'll use a standard initialization.

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
