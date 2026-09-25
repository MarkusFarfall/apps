import { useEffect, useState } from 'react';
import { Download, Share2, Copy, Check } from 'lucide-react';
import type { Ctx } from '../lib/types';
import { makeCard, shareText } from '../lib/share';
import { Sheet } from './ui';
import { buzz } from '../lib/hooks';

export function ShareSheet({ ctx, open, onClose }: { ctx: Ctx; open: boolean; onClose: () => void }) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    let u = '';
    makeCard(ctx).then((b) => {
      setBlob(b);
      u = URL.createObjectURL(b);
      setUrl(u);
    });
    return () => {
      if (u) URL.revokeObjectURL(u);
      setUrl('');
      setBlob(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const text = shareText(ctx);
  const file = blob ? new File([blob], 'dmb.png', { type: 'image/png' }) : null;
  const canShareFile = !!file && !!navigator.canShare?.({ files: [file] });

  const doShare = async () => {
    buzz();
    try {
      if (canShareFile && file) await navigator.share({ files: [file], text });
      else if (navigator.share) await navigator.share({ text, title: 'ДМБ Таймер' });
      else copy();
    } catch {
      /* cancelled */
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      buzz([10, 30, 10]);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };
  const download = () => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `dmb-${new Date().toISOString().slice(0, 10)}.png`;
    a.click();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Поделиться">
      <div className="mx-auto mb-4 aspect-[4/5] w-full max-w-[280px] overflow-hidden rounded-2xl bg-white/5">
        {url ? <img src={url} alt="Карточка" className="h-full w-full object-cover" /> : <div className="shimmer h-full w-full" />}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <button onClick={doShare} className="bg-grad flex flex-col items-center gap-1 rounded-2xl py-3 text-xs font-bold text-black">
          <Share2 size={20} /> Отправить
        </button>
        <button onClick={download} className="flex flex-col items-center gap-1 rounded-2xl bg-white/5 py-3 text-xs font-bold">
          <Download size={20} /> Скачать
        </button>
        <button onClick={copy} className="flex flex-col items-center gap-1 rounded-2xl bg-white/5 py-3 text-xs font-bold">
          {copied ? <Check size={20} className="text-accent" /> : <Copy size={20} />} {copied ? 'Готово' : 'Текст'}
        </button>
      </div>
      <pre className="mt-4 whitespace-pre-wrap rounded-2xl bg-white/5 p-3 font-sans text-xs text-white/60">{text}</pre>
    </Sheet>
  );
}
