import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, GithubAuthProvider, signInWithPopup } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Initialize Firestore with multi-tab persistent local cache to drastically reduce reads on Free Tier (Spark Plan)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
}, firebaseConfig.firestoreDatabaseId);

export const auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();
export const githubProvider = new GithubAuthProvider();

export const signInWithGoogle = async () => {
  console.log("Starting Google Sign-In...");
  try {
    const result = await signInWithPopup(auth, googleProvider);
    console.log("Google Sign-In success:", result.user.email);
  } catch (error: any) {
    console.error("Error signing in with Google:", error);
    if (error.code === 'auth/unauthorized-domain') {
      alert("Domain ini belum terdaftar di Firebase. Silakan tambahkan domain vercel.app Anda ke 'Authorized domains' di Firebase Console (Authentication > Settings).");
    } else {
      alert("Gagal masuk dengan Google: " + error.message);
    }
  }
};

export const signInWithGithub = async () => {
  console.log("Starting GitHub Sign-In...");
  try {
    const result = await signInWithPopup(auth, githubProvider);
    console.log("GitHub Sign-In success:", result.user.email);
  } catch (error: any) {
    console.error("Error signing in with GitHub:", error);
    if (error.code === 'auth/unauthorized-domain') {
      alert("Domain ini belum terdaftar di Firebase. Silakan tambahkan domain vercel.app Anda ke 'Authorized domains' di Firebase Console (Authentication > Settings).");
    } else {
      alert("Gagal masuk dengan GitHub: " + error.message);
    }
  }
};
