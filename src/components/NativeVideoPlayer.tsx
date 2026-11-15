import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { buildMediaProxyUrl } from '../services/pawchiveService';

interface NativeVideoPlayerProps {
  url: string;
  title: string;
  posterUrl?: string | null;
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function NativeVideoPlayer({ url, title, posterUrl }: NativeVideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const singleClickTimer = useRef<number | null>(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [useProxyFallback, setUseProxyFallback] = useState(false);
  const [seekFeedback, setSeekFeedback] = useState<{ label: string; side: 'left' | 'right' | 'center' } | null>(null);

  const activeSrc = useProxyFallback ? buildMediaProxyUrl(url) : url;

  useEffect(() => {
    setUseProxyFallback(false);
    setVideoError(null);
  }, [url]);

  const flashFeedback = (label: string, side: 'left' | 'right' | 'center') => {
    setSeekFeedback({ label, side });
    window.setTimeout(() => {
      setSeekFeedback((cur) => (cur?.label === label && cur?.side === side ? null : cur));
    }, 650);
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  };

  const seekBy = (deltaSeconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    const max = Number.isFinite(video.duration) ? video.duration : Infinity;
    const next = Math.max(0, Math.min(max, video.currentTime + deltaSeconds));
    video.currentTime = next;
    setCurrentTime(next);
    const label = deltaSeconds > 0 ? `+${deltaSeconds}s` : `${deltaSeconds}s`;
    flashFeedback(label, deltaSeconds > 0 ? 'right' : 'left');
  };

  const handleZoneClick = (zone: 'left' | 'center' | 'right') => {
    if (singleClickTimer.current) {
      window.clearTimeout(singleClickTimer.current);
      singleClickTimer.current = null;
      // Double click / double tap detected!
      if (zone === 'left') {
        seekBy(-10);
      } else if (zone === 'right') {
        seekBy(10);
      } else {
        toggleFullscreen();
      }
      return;
    }

    singleClickTimer.current = window.setTimeout(() => {
      singleClickTimer.current = null;
      togglePlay();
    }, 220);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    const nextMuted = !muted;
    video.muted = nextMuted;
    setMuted(nextMuted);
  };

  const handleVolumeChange = (val: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = val;
    video.muted = val === 0;
    setVolume(val);
    setMuted(val === 0);
  };

  const handleCycleRate = () => {
    const video = videoRef.current;
    if (!video) return;
    const rates = [0.5, 1, 1.25, 1.5, 2];
    const next = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
    video.playbackRate = next;
    setPlaybackRate(next);
  };

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const togglePiP = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (video.requestPictureInPicture) {
        await video.requestPictureInPicture();
      }
    } catch {
      // PiP not supported on this browser
    }
  };

  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === ' ' || e.key.toLowerCase() === 'k') {
      e.preventDefault();
      togglePlay();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      seekBy(-1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      seekBy(1);
    } else if (e.key.toLowerCase() === 'j') {
      e.preventDefault();
      seekBy(-10);
    } else if (e.key.toLowerCase() === 'l') {
      e.preventDefault();
      seekBy(10);
    } else if (e.key.toLowerCase() === 'm') {
      e.preventDefault();
      toggleMute();
    } else if (e.key.toLowerCase() === 'f') {
      e.preventDefault();
      toggleFullscreen();
    }
  };

  const progressPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label={`Player de vídeo: ${title}`}
      className="group relative overflow-hidden rounded-2xl border border-white/15 bg-black shadow-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
    >
      <div className="relative aspect-video w-full bg-black">
        <video
          ref={videoRef}
          src={activeSrc}
          poster={posterUrl || undefined}
          playsInline
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={() => {
            if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
          }}
          onLoadedMetadata={() => {
            if (videoRef.current) setDuration(videoRef.current.duration || 0);
          }}
          onError={() => {
            if (!useProxyFallback && activeSrc !== buildMediaProxyUrl(url)) {
              setUseProxyFallback(true);
              return;
            }
            setVideoError('Não foi possível reproduzir este formato no navegador. Utilize o botão de download abaixo.');
          }}
          className="h-full w-full object-contain"
        />

        {/* Interactive Click / Double-Tap Overlay Zones */}
        {!videoError && (
          <div className="absolute inset-0 grid grid-cols-3">
            <button
              type="button"
              aria-label="Pausar ou dar dois cliques para voltar 10 segundos"
              onClick={() => handleZoneClick('left')}
              className="h-full w-full cursor-pointer bg-transparent focus:outline-none"
            />
            <button
              type="button"
              aria-label={playing ? 'Pausar vídeo' : 'Reproduzir vídeo'}
              onClick={() => handleZoneClick('center')}
              className="flex h-full w-full cursor-pointer items-center justify-center bg-transparent focus:outline-none"
            >
              {!playing && (
                <span className="flex h-16 w-16 items-center justify-center rounded-full border border-white/25 bg-black/65 text-white backdrop-blur-xl transition-transform hover:scale-105">
                  <Play className="ml-1 h-7 w-7 fill-white" />
                </span>
              )}
            </button>
            <button
              type="button"
              aria-label="Pausar ou dar dois cliques para avançar 10 segundos"
              onClick={() => handleZoneClick('right')}
              className="h-full w-full cursor-pointer bg-transparent focus:outline-none"
            />
          </div>
        )}

        {/* Animated Seek Feedback Indicator (-10s / +10s / -1s / +1s) */}
        {seekFeedback && (
          <div
            className={`pointer-events-none absolute top-1/2 -translate-y-1/2 rounded-full border border-white/25 bg-black/75 px-4 py-2 font-mono-tabular text-sm font-semibold text-white backdrop-blur-xl ${
              seekFeedback.side === 'left'
                ? 'left-6'
                : seekFeedback.side === 'right'
                  ? 'right-6'
                  : 'left-1/2 -translate-x-1/2'
            }`}
          >
            {seekFeedback.label}
          </div>
        )}

        {videoError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/85 p-6 text-center">
            <AlertCircle className="h-7 w-7 text-rose-400" />
            <p className="max-w-md text-sm text-white">{videoError}</p>
          </div>
        )}
      </div>

      {/* Liquid Glass Controls Bar */}
      <div className="border-t border-white/10 bg-[#08090d]/90 px-3 py-2.5 backdrop-blur-2xl sm:px-4">
        {/* Scrub Seek Slider */}
        <div className="mb-2 flex items-center gap-3">
          <span className="font-mono-tabular text-[11px] text-white/90">
            {formatDuration(currentTime)}
          </span>
          <div className="relative flex flex-1 items-center">
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              aria-label="Linha do tempo do vídeo"
              onChange={(e) => {
                const next = Number(e.target.value);
                if (videoRef.current) videoRef.current.currentTime = next;
                setCurrentTime(next);
              }}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-sky-400"
              style={{
                background: `linear-gradient(to right, #38bdf8 ${progressPct}%, rgba(255,255,255,0.16) ${progressPct}%)`,
              }}
            />
          </div>
          <span className="font-mono-tabular text-[11px] text-slate-300">
            {formatDuration(duration)}
          </span>
        </div>

        {/* Transport & Precision Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
            <button
              type="button"
              onClick={togglePlay}
              aria-label={playing ? 'Pausar' : 'Reproduzir'}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white text-black transition-colors hover:bg-slate-200"
            >
              {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
            </button>

            <button
              type="button"
              onClick={() => seekBy(-10)}
              title="Voltar 10 segundos (ou clique duplo à esquerda)"
              className="inline-flex h-9 items-center gap-1 rounded-xl border border-white/10 bg-white/[0.06] px-2.5 font-mono-tabular text-xs font-medium text-white hover:bg-white/15"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              -10s
            </button>

            <button
              type="button"
              onClick={() => seekBy(-1)}
              title="Voltar 1 segundo"
              className="inline-flex h-9 items-center rounded-xl border border-white/10 bg-white/[0.06] px-2.5 font-mono-tabular text-xs font-medium text-white hover:bg-white/15"
            >
              -1s
            </button>

            <button
              type="button"
              onClick={() => seekBy(1)}
              title="Avançar 1 segundo"
              className="inline-flex h-9 items-center rounded-xl border border-white/10 bg-white/[0.06] px-2.5 font-mono-tabular text-xs font-medium text-white hover:bg-white/15"
            >
              +1s
            </button>

            <button
              type="button"
              onClick={() => seekBy(10)}
              title="Avançar 10 segundos (ou clique duplo à direita)"
              className="inline-flex h-9 items-center gap-1 rounded-xl border border-white/10 bg-white/[0.06] px-2.5 font-mono-tabular text-xs font-medium text-white hover:bg-white/15"
            >
              +10s
              <RotateCw className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? 'Ativar som' : 'Silenciar'}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-white hover:bg-white/15"
            >
              {muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>

            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              aria-label="Volume"
              onChange={(e) => handleVolumeChange(Number(e.target.value))}
              className="hidden sm:block h-1 w-16 cursor-pointer appearance-none rounded-full bg-white/20 accent-white"
            />

            <button
              type="button"
              onClick={handleCycleRate}
              title="Velocidade de reprodução"
              className="inline-flex h-9 items-center rounded-xl border border-white/10 bg-white/[0.05] px-2.5 font-mono-tabular text-xs font-medium text-white hover:bg-white/15"
            >
              {playbackRate}x
            </button>

            <button
              type="button"
              onClick={togglePiP}
              aria-label="Picture-in-Picture"
              className="hidden sm:inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-white hover:bg-white/15"
            >
              <PictureInPicture2 className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label="Tela cheia"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-white hover:bg-white/15"
            >
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
