import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { 
  User, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, 
  signOut as firebaseSignOut, sendPasswordResetEmail, GoogleAuthProvider, 
  signInWithPopup, updatePassword, AuthError 
} from 'firebase/auth';
import { auth } from '@/lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updateUserPassword: (password: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signUp = async (email: string, password: string) => {
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      return { error: null };
    } catch (err) {
      const error = err as AuthError;
      return { error: new Error(error.message) };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return { error: null };
    } catch (err) {
      const error = err as AuthError;
      let message = error.message;
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
        message = 'Invalid login credentials';
      } else if (error.code === 'auth/user-not-found') {
        message = 'No account found with this email';
      }
      return { error: new Error(message) };
    }
  };

  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      return { error: null };
    } catch (err) {
      const error = err as AuthError;
      return { error: new Error(error.message) };
    }
  };

  const signOutFn = async () => {
    await firebaseSignOut(auth);
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      return { error: null };
    } catch (err) {
      const error = err as AuthError;
      return { error: new Error(error.message) };
    }
  };

  const updateUserPassword = async (password: string) => {
    try {
      if (!auth.currentUser) throw new Error('No user logged in');
      await updatePassword(auth.currentUser, password);
      return { error: null };
    } catch (err) {
      const error = err as AuthError;
      return { error: new Error(error.message) };
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, loading, signUp, signIn, signOut: signOutFn, 
      signInWithGoogle, resetPassword, updateUserPassword 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}