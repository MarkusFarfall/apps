import { useEffect, useState } from 'react';

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BIPEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function drawIcon(size: number) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d')!;
  const s = size / 512;
  x.fillStyle = '#0d100a';
  x.beginPath();
  x.roundRect(0, 0, size, size, 112 * s);
  x.fill();
  const g = x.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, '#b5c96a');
  g.addColorStop(1, '#e0bf6e');
  x.lineWidth = 34 * s;
  x.strokeStyle = 'rgba(255,255,255,.08)';
  x.beginPath();
  x.arc(256 * s, 256 * s, 178 * s, 0, Math.PI * 2);
  x.stroke();
  x.strokeStyle = g;
  x.lineCap = 'round';
  x.beginPath();
  x.arc(256 * s, 256 * s, 178 * s, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * 0.73);
  x.stroke();
  x.fillStyle = g;
  x.font = `900 ${150 * s}px Arial Black, Arial, sans-serif`;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText('★', 256 * s, 210 * s);
  x.fillStyle = '#eef0e8';
  x.font = `900 ${76 * s}px Arial Black, Arial, sans-serif`;
  x.fillText('ДМБ', 256 * s, 346 * s);
  return c.toDataURL('image/png');
}

async function ensureManifest() {
  const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  let ok = false;
  try {
    const r = await fetch('./manifest.webmanifest', { cache: 'no-store' });
    if (r.ok) {
      await r.clone().json();
      ok = true;
    }
  } catch {
    ok = false;
  }
  if (ok) return;
  const base = location.href.split('#')[0].split('?')[0];
  const manifest = {
    name: 'ДМБ Таймер',
    short_name: 'ДМБ',
    start_url: base,
    scope: base.replace(/[^/]*$/, ''),
    display: 'standalone',
    background_color: '#0d100a',
    theme_color: '#0d100a',
    icons: [
      { src: drawIcon(192), sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: drawIcon(512), sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  };
  const href = 'data:application/manifest+json;charset=utf-8,' + encodeURIComponent(JSON.stringify(manifest));
  if (link) link.href = href;
  else {
    const l = document.createElement('link');
    l.rel = 'manifest';
    l.href = href;
    document.head.appendChild(l);
  }
}

export function setupPWA() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BIPEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
  try {
    const apple = document.getElementById('apple-icon') as HTMLLinkElement | null;
    if (apple) apple.href = drawIcon(180);
  } catch {
    /* ignore */
  }
  ensureManifest();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }
}

export function useInstall() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return {
    canInstall: !!deferred,
    standalone,
    ios,
    install: async () => {
      if (!deferred) return false;
      await deferred.prompt();
      const res = await deferred.userChoice;
      deferred = null;
      notify();
      return res.outcome === 'accepted';
    },
  };
}
