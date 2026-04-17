import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// StrictMode removed: causes Firebase Firestore INTERNAL ASSERTION errors
// by mounting/unmounting components twice in development
createRoot(document.getElementById('root')!).render(
  <App />
);
