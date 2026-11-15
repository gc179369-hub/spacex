import { useState, type FormEvent } from 'react';
import {
  CheckCircle2,
  Cloud,
  EyeOff,
  KeyRound,
  Loader2,
  LogOut,
  RefreshCw,
  Shield,
  Trash2,
  X,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import type { AuthSessionState, UserPreferences } from '../types/spacex';
import { clearClientCache, pawchiveService } from '../services/pawchiveService';
import { ConfirmModal } from './ConfirmModal';
import { useToast } from '../hooks/useToast';

interface SettingsModalProps {
  open: boolean;
  auth: AuthSessionState;
  googleUser: User | null;
  googleSigningIn: boolean;
  preferences: UserPreferences;
  onUpdatePreferences: (next: UserPreferences) => void;
  onAuthChanged: (next: AuthSessionState) => void;
  onLoginWithGoogle: () => void;
  onLogoutGoogle: () => void;
  onClearHistory: () => void;
  onClearFavorites: () => Promise<void> | void;
  onRefreshAll: () => void;
  onClose: () => void;
}

export function SettingsModal({
  open,
  auth,
  googleUser,
  googleSigningIn,
  preferences,
  onUpdatePreferences,
  onAuthChanged,
  onLoginWithGoogle,
  onLogoutGoogle,
  onClearHistory,
  onClearFavorites,
  onRefreshAll,
  onClose,
}: SettingsModalProps) {
  const { showToast } = useToast();
  const [authTab, setAuthTab] = useState<'credentials' | 'token'>('credentials');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [confirmClearFavs, setConfirmClearFavs] = useState(false);
  const [clearingFavs, setClearingFavs] = useState(false);

  if (!open) return null;

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoggingIn(true);
    try {
      const next = await pawchiveService.login(
        authTab === 'credentials' ? { username, password } : { sessionToken }
      );
      onAuthChanged(next);
      setPassword('');
      setSessionToken('');
      showToast('Conta Pawchive conectada com segurança no servidor!', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Falha ao autenticar.', 'error');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      const next = await pawchiveService.logout();
      onAuthChanged(next);
      showToast('Sessão Pawchive desconectada.', 'info');
    } catch {
      showToast('Erro ao encerrar sessão.', 'error');
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
        onClick={onClose}
      >
        <div
          className="liquid-glass max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl p-6 space-y-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
            <div>
              <h2 id="settings-modal-title" className="font-display text-xl font-semibold text-white">
                Configurações SpaceX
              </h2>
              <p className="text-xs text-slate-400">
                Conta Google para favoritos na nuvem, preferências de exibição e sessão da API.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar configurações"
              className="rounded-xl p-2 text-slate-400 hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Google Account Cloud Favorites */}
          <div className="space-y-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
            <div className="flex items-center gap-2.5">
              <Cloud className="h-5 w-5 text-sky-300" />
              <div>
                <h3 className="font-display text-base font-semibold text-white">
                  Conta Google — Favoritos na Nuvem
                </h3>
                <p className="text-xs text-slate-400">
                  Seus criadores e publicações favoritados ficam sincronizados em qualquer dispositivo.
                </p>
              </div>
            </div>

            {googleUser ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <div className="flex items-center gap-3 min-w-0">
                  {googleUser.photoURL ? (
                    <img
                      src={googleUser.photoURL}
                      alt={googleUser.displayName || 'Google'}
                      className="h-10 w-10 shrink-0 rounded-full border border-white/20 object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">
                      {googleUser.displayName || 'Usuário Google'}
                    </p>
                    <p className="truncate text-xs text-emerald-200/80">{googleUser.email}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onLogoutGoogle}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-white/15 bg-black/40 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-black/60"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sair da conta Google
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/40 p-4">
                <p className="text-xs text-slate-300">
                  Nenhuma conta Google conectada. Entre para salvar e recuperar seus favoritos.
                </p>
                <button
                  type="button"
                  onClick={onLoginWithGoogle}
                  disabled={googleSigningIn}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-slate-200 disabled:opacity-60"
                >
                  {googleSigningIn ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  <span>{googleSigningIn ? 'Conectando...' : 'Entrar com Google'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Pawchive API Account Authentication Section */}
          <div className="space-y-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Shield className="h-5 w-5 text-sky-300" />
                <div>
                  <h3 className="font-display text-base font-semibold text-white">
                    Autenticação Pawchive (Opcional)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Necessária apenas para sinalizar revisões na API Pawchive. Cookies ficam no backend.
                  </p>
                </div>
              </div>
            </div>

            {auth.authenticated ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <div className="flex items-center gap-2.5 text-sm text-emerald-200">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Conectado como {auth.username || 'Conta Autorizada'}</span>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-white/15 bg-black/30 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-black/50"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Desconectar
                </button>
              </div>
            ) : (
              <form onSubmit={handleLogin} className="space-y-3">
                <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-[#050507]/60 p-1">
                  <button
                    type="button"
                    onClick={() => setAuthTab('credentials')}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${
                      authTab === 'credentials' ? 'bg-white text-[#050507]' : 'text-slate-300'
                    }`}
                  >
                    Usuário e Senha
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthTab('token')}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${
                      authTab === 'token' ? 'bg-white text-[#050507]' : 'text-slate-300'
                    }`}
                  >
                    Token de Sessão
                  </button>
                </div>

                {authTab === 'credentials' ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Usuário Pawchive"
                      className="min-h-[42px] rounded-xl border border-white/10 bg-[#050507]/80 px-3.5 text-sm text-white placeholder:text-slate-500"
                    />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Senha"
                      className="min-h-[42px] rounded-xl border border-white/10 bg-[#050507]/80 px-3.5 text-sm text-white placeholder:text-slate-500"
                    />
                  </div>
                ) : (
                  <input
                    type="password"
                    required
                    value={sessionToken}
                    onChange={(e) => setSessionToken(e.target.value)}
                    placeholder="Cookie/token de sessão autorizado (enviado apenas ao backend)"
                    className="min-h-[42px] w-full rounded-xl border border-white/10 bg-[#050507]/80 px-3.5 font-mono-tabular text-sm text-white placeholder:text-slate-500"
                  />
                )}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={loggingIn}
                    className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-semibold text-[#050507] hover:bg-slate-200 disabled:opacity-50"
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    {loggingIn ? 'Validando...' : 'Conectar conta'}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Display & Browsing Preferences */}
          <div className="space-y-4">
            <h3 className="font-display text-base font-semibold text-white">Exibição e Privacidade</h3>

            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
              <div className="flex items-center gap-3">
                <EyeOff className="h-5 w-5 text-slate-300" />
                <div>
                  <p className="text-sm font-medium text-white">Modo de navegação discreta (Blur em miniaturas)</p>
                  <p className="text-xs text-slate-400">Aplica desfoque suave em capas e anexos até passar o mouse.</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={preferences.blurSensitiveThumbnails}
                onChange={(e) =>
                  onUpdatePreferences({ ...preferences, blurSensitiveThumbnails: e.target.checked })
                }
                className="h-5 w-5 accent-sky-400"
              />
            </label>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
                <label htmlFor="pref-sort" className="block text-xs font-medium text-slate-300">
                  Ordenação padrão de criadores
                </label>
                <select
                  id="pref-sort"
                  value={preferences.defaultCreatorSort}
                  onChange={(e) =>
                    onUpdatePreferences({
                      ...preferences,
                      defaultCreatorSort: e.target.value as UserPreferences['defaultCreatorSort'],
                    })
                  }
                  className="mt-2 min-h-[40px] w-full rounded-xl border border-white/10 bg-[#050507] px-3 text-sm text-white"
                >
                  <option value="favorited">Mais favoritados</option>
                  <option value="updated">Atualizados recentemente</option>
                  <option value="indexed">Indexados recentemente</option>
                  <option value="name">Ordem alfabética</option>
                </select>
              </div>

              <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
                <label htmlFor="pref-size" className="block text-xs font-medium text-slate-300">
                  Criadores por página
                </label>
                <select
                  id="pref-size"
                  value={preferences.defaultPageSize}
                  onChange={(e) =>
                    onUpdatePreferences({
                      ...preferences,
                      defaultPageSize: Number(e.target.value),
                    })
                  }
                  className="mt-2 min-h-[40px] w-full rounded-xl border border-white/10 bg-[#050507] px-3 text-sm text-white"
                >
                  <option value={12}>12 por página</option>
                  <option value={24}>24 por página</option>
                  <option value={36}>36 por página</option>
                  <option value={48}>48 por página</option>
                </select>
              </div>
            </div>
          </div>

          {/* Cache & Maintenance */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  clearClientCache();
                  onRefreshAll();
                  showToast('Cache limpo e dados atualizados.', 'success');
                }}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-white/10"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Atualizar cache da API
              </button>

              <button
                type="button"
                onClick={() => {
                  onClearHistory();
                  showToast('Histórico de pesquisas removido.', 'info');
                }}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-white/10"
              >
                Limpar histórico
              </button>

              {googleUser && (
                <button
                  type="button"
                  onClick={() => setConfirmClearFavs(true)}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3.5 py-2 text-xs font-medium text-rose-200 hover:bg-rose-500/20"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Limpar favoritos da conta
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="min-h-[40px] rounded-xl bg-white px-5 py-2 text-xs font-semibold text-[#050507] hover:bg-slate-200"
            >
              Concluir
            </button>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={confirmClearFavs}
        title="Limpar favoritos da conta Google"
        description="Esta ação removerá todos os criadores e publicações salvos na sua conta Google em todos os dispositivos."
        confirmLabel={clearingFavs ? 'Removendo...' : 'Remover todos os favoritos'}
        destructive
        onConfirm={async () => {
          setClearingFavs(true);
          try {
            await onClearFavorites();
            setConfirmClearFavs(false);
            showToast('Favoritos da conta Google removidos.', 'info');
          } catch {
            showToast('Erro ao limpar favoritos.', 'error');
          } finally {
            setClearingFavs(false);
          }
        }}
        onCancel={() => setConfirmClearFavs(false)}
      />
    </>
  );
}
