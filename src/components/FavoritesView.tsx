import { useState } from 'react';
import { Heart, Users, FileText, Loader2, LogOut } from 'lucide-react';
import type { User } from 'firebase/auth';
import type { PawchiveCreator, PawchivePostSummary } from '../types/spacex';
import { CreatorCard } from './CreatorCard';
import { PostCard } from './PostCard';

interface FavoritesViewProps {
  favoriteCreators: PawchiveCreator[];
  favoritePosts: PawchivePostSummary[];
  blurThumbnails: boolean;
  googleUser: User | null;
  authReady: boolean;
  signingIn: boolean;
  onLoginWithGoogle: () => void;
  onLogoutGoogle: () => void;
  onToggleCreatorFavorite: (creator: PawchiveCreator) => void;
  onTogglePostFavorite: (post: PawchivePostSummary) => void;
  onOpenCreator: (service: string, id: string) => void;
  onOpenPost: (post: PawchivePostSummary) => void;
  onGoExplore: () => void;
}

export function FavoritesView({
  favoriteCreators,
  favoritePosts,
  blurThumbnails,
  googleUser,
  authReady,
  signingIn,
  onLoginWithGoogle,
  onLogoutGoogle,
  onToggleCreatorFavorite,
  onTogglePostFavorite,
  onOpenCreator,
  onOpenPost,
  onGoExplore,
}: FavoritesViewProps) {
  const [tab, setTab] = useState<'creators' | 'posts'>('creators');

  return (
    <section className="motion-blur-in space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-white">
            Seus Favoritos
          </h1>
          <p className="mt-1 text-sm text-slate-300">
            {googleUser
              ? `Sincronizados na nuvem com ${googleUser.displayName || googleUser.email}. Acesse de qualquer dispositivo.`
              : 'Entre com sua conta Google para salvar e sincronizar seus favoritos em qualquer dispositivo.'}
          </p>
        </div>

        {googleUser && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
              <button
                type="button"
                onClick={() => setTab('creators')}
                className={`inline-flex min-h-[38px] items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  tab === 'creators' ? 'bg-white text-[#050507]' : 'text-slate-300 hover:text-white'
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                Criadores ({favoriteCreators.length})
              </button>
              <button
                type="button"
                onClick={() => setTab('posts')}
                className={`inline-flex min-h-[38px] items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  tab === 'posts' ? 'bg-white text-[#050507]' : 'text-slate-300 hover:text-white'
                }`}
              >
                <FileText className="h-3.5 w-3.5" />
                Publicações ({favoritePosts.length})
              </button>
            </div>
          </div>
        )}
      </div>

      {!authReady ? (
        <div className="liquid-glass flex min-h-[260px] flex-col items-center justify-center rounded-3xl p-10 text-center">
          <Loader2 className="h-7 w-7 animate-spin text-sky-400" />
          <p className="mt-3 text-sm text-slate-300">Verificando sua conta Google...</p>
        </div>
      ) : !googleUser ? (
        <div className="liquid-glass mx-auto max-w-xl rounded-3xl p-8 sm:p-10 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-400/30 bg-rose-500/15 text-rose-300">
            <Heart className="h-7 w-7 fill-current" />
          </div>

          <h2 className="mt-5 font-display text-xl sm:text-2xl font-semibold text-white">
            Você ainda não fez login
          </h2>
          <p className="mt-2.5 text-sm leading-relaxed text-slate-300">
            Seus criadores e publicações favoritos ficam vinculados à sua conta Google. Se ainda não tiver
            cadastro, sua conta será criada automaticamente ao entrar.
          </p>

          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onLoginWithGoogle}
              disabled={signingIn}
              className="inline-flex min-h-[48px] w-full sm:w-auto items-center justify-center gap-3 rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-black transition-transform hover:scale-[1.01] hover:bg-slate-200 disabled:opacity-60"
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
              <span>{signingIn ? 'Conectando...' : 'Entrar com Google'}</span>
            </button>

            <button
              type="button"
              onClick={onGoExplore}
              className="inline-flex min-h-[48px] w-full sm:w-auto items-center justify-center rounded-2xl border border-white/15 bg-white/[0.04] px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10"
            >
              Continuar explorando
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="liquid-glass flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3">
            <div className="flex items-center gap-3 min-w-0">
              {googleUser.photoURL ? (
                <img
                  src={googleUser.photoURL}
                  alt={googleUser.displayName || 'Google'}
                  className="h-9 w-9 shrink-0 rounded-full border border-white/20 object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white">
                  {(googleUser.displayName || googleUser.email || 'G').slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">
                  {googleUser.displayName || 'Conta Google conectada'}
                </p>
                <p className="truncate text-xs text-slate-400">{googleUser.email}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onLogoutGoogle}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sair da conta
            </button>
          </div>

          {tab === 'creators' && (
            favoriteCreators.length === 0 ? (
              <div className="liquid-glass rounded-2xl p-10 text-center">
                <Heart className="mx-auto h-8 w-8 text-slate-500" />
                <h2 className="mt-3 font-display text-lg font-medium text-white">Nenhum criador favoritado</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Clique no coração em qualquer criador para salvá-lo na sua conta Google.
                </p>
                <button
                  type="button"
                  onClick={onGoExplore}
                  className="mt-5 inline-flex min-h-[42px] items-center rounded-xl bg-white px-5 py-2.5 text-xs font-semibold text-[#050507] hover:bg-slate-200"
                >
                  Explorar criadores
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {favoriteCreators.map((c) => (
                  <CreatorCard
                    key={`${c.service}-${c.id}`}
                    creator={c}
                    isFavorite
                    onOpenProfile={onOpenCreator}
                    onToggleFavorite={onToggleCreatorFavorite}
                  />
                ))}
              </div>
            )
          )}

          {tab === 'posts' && (
            favoritePosts.length === 0 ? (
              <div className="liquid-glass rounded-2xl p-10 text-center">
                <Heart className="mx-auto h-8 w-8 text-slate-500" />
                <h2 className="mt-3 font-display text-lg font-medium text-white">Nenhuma publicação salva</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Clique no coração em qualquer publicação para salvá-la na sua conta Google.
                </p>
                <button
                  type="button"
                  onClick={onGoExplore}
                  className="mt-5 inline-flex min-h-[42px] items-center rounded-xl bg-white px-5 py-2.5 text-xs font-semibold text-[#050507] hover:bg-slate-200"
                >
                  Explorar publicações
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {favoritePosts.map((p) => (
                  <PostCard
                    key={`${p.service}-${p.user}-${p.id}`}
                    post={p}
                    blurThumbnail={blurThumbnails}
                    isFavorite
                    onOpenPost={onOpenPost}
                    onOpenCreator={onOpenCreator}
                    onToggleFavorite={onTogglePostFavorite}
                  />
                ))}
              </div>
            )
          )}
        </>
      )}
    </section>
  );
}
