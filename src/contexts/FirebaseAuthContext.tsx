import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import type { PawchiveCreator, PawchivePostSummary } from '../types/spacex';
import { useToast } from '../hooks/useToast';

export type PendingFavoriteAction =
  | { type: 'creator'; creator: PawchiveCreator }
  | { type: 'post'; post: PawchivePostSummary };

interface FirebaseAuthContextValue {
  user: User | null;
  authReady: boolean;
  signingIn: boolean;
  favoriteCreators: PawchiveCreator[];
  favoritePosts: PawchivePostSummary[];
  loginModalOpen: boolean;
  pendingFavorite: PendingFavoriteAction | null;
  openLoginModal: (pending?: PendingFavoriteAction) => void;
  closeLoginModal: () => void;
  signInWithGoogle: () => Promise<void>;
  logoutGoogle: () => Promise<void>;
  isCreatorFavorite: (service: string, id: string) => boolean;
  isPostFavorite: (service: string, creatorId: string, postId: string) => boolean;
  toggleCreatorFavorite: (creator: PawchiveCreator) => Promise<void>;
  togglePostFavorite: (post: PawchivePostSummary) => Promise<void>;
  clearAllCloudFavorites: () => Promise<void>;
}

const FirebaseAuthContext = createContext<FirebaseAuthContextValue | null>(null);

function sanitizeDocId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_');
  return cleaned.slice(0, 128) || 'item';
}

function creatorDocId(service: string, id: string): string {
  return sanitizeDocId(`${service}_${id}`);
}

function postDocId(service: string, creatorId: string, postId: string): string {
  return sanitizeDocId(`${service}_${creatorId}_${postId}`);
}

function clip(val: string | undefined | null, max: number): string {
  if (!val) return '';
  return val.length > max ? val.slice(0, max) : val;
}

export function FirebaseAuthProvider({ children }: { children: ReactNode }) {
  const { showToast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  const [favoriteCreators, setFavoriteCreators] = useState<PawchiveCreator[]>([]);
  const [favoritePosts, setFavoritePosts] = useState<PawchivePostSummary[]>([]);

  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [pendingFavorite, setPendingFavorite] = useState<PendingFavoriteAction | null>(null);
  const pendingRef = useRef<PendingFavoriteAction | null>(null);
  pendingRef.current = pendingFavorite;

  const ensureUserProfile = useCallback(async (firebaseUser: User) => {
    const profilePath = `users/${firebaseUser.uid}`;
    const ref = doc(db, 'users', firebaseUser.uid);
    try {
      const snap = await getDoc(ref);
      const payload = {
        uid: clip(firebaseUser.uid, 128),
        displayName: clip(firebaseUser.displayName || 'Usuário SpaceX', 120),
        email: clip(firebaseUser.email || '', 200),
        photoURL: clip(firebaseUser.photoURL || '', 500),
      };

      if (!snap.exists()) {
        await setDoc(ref, {
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(ref, {
          displayName: payload.displayName,
          email: payload.email,
          photoURL: payload.photoURL,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, profilePath);
    }
  }, []);

  const saveCreatorToFirestore = useCallback(
    async (uid: string, creator: PawchiveCreator) => {
      const favId = creatorDocId(creator.service, creator.id);
      const path = `users/${uid}/favoriteCreators/${favId}`;
      try {
        await setDoc(doc(db, 'users', uid, 'favoriteCreators', favId), {
          uid: clip(uid, 128),
          id: clip(creator.id, 128),
          name: clip(creator.name || `Criador #${creator.id}`, 200),
          public_id: clip(creator.public_id || '', 200),
          service: clip(creator.service, 40),
          indexed: Number.isFinite(creator.indexed) ? creator.indexed : 0,
          updated: Number.isFinite(creator.updated) ? creator.updated : 0,
          favorited: Number.isFinite(creator.favorited) ? creator.favorited : 0,
          ever_imported: Boolean(creator.ever_imported),
          savedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
    },
    []
  );

  const removeCreatorFromFirestore = useCallback(async (uid: string, service: string, id: string) => {
    const favId = creatorDocId(service, id);
    const path = `users/${uid}/favoriteCreators/${favId}`;
    try {
      await deleteDoc(doc(db, 'users', uid, 'favoriteCreators', favId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  }, []);

  const savePostToFirestore = useCallback(
    async (uid: string, post: PawchivePostSummary) => {
      const favId = postDocId(post.service, post.user, post.id);
      const path = `users/${uid}/favoritePosts/${favId}`;
      const filesCount = (post.file?.path ? 1 : 0) + (post.attachments?.length || 0);
      try {
        await setDoc(doc(db, 'users', uid, 'favoritePosts', favId), {
          uid: clip(uid, 128),
          id: clip(post.id, 128),
          user: clip(post.user, 128),
          service: clip(post.service, 40),
          title: clip(post.title || `Publicação #${post.id}`, 400),
          substring: clip(post.substring || '', 600),
          published: clip(post.published || post.added || '', 64),
          creator_name: clip(post.creator_name || '', 200),
          file_name: clip(post.file?.name || '', 300),
          file_path: clip(post.file?.path || '', 500),
          file_server: clip(post.file?.server || '', 200),
          attachments_count: Math.min(500, Math.max(0, filesCount)),
          savedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
    },
    []
  );

  const removePostFromFirestore = useCallback(
    async (uid: string, service: string, creatorId: string, postId: string) => {
      const favId = postDocId(service, creatorId, postId);
      const path = `users/${uid}/favoritePosts/${favId}`;
      try {
        await deleteDoc(doc(db, 'users', uid, 'favoritePosts', favId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    },
    []
  );

  // Listen to Firebase Auth state & handle redirect fallback result if popup was blocked
  useEffect(() => {
    getRedirectResult(auth)
      .then((res) => {
        if (res?.user) {
          showToast(`Bem-vindo(a), ${res.user.displayName || res.user.email}!`, 'success');
        }
      })
      .catch(() => {});

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);

      if (firebaseUser) {
        try {
          await ensureUserProfile(firebaseUser);
        } catch {
          // Logged via handleFirestoreError
        }
      } else {
        setFavoriteCreators([]);
        setFavoritePosts([]);
      }
    });
    return () => unsubscribe();
  }, [ensureUserProfile, showToast]);

  // Real-time Firestore sync ONLY when authenticated
  useEffect(() => {
    if (!authReady || !user) return;

    const creatorsPath = `users/${user.uid}/favoriteCreators`;
    const creatorsQuery = query(
      collection(db, 'users', user.uid, 'favoriteCreators'),
      where('uid', '==', user.uid),
      orderBy('savedAt', 'desc')
    );
    const unsubCreators = onSnapshot(
      creatorsQuery,
      (snapshot) => {
        const items: PawchiveCreator[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: String(data.id),
            name: String(data.name || ''),
            public_id: data.public_id ? String(data.public_id) : null,
            service: String(data.service),
            indexed: Number(data.indexed || 0),
            updated: Number(data.updated || 0),
            favorited: Number(data.favorited || 0),
            ever_imported: Boolean(data.ever_imported),
          };
        });
        setFavoriteCreators(items);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, creatorsPath);
      }
    );

    const postsPath = `users/${user.uid}/favoritePosts`;
    const postsQuery = query(
      collection(db, 'users', user.uid, 'favoritePosts'),
      where('uid', '==', user.uid),
      orderBy('savedAt', 'desc')
    );
    const unsubPosts = onSnapshot(
      postsQuery,
      (snapshot) => {
        const items: PawchivePostSummary[] = snapshot.docs.map((d) => {
          const data = d.data();
          const hasFile = Boolean(data.file_path);
          return {
            id: String(data.id),
            user: String(data.user),
            service: String(data.service),
            title: String(data.title || ''),
            substring: String(data.substring || ''),
            published: String(data.published || ''),
            creator_name: data.creator_name ? String(data.creator_name) : undefined,
            file: hasFile
              ? {
                  name: data.file_name ? String(data.file_name) : undefined,
                  path: String(data.file_path),
                  server: data.file_server ? String(data.file_server) : undefined,
                }
              : undefined,
            attachments:
              Number(data.attachments_count || 0) > (hasFile ? 1 : 0)
                ? Array.from({ length: Number(data.attachments_count) - (hasFile ? 1 : 0) }).map(() => ({}))
                : [],
          };
        });
        setFavoritePosts(items);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, postsPath);
      }
    );

    return () => {
      unsubCreators();
      unsubPosts();
    };
  }, [authReady, user]);

  const openLoginModal = useCallback((pending?: PendingFavoriteAction) => {
    setPendingFavorite(pending || null);
    setLoginModalOpen(true);
  }, []);

  const closeLoginModal = useCallback(() => {
    setLoginModalOpen(false);
    setPendingFavorite(null);
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setSigningIn(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const signedUser = cred.user;
      await ensureUserProfile(signedUser);

      const pending = pendingRef.current;
      setLoginModalOpen(false);
      setPendingFavorite(null);

      if (pending) {
        if (pending.type === 'creator') {
          await saveCreatorToFirestore(signedUser.uid, pending.creator);
          showToast(`Conectado com Google e ${pending.creator.name} salvo nos favoritos!`, 'success');
        } else {
          await savePostToFirestore(signedUser.uid, pending.post);
          showToast('Conectado com Google e publicação salva nos favoritos!', 'success');
        }
      } else {
        showToast(`Bem-vindo(a), ${signedUser.displayName || signedUser.email}!`, 'success');
      }
    } catch (err) {
      const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code: unknown }).code) : '';
      if (code === 'auth/popup-blocked') {
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch {
          showToast('Permita pop-ups no navegador para entrar com sua conta Google.', 'error');
        }
      } else if (code === 'auth/unauthorized-domain') {
        const host = typeof window !== 'undefined' ? window.location.hostname : 'spacex-posts.vercel.app';
        showToast(
          `Domínio "${host}" ainda não autorizado no Firebase Auth. Adicione-o em Firebase Console > Authentication > Authorized domains.`,
          'error'
        );
      } else if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        showToast('Login com Google cancelado.', 'info');
      } else {
        showToast(err instanceof Error ? err.message : 'Erro ao entrar com Google.', 'error');
      }
    } finally {
      setSigningIn(false);
    }
  }, [ensureUserProfile, saveCreatorToFirestore, savePostToFirestore, showToast]);

  const logoutGoogle = useCallback(async () => {
    await signOut(auth);
    showToast('Você saiu da sua conta Google.', 'info');
  }, [showToast]);

  const isCreatorFavorite = useCallback(
    (service: string, id: string) =>
      Boolean(user) && favoriteCreators.some((c) => c.service === service && c.id === id),
    [user, favoriteCreators]
  );

  const isPostFavorite = useCallback(
    (service: string, creatorId: string, postId: string) =>
      Boolean(user) && favoritePosts.some((p) => p.service === service && p.user === creatorId && p.id === postId),
    [user, favoritePosts]
  );

  const toggleCreatorFavorite = useCallback(
    async (creator: PawchiveCreator) => {
      if (!user) {
        openLoginModal({ type: 'creator', creator });
        return;
      }

      const exists = favoriteCreators.some((c) => c.service === creator.service && c.id === creator.id);
      if (exists) {
        await removeCreatorFromFirestore(user.uid, creator.service, creator.id);
        showToast(`${creator.name} removido dos favoritos.`, 'info');
      } else {
        await saveCreatorToFirestore(user.uid, creator);
        showToast(`${creator.name} salvo na sua conta Google.`, 'success');
      }
    },
    [user, favoriteCreators, openLoginModal, removeCreatorFromFirestore, saveCreatorToFirestore, showToast]
  );

  const togglePostFavorite = useCallback(
    async (post: PawchivePostSummary) => {
      if (!user) {
        openLoginModal({ type: 'post', post });
        return;
      }

      const exists = favoritePosts.some(
        (p) => p.service === post.service && p.user === post.user && p.id === post.id
      );
      if (exists) {
        await removePostFromFirestore(user.uid, post.service, post.user, post.id);
        showToast('Publicação removida dos favoritos.', 'info');
      } else {
        await savePostToFirestore(user.uid, post);
        showToast('Publicação salva na sua conta Google.', 'success');
      }
    },
    [user, favoritePosts, openLoginModal, removePostFromFirestore, savePostToFirestore, showToast]
  );

  const clearAllCloudFavorites = useCallback(async () => {
    if (!user) return;
    await Promise.all([
      ...favoriteCreators.map((c) => removeCreatorFromFirestore(user.uid, c.service, c.id)),
      ...favoritePosts.map((p) => removePostFromFirestore(user.uid, p.service, p.user, p.id)),
    ]);
  }, [user, favoriteCreators, favoritePosts, removeCreatorFromFirestore, removePostFromFirestore]);

  return (
    <FirebaseAuthContext.Provider
      value={{
        user,
        authReady,
        signingIn,
        favoriteCreators,
        favoritePosts,
        loginModalOpen,
        pendingFavorite,
        openLoginModal,
        closeLoginModal,
        signInWithGoogle,
        logoutGoogle,
        isCreatorFavorite,
        isPostFavorite,
        toggleCreatorFavorite,
        togglePostFavorite,
        clearAllCloudFavorites,
      }}
    >
      {children}
    </FirebaseAuthContext.Provider>
  );
}

export function useFirebaseAuth() {
  const ctx = useContext(FirebaseAuthContext);
  if (!ctx) throw new Error('useFirebaseAuth deve ser usado dentro de FirebaseAuthProvider');
  return ctx;
}
