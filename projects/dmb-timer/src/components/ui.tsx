import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '../utils/cn';

export function Card({ children, className, onClick, delay = 0 }: { children: ReactNode; className?: string; onClick?: () => void; delay?: number }) {
  return (
    <div
      onClick={onClick}
      style={{ animationDelay: `${delay}ms` }}
      className={cn('glass pop-in rounded-3xl p-5', onClick && 'cursor-pointer active:scale-[0.985] transition-transform', className)}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/50">{children}</h3>
      {right}
    </div>
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', k);
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="fade absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="sheet-up relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[2rem] border border-white/10 bg-[var(--card)] p-5 pb-8 shadow-2xl sm:rounded-[2rem] safe-bottom">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/15 sm:hidden" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-white/5 hover:bg-white/10">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ProgressRing({ pct, children, size = 300, stroke = 16 }: { pct: number; children?: ReactNode; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2 - 6;
  const c = 2 * Math.PI * r;
  const inner = r - stroke - 2;
  const ic = 2 * Math.PI * inner;
  const ang = pct * Math.PI * 2 - Math.PI / 2;
  const kx = size / 2 + r * Math.cos(ang);
  const ky = size / 2 + r * Math.sin(ang);
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[320px]">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full">
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--accent)" />
            <stop offset="100%" stopColor="var(--accent2)" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={inner}
          fill="none"
          stroke="rgba(255,255,255,.14)"
          strokeWidth={6}
          strokeDasharray={`1.2 ${ic / 100 - 1.2}`}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={inner}
          fill="none"
          stroke="var(--accent)"
          strokeOpacity={0.9}
          strokeWidth={6}
          strokeDasharray={`1.2 ${ic / 100 - 1.2}`}
          style={{ clipPath: 'none' }}
          strokeDashoffset={0}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          mask="url(#tickMask)"
        />
        <mask id="tickMask">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={inner}
            fill="none"
            stroke="white"
            strokeWidth={8}
            strokeDasharray={`${ic * pct} ${ic}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </mask>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#ringGrad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.max(0.002, pct))}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 1s linear', filter: 'drop-shadow(0 0 10px color-mix(in oklab, var(--accent) 60%, transparent))' }}
        />
        <circle cx={kx} cy={ky} r={stroke / 2 + 3} fill="#fff" style={{ filter: 'drop-shadow(0 0 8px var(--accent))' }} />
        <circle cx={kx} cy={ky} r={stroke / 2 - 3} fill="var(--accent)" />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

export function Pogon({ stripes, gold, className }: { stripes: number; gold?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 60 110" className={className}>
      <path
        d="M6 26 L30 4 L54 26 V104 Q54 108 50 108 H10 Q6 108 6 104 Z"
        style={{ fill: 'color-mix(in oklab, var(--accent) 22%, #0b0b0b)', stroke: 'var(--accent)', strokeOpacity: 0.6 }}
        strokeWidth="2"
      />
      <circle cx="30" cy="22" r="4.5" style={{ fill: 'var(--accent2)' }} />
      {gold ? (
        <>
          <rect x="8" y="36" width="44" height="66" style={{ fill: 'var(--accent2)', opacity: 0.9 }} />
          <path d="M30 52l5 10 11 1.6-8 7.8 2 11L30 77l-10 5.4 2-11-8-7.8 11-1.6z" style={{ fill: '#111' }} />
        </>
      ) : (
        Array.from({ length: stripes }).map((_, i) => (
          <rect key={i} x="8" y={92 - i * 12} width="44" height="7" rx="1" style={{ fill: 'var(--accent2)' }} />
        ))
      )}
    </svg>
  );
}

export function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button onClick={() => onChange(!on)} className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white/5 px-4 py-3 text-left">
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        {hint && <span className="block text-xs text-white/45">{hint}</span>}
      </span>
      <span className={cn('relative h-7 w-12 shrink-0 rounded-full transition-colors', on ? 'bg-accent' : 'bg-white/15')}>
        <span className={cn('absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all', on ? 'left-6' : 'left-1')} />
      </span>
    </button>
  );
}
