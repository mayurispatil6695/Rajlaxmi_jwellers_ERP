import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyAEaOljszS6_MbVH94eH6W1MuqNDj9M-aA",
  authDomain: "rajlaxmi-jewellers.firebaseapp.com",
  databaseURL: "https://rajlaxmi-jewellers-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "rajlaxmi-jewellers",
  storageBucket: "rajlaxmi-jewellers.firebasestorage.app",
  messagingSenderId: "144056189652",
  appId: "1:144056189652:web:1850aec75c129123f4f141"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
export default app;
