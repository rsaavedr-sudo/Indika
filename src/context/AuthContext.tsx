import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs, limit, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';

interface UserProfile {
  id?: string; // Firestore Document ID
  uid: string;
  nome: string;
  sobrenome: string;
  email: string;
  role: 'admin' | 'usuario';
  pontos: number;
  ativo: boolean;
  hasAccess?: boolean;
  mustChangePassword?: boolean;
  organizationId?: string;
  lastLoginAt?: any;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (uid: string) => {
    try {
      let profileData: UserProfile | null = null;
      let docId: string | null = null;

      // First try direct document fetch (for users registered via Register.tsx)
      const docRef = doc(db, 'usuarios', uid);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        profileData = docSnap.data() as UserProfile;
        docId = docSnap.id;
      } else {
        // If not found, query by uid field (for users created by admin)
        const q = query(collection(db, 'usuarios'), where('uid', '==', uid), limit(1));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const userDoc = querySnapshot.docs[0];
          profileData = userDoc.data() as UserProfile;
          docId = userDoc.id;
        }
      }

      if (profileData && docId) {
        // Access Control: Block if hasAccess is false (for non-admins)
        if (profileData.role !== 'admin' && profileData.hasAccess === false) {
          console.warn("User access is disabled.");
          setProfile(null);
          await auth.signOut();
          return;
        }

        setProfile({ id: docId, ...profileData });

        // Auditing: Update lastLoginAt
        await updateDoc(doc(db, 'usuarios', docId), {
          lastLoginAt: serverTimestamp()
        });
      } else {
        setProfile(null);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      setProfile(null);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await fetchProfile(currentUser.uid);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.uid);
    }
  };

  const value = {
    user,
    profile,
    loading,
    isAdmin: profile?.role === 'admin',
    refreshProfile
  };

  return (
    <AuthContext.Provider value={value}>
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
