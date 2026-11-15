import { Heart, Loader2, X } from 'lucide-react';
import { useFirebaseAuth } from '../contexts/FirebaseAuthContext';

export function GoogleLoginPromptModal() {
  const {
    loginModalOpen,
    pendingFavorite,
    signingIn,
    closeLoginModal,
    signInWithGoogle,
  } = useFirebaseAuth();

  if (!loginModalOpen) return null;

  const targetDescription =
    pendingFavorite?.type === 'creator'
      ? `o criador "${pendingFavorite.creator.name}"`
      : pendingFavorite?.type === 'post'
        ? `a publicação "${pendingFavorite.post.title || `#${pendingFavorite.post.id}`}"`
        : 'seus criadores e publicações favoritos';

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/85 p-4 backdrop-blur-xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="google-login-prompt-title"
      onClick={closeLoginModal}
    >
      <div
        className="liquid-glass motion-blur-in relative w-full max-w-md rounded-3xl p-6 sm:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={closeLoginModal}
          disabled={signingIn}
          aria-label="Recusar e fechar"
          className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white transition-colors hover:bg-white/15"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-400/30 bg-rose-500/15 text-rose-300">
          <Heart className="h-6 w-6 fill-current" />
        </div>

        <h2 id="google-login-prompt-title" className="mt-4 font-display text-xl font-semibold text-white">
          Você ainda não fez login
        </h2>

        <p className="mt-2 text-sm leading-relaxed text-slate-200">
          Para salvar {targetDescription} nos favoritos e acessá-los em qualquer dispositivo, entre com sua conta
          Google. Se for seu primeiro acesso, sua conta será criada automaticamente.
        </p>

        <div className="mt-6 space-y-2.5">
          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={signingIn}
            className="inline-flex min-h-[48px] w-full items-center justify-center gap-3 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition-transform hover:scale-[1.01] hover:bg-slate-200 disabled:opacity-60"
          >
            {signingIn ? (
              <Loader2 className="h-5 w-5 animate-spin text-black" />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                />
              </svg>
            )}
            <span>{signingIn ? 'Conectando com Google...' : 'Entrar com Google'}</span>
          </button>

          <button
            type="button"
            onClick={closeLoginModal}
            disabled={signingIn}
            className="min-h-[42px] w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            Agora não (continuar sem salvar)
          </button>
        </div>
      </div>
    </div>
  );
}
