import { useState, type FormEvent } from 'react';
import { AlertCircle, CheckCircle2, Lock, ShieldCheck, UploadCloud, X } from 'lucide-react';
import { clearClientCache, pawchiveService } from '../services/pawchiveService';
import { ConfirmModal } from './ConfirmModal';
import { useToast } from '../hooks/useToast';

interface ImporterModalProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

const PLATFORMS = [
  { id: 'patreon', label: 'Patreon', hint: 'Informe a chave de sessão autorizada (session_id).' },
  { id: 'fanbox', label: 'Pixiv Fanbox', hint: 'Informe FANBOXSESSID e o Device ID (p_ab_d_id).' },
  { id: 'discord', label: 'Discord', hint: 'Informe o token autorizado para leitura do servidor.' },
  { id: 'fansly', label: 'Fansly', hint: 'Informe o token de sessão codificado em Base64.' },
  { id: 'onlyfans', label: 'OnlyFans', hint: 'Informe sess, auth_id, x-bc e User-Agent.' },
  { id: 'candfans', label: 'CandFans', hint: 'Informe secure_candfans_session autorizado.' },
];

export function ImporterModal({ open, onClose, onImported }: ImporterModalProps) {
  const { showToast } = useToast();
  const [service, setService] = useState('patreon');
  const [sessionKey, setSessionKey] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [authId, setAuthId] = useState('');
  const [xBc, setXBc] = useState('');
  const [userAgent, setUserAgent] = useState('');

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [progressStep, setProgressStep] = useState<0 | 1 | 2 | 3>(0);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  if (!open) return null;

  const activePlatform = PLATFORMS.find((p) => p.id === service) || PLATFORMS[0];

  const handleRequestConfirm = (e: FormEvent) => {
    e.preventDefault();
    if (!sessionKey.trim()) {
      showToast('Informe a chave/token de autorização.', 'error');
      return;
    }
    setResult(null);
    setConfirmOpen(true);
  };

  const handleExecuteImport = async () => {
    setConfirmOpen(false);
    setSubmitting(true);
    setProgressStep(1);
    setResult(null);

    try {
      setProgressStep(2);
      const resp = await pawchiveService.submitImport({
        service,
        session_key: sessionKey.trim(),
        device_id: service === 'fanbox' ? deviceId.trim() : undefined,
        auth_id: service === 'onlyfans' ? authId.trim() : undefined,
        x_bc: service === 'onlyfans' ? xBc.trim() : undefined,
        user_agent: service === 'onlyfans' ? userAgent.trim() : undefined,
      });

      setProgressStep(3);
      setResult({ ok: true, message: resp.message });
      setSessionKey('');
      setDeviceId('');
      clearClientCache();
      onImported();
      showToast('Importação autorizada enviada com sucesso!', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar importação.';
      setResult({ ok: false, message: msg });
      showToast(msg, 'error');
      setProgressStep(0);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
        role="dialog"
        aria-modal="true"
        aria-labelledby="importer-modal-title"
        onClick={onClose}
      >
        <div
          className="liquid-glass max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4 border-b border-white/[0.08] pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-400/25 bg-sky-400/10 text-sky-300">
                <UploadCloud className="h-5 w-5" />
              </div>
              <div>
                <h2 id="importer-modal-title" className="font-display text-lg font-semibold text-white">
                  Importação Autorizada
                </h2>
                <p className="text-xs text-slate-400">
                  Operação direta via endpoint oficial <code className="font-mono-tabular">/api/v1/importer/submit</code>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar importação"
              className="rounded-xl p-2 text-slate-400 hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleRequestConfirm} className="mt-5 space-y-4">
            <div>
              <label htmlFor="importer-platform" className="block text-xs font-medium text-slate-300">
                Plataforma compatível
              </label>
              <select
                id="importer-platform"
                value={service}
                onChange={(e) => {
                  setService(e.target.value);
                  setResult(null);
                  setProgressStep(0);
                }}
                className="mt-1.5 min-h-[44px] w-full rounded-xl border border-white/10 bg-[#050507]/85 px-3.5 text-sm text-white focus:border-sky-400/50 focus:outline-none"
              >
                {PLATFORMS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-slate-400">{activePlatform.hint}</p>
            </div>

            <div>
              <label htmlFor="importer-key" className="block text-xs font-medium text-slate-300">
                Token / Chave de autorização (session_key)
              </label>
              <input
                id="importer-key"
                type="password"
                autoComplete="off"
                required
                value={sessionKey}
                onChange={(e) => setSessionKey(e.target.value)}
                placeholder="Cole a chave de autorização da plataforma selecionada"
                className="mt-1.5 min-h-[44px] w-full rounded-xl border border-white/10 bg-[#050507]/80 px-3.5 font-mono-tabular text-sm text-white placeholder:text-slate-600 focus:border-sky-400/50 focus:outline-none"
              />
            </div>

            {service === 'fanbox' && (
              <div>
                <label htmlFor="importer-device-id" className="block text-xs font-medium text-slate-300">
                  Device ID (p_ab_d_id)
                </label>
                <input
                  id="importer-device-id"
                  type="text"
                  autoComplete="off"
                  required
                  pattern="[0-9]{8,10}"
                  value={deviceId}
                  onChange={(e) => setDeviceId(e.target.value)}
                  placeholder="Ex.: 1234567890"
                  className="mt-1.5 min-h-[44px] w-full rounded-xl border border-white/10 bg-[#050507]/80 px-3.5 font-mono-tabular text-sm text-white placeholder:text-slate-600 focus:border-sky-400/50 focus:outline-none"
                />
              </div>
            )}

            {service === 'onlyfans' && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="of-auth-id" className="block text-xs font-medium text-slate-300">
                    User ID (auth_id)
                  </label>
                  <input
                    id="of-auth-id"
                    type="text"
                    required
                    value={authId}
                    onChange={(e) => setAuthId(e.target.value)}
                    className="mt-1.5 min-h-[42px] w-full rounded-xl border border-white/10 bg-[#050507]/80 px-3.5 text-sm text-white"
                  />
                </div>
                <div>
                  <label htmlFor="of-xbc" className="block text-xs font-medium text-slate-300">
                    BC Token (x-bc)
                  </label>
                  <input
                    id="of-xbc"
                    type="text"
                    required
                    value={xBc}
                    onChange={(e) => setXBc(e.target.value)}
                    className="mt-1.5 min-h-[42px] w-full rounded-xl border border-white/10 bg-[#050507]/80 px-3.5 text-sm text-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="of-ua" className="block text-xs font-medium text-slate-300">
                    User-Agent
                  </label>
                  <input
                    id="of-ua"
                    type="text"
                    required
                    value={userAgent}
                    onChange={(e) => setUserAgent(e.target.value)}
                    className="mt-1.5 min-h-[42px] w-full rounded-xl border border-white/10 bg-[#050507]/80 px-3.5 text-sm text-white"
                  />
                </div>
              </div>
            )}

            {/* Security Guarantee */}
            <div className="flex items-start gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5 text-xs text-slate-300">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
              <p className="leading-relaxed">
                O token é transmitido exclusivamente pelo backend seguro SpaceX via HTTPS e nunca é gravado em
                <code className="mx-1 font-mono-tabular text-slate-200">localStorage</code> ou histórico do navegador.
              </p>
            </div>

            {/* Real Progress Steps */}
            {(submitting || progressStep > 0) && (
              <div className="space-y-2 rounded-xl border border-white/[0.08] bg-black/30 p-3.5">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span>
                    {progressStep === 1 && '1/3 Validando parâmetros...'}
                    {progressStep === 2 && '2/3 Enviando solicitação à API Pawchive...'}
                    {progressStep === 3 && '3/3 Importação aceita e catálogo atualizado'}
                  </span>
                  <span className="font-mono-tabular text-sky-300">
                    {progressStep === 1 ? '33%' : progressStep === 2 ? '68%' : '100%'}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-sky-400 transition-all duration-300"
                    style={{ width: progressStep === 1 ? '33%' : progressStep === 2 ? '68%' : '100%' }}
                  />
                </div>
              </div>
            )}

            {result && (
              <div
                className={`flex items-start gap-2.5 rounded-xl border p-3.5 text-xs ${
                  result.ok
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                    : 'border-rose-500/30 bg-rose-500/10 text-rose-200'
                }`}
              >
                {result.ok ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                ) : (
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                )}
                <p className="leading-relaxed">{result.message}</p>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 border-t border-white/[0.08] pt-4">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[42px] rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"
              >
                Fechar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-white px-5 py-2 text-xs font-semibold text-[#050507] transition-colors hover:bg-slate-200 disabled:opacity-50"
              >
                <Lock className="h-3.5 w-3.5" />
                {submitting ? 'Enviando...' : 'Iniciar importação'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <ConfirmModal
        open={confirmOpen}
        title="Confirmar importação autorizada"
        description={`Deseja enviar a solicitação de importação para a plataforma ${activePlatform.label} através do endpoint oficial?`}
        confirmLabel="Enviar autorização"
        onConfirm={handleExecuteImport}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
