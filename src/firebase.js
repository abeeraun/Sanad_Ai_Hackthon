import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCVL-CQIrCGCWCW8AseUPIBtyqLCG8zIg",
  authDomain: "sanad-ai-44ccc.firebaseapp.com",
  databaseURL: "https://sanad-ai-44ccc-default-rtdb.firebaseio.com",
  projectId: "sanad-ai-44ccc",
  storageBucket: "sanad-ai-44ccc.appspot.com",
  messagingSenderId: "393483686786",
  appId: "1:393483686786:web:af273ff623a270a8e8b59b"
};

const app = initializeApp(firebaseConfig);
// تصدير قاعدة البيانات Realtime Database
export const db = getDatabase(app);
