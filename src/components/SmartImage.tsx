import { useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';

interface SmartImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  fallbackLabel?: string;
  blur?: boolean;
  isAvatar?: boolean;
}

export function SmartImage({
  src,
  alt,
  className = '',
  fallbackLabel,
  blur = false,
  isAvatar = false,
}: SmartImageProps) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (!src || failed) {
    const initials = (fallbackLabel || alt || 'SX')
      .trim()
      .slice(0, 2)
      .toUpperCase();

    return (
      <div
        aria-label={alt}
        className={`relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-[#12151d] via-[#0a0c10] to-[#050507] text-slate-300 ${className}`}
      >
        <div
          className="absolute inset-0 opacity-30 bg-cover bg-center"
          style={{ backgroundImage: 'url(/src/assets/images/spacex_emblem_surface_1794747749314.jpg)' }}
        />
        {isAvatar ? (
          <span className="relative z-10 font-display text-sm font-semibold tracking-wider text-white/85">
            {initials}
          </span>
        ) : (
          <div className="relative z-10 flex flex-col items-center gap-2 px-3 text-center">
            <ImageIcon className="h-5 w-5 text-slate-400" />
            {fallbackLabel && (
              <span className="line-clamp-1 max-w-[160px] text-xs font-medium text-slate-400">{fallbackLabel}</span>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-[#0a0b0f] ${className}`}>
      {!loaded && <div className="skeleton-glass absolute inset-0" />}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={`h-full w-full object-cover transition-all duration-300 ${
          loaded ? 'opacity-100' : 'opacity-0'
        } ${blur ? 'scale-105 blur-xl brightness-75 hover:blur-md' : ''}`}
      />
    </div>
  );
}
