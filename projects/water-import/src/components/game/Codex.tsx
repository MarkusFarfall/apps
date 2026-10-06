'use client';

import { useEffect, useMemo, useState } from 'react';
import { FishIcon } from './FishIcon';
import { Aquarium } from './Aquarium';
import {
  BAIT_NAMES,
  FISH,
  LOC_NAMES,
  LOC_ORDER,
  RARITY_INFO,
  RARITY_ORDER,
  SEASON_NAMES,
  SHAPE_NAMES,
  TIME_NAMES,
  VARIANT_INFO,
  WEATHER_NAMES,
} from '@/game/codexData';
import type { CodexEntry, FishDef, LocId, Rarity, Variant } from '@/game/types';

const fmtW = (w: number) => (w < 1 ? `${Math.round(w * 1000)} г` : `${w.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} кг`);
const fmtRange = ([a, b]: [number, number]) => `${fmtW(a)} — ${fmtW(b)}`;
const VARIANTS: (Variant | null)[] = [null, 'albino', 'golden', 'melanist', 'scarred', 'trophy'];

/**
 * Кодекс рыб.
 *
 *  codex   — SaveData.codex игрока. Без него кодекс открыт целиком (режим просмотра).
 *            С ним: непойманные виды — силуэты «???», у пойманных — улов, рекорд, день
 *            первой поимки и пойманные варианты окраски.
 *  onClose — кнопка «Назад» и Esc. Без него кнопки нет (кодекс как отдельная страница).
 */
export function Codex({ codex, onClose }: { codex?: Record<string, CodexEntry>; onClose?: () => void }) {
  const [loc, setLoc] = useState<LocId | 'all'>('all');
  const [rarity, setRarity] = useState<Rarity | 'all'>('all');
  const [query, setQuery] = useState('');
  const [hover, setHover] = useState<string | null>(null);

  const known = (f: FishDef) => !codex || !!codex[f.id];
  const sorted = useMemo(
    () => [...FISH].sort((a, b) => LOC_ORDER.indexOf(a.loc[0]) - LOC_ORDER.indexOf(b.loc[0]) || RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity)),
    [],
  );
  const [selId, setSelId] = useState<string>(() => (sorted.find((f) => !codex || codex[f.id]) ?? sorted[0]).id);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sorted.filter((f) => {
      if (loc !== 'all' && !f.loc.includes(loc)) return false;
      if (rarity !== 'all' && f.rarity !== rarity) return false;
      if (!q) return true;
      // непойманных ищем только по акватории — чтобы поиск не раскрывал названия
      return codex && !codex[f.id] ? false : f.name.toLowerCase().includes(q) || f.latin.toLowerCase().includes(q);
    });
  }, [sorted, loc, rarity, query, codex]);

  const sel = FISH.find((f) => f.id === selId) ?? sorted[0];
  const knownCount = codex ? FISH.filter((f) => codex[f.id]).length : FISH.length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'Escape') onClose?.();
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const i = list.findIndex((f) => f.id === selId);
        const n = list[(i + (e.key === 'ArrowRight' ? 1 : -1) + list.length) % list.length];
        if (n) setSelId(n.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [list, selId, onClose]);

  return (
    <div className="zv-codex fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#050b12] text-[var(--color-ink)]">
      {/* шапка */}
      <header className="flex flex-wrap items-center gap-3 border-b border-[var(--line)] px-4 py-3 min-[820px]:px-6">
        {onClose && (
          <button onClick={onClose} className="btn btn-quiet btn-sm">
            ← Назад
          </button>
        )}
        <div className="mr-auto">
          <p className="label-brass">Кодекс рыб</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="num text-[11px] dim">
              Открыто {knownCount} из {FISH.length}
            </span>
            {codex && (
              <span className="h-[3px] w-24 overflow-hidden rounded-full bg-[var(--line)]">
                <span className="block h-full bg-[var(--brass)]" style={{ width: `${(knownCount / FISH.length) * 100}%` }} />
              </span>
            )}
          </div>
        </div>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Название или латынь…" className="field !h-9 !w-[220px] !text-[13px]" />
      </header>

      {/* фильтры */}
      <div className="flex flex-col gap-2 border-b border-[var(--line)] px-4 py-2.5 min-[820px]:px-6">
        <div className="zv-scroll-x flex gap-1.5 overflow-x-auto pb-0.5">
          <Chip on={loc === 'all'} onClick={() => setLoc('all')}>
            Все акватории
          </Chip>
          {LOC_ORDER.map((l) => (
            <Chip key={l} on={loc === l} onClick={() => setLoc(l)}>
              {LOC_NAMES[l]}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Chip on={rarity === 'all'} onClick={() => setRarity('all')}>
            Любая редкость
          </Chip>
          {RARITY_ORDER.map((r) => (
            <Chip key={r} on={rarity === r} onClick={() => setRarity(r)} color={RARITY_INFO[r].color}>
              {RARITY_INFO[r].name}
            </Chip>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* сетка */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 min-[820px]:p-5">
          {list.length === 0 && <p className="py-16 text-center text-sm dim">Ничего не нашлось. Попробуйте другую акваторию.</p>}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5">
            {list.map((f) => {
              const k = known(f);
              const on = f.id === sel.id;
              const entry = codex?.[f.id];
              return (
                <button
                  key={f.id}
                  onClick={() => setSelId(f.id)}
                  onMouseEnter={() => setHover(f.id)}
                  onMouseLeave={() => setHover(null)}
                  className={`zv-fish-card cell cell-hover group relative flex flex-col items-center overflow-hidden px-2 pb-2.5 pt-3 text-center ${on ? '!border-[var(--brass)]' : ''}`}
                  style={{ ['--rar' as string]: RARITY_INFO[f.rarity].color }}
                >
                  <span className="absolute inset-x-0 top-0 h-[2px]" style={{ background: RARITY_INFO[f.rarity].color, opacity: k ? 0.8 : 0.25 }} />
                  {f.glow && k && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full" style={{ background: f.glow, boxShadow: `0 0 8px ${f.glow}` }} title="Светится" />}
                  {entry && <span className="num absolute left-2 top-1.5 text-[9.5px] dim">×{entry.count}</span>}
                  <FishIcon fish={f} size={132} height={78} known={k} animate={k && hover === f.id} />
                  <p className={`mt-1.5 line-clamp-1 text-[12.5px] ${k ? 'text-[#ece6d8]' : 'dim'}`}>{k ? f.name : '???'}</p>
                  <p className="line-clamp-1 text-[10px] italic dim">{k ? f.latin : LOC_NAMES[f.loc[0]]}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* карточка вида — десктоп */}
        <aside className="hidden w-[440px] shrink-0 border-l border-[var(--line)] min-[980px]:block">
          <FishCard key={sel.id} fish={sel} known={known(sel)} entry={codex?.[sel.id]} />
        </aside>
      </div>

      {/* карточка вида — телефон */}
      <MobileCard fish={sel} known={known(sel)} entry={codex?.[sel.id]} />
    </div>
  );
}

function MobileCard({ fish, known, entry }: { fish: FishDef; known: boolean; entry?: CodexEntry }) {
  const [open, setOpen] = useState(false);
  const [lastId, setLastId] = useState(fish.id);
  if (fish.id !== lastId) {
    setLastId(fish.id);
    setOpen(true);
  }
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[rgba(3,8,14,0.6)] backdrop-blur-sm min-[980px]:hidden" onClick={() => setOpen(false)}>
      <div className="sheet zv-sheet-up mt-auto max-h-[88dvh] overflow-hidden rounded-t-[14px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-end px-3 pt-2">
          <button onClick={() => setOpen(false)} className="dim px-2 text-xl hover:text-white" aria-label="Закрыть">
            ×
          </button>
        </div>
        <FishCard key={fish.id} fish={fish} known={known} entry={entry} />
      </div>
    </div>
  );
}

function FishCard({ fish: f, known, entry }: { fish: FishDef; known: boolean; entry?: CodexEntry }) {
  const [variant, setVariant] = useState<Variant | null>(null);
  const [depth, setDepth] = useState(0.35);
  const [animate, setAnimate] = useState(true);
  const rar = RARITY_INFO[f.rarity];
  const meters = Math.round(f.depth[0] + (f.depth[1] - f.depth[0]) * depth);
  const mult = variant ? VARIANT_INFO[variant].mult : 1;

  return (
    <div className="flex h-full max-h-[inherit] flex-col overflow-y-auto overscroll-contain">
      <div className="relative">
        <Aquarium fish={f} variant={variant} silhouette={!known} depth={depth} animate={animate} className="h-[250px] w-full" />
        <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2">
          <span className="rounded-[2px] border px-1.5 py-0.5 text-[9.5px] uppercase tracking-[0.18em] backdrop-blur" style={{ color: rar.color, borderColor: `${rar.color}66`, background: 'rgba(5,11,18,0.5)' }}>
            {rar.name}
          </span>
          {f.glow && known && (
            <span className="rounded-[2px] border border-[var(--line-2)] bg-[rgba(5,11,18,0.5)] px-1.5 py-0.5 text-[9.5px] uppercase tracking-[0.18em] backdrop-blur" style={{ color: f.glow }}>
              Светится
            </span>
          )}
        </div>
        <div className="num pointer-events-none absolute bottom-2 right-3 text-[10.5px] text-[rgba(230,240,245,0.7)]">{meters} м</div>
      </div>

      <div className="space-y-4 px-5 py-4">
        <div>
          <h2 className="font-serif text-[28px] leading-tight text-[#f1ead9]">{known ? f.name : 'Неизвестный вид'}</h2>
          <p className="text-[13px] italic muted">{known ? f.latin : 'Поймайте, чтобы узнать'}</p>
        </div>

        {known && entry && (
          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-[2px] border border-[var(--line)] bg-[var(--line)] text-center">
            <Stat label="Поймано">{entry.count}</Stat>
            <Stat label="Рекорд">{fmtW(entry.maxWeight)}</Stat>
            <Stat label="Впервые">день {entry.firstDay}</Stat>
          </div>
        )}

        {known && (
          <>
            <div>
              <span className="label mb-1.5 block">Вариант окраски</span>
              <div className="flex flex-wrap gap-1.5">
                {VARIANTS.map((v) => {
                  const caught = !entry || v === null || entry.variants.includes(v);
                  return (
                    <button
                      key={v ?? 'base'}
                      onClick={() => setVariant(v)}
                      disabled={!caught}
                      title={caught ? undefined : 'Ещё не поймана'}
                      className={`cell cell-hover px-2 py-1 text-[11px] disabled:cursor-not-allowed disabled:opacity-35 ${variant === v ? '!border-[var(--brass)] text-[var(--brass-2)]' : 'muted'}`}
                    >
                      {v ? VARIANT_INFO[v].name : 'Обычная'}
                      {v && <span className="num ml-1 dim">×{VARIANT_INFO[v].mult}</span>}
                      {v && entry && caught && <span className="ml-1 text-[var(--color-ok)]">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="label">Глубина обзора</span>
                <button onClick={() => setAnimate((a) => !a)} className="text-[11px] text-[var(--brass-2)] underline-offset-4 hover:underline">
                  {animate ? 'Пауза' : 'Плыть'}
                </button>
              </div>
              <input type="range" min={0} max={1} step={0.01} value={depth} onChange={(e) => setDepth(Number(e.target.value))} className="depth-range w-full" aria-label="Глубина обзора" />
              <div className="num mt-1 flex justify-between text-[10px] dim">
                <span>{f.depth[0]} м</span>
                <span>{f.depth[1]} м</span>
              </div>
            </div>

            <p className="text-[13.5px] leading-relaxed text-[#d8d2c4]">{f.desc}</p>

            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[2px] border border-[var(--line)] bg-[var(--line)] text-[12px]">
              <Fact label="Акватории" wide>
                {f.loc.map((l) => LOC_NAMES[l]).join(', ')}
              </Fact>
              <Fact label="Глубина">
                {f.depth[0]}–{f.depth[1]} м
              </Fact>
              <Fact label="Вес">{fmtRange(f.weight)}</Fact>
              <Fact label="Цена">
                <span className="num">
                  {Math.round(rar.base * mult)} ₽ + {Math.round(f.price * mult).toLocaleString('ru-RU')} ₽/кг
                </span>
              </Fact>
              <Fact label="Сила">
                <span className="flex items-center gap-[2px]" title={`${f.strength} из 10`}>
                  {Array.from({ length: 10 }, (_, i) => (
                    <span key={i} className="h-2 w-[6px] rounded-[1px]" style={{ background: i < f.strength ? 'var(--brass)' : 'var(--line-2)' }} />
                  ))}
                </span>
              </Fact>
              <Fact label="Время">{TIME_NAMES[f.time]}</Fact>
              <Fact label="Погода">{f.weather ? f.weather.map((w) => WEATHER_NAMES[w]).join(', ') : 'Любая'}</Fact>
              <Fact label="Сезон">{f.season ? f.season.map((s) => SEASON_NAMES[s]).join(', ') : 'Круглый год'}</Fact>
              <Fact label="Луна">{f.moon === 'full' ? 'Полнолуние' : f.moon === 'new' ? 'Новолуние' : 'Любая'}</Fact>
              <Fact label="Наживка" wide>
                {f.bait ? f.bait.map((b) => BAIT_NAMES[b]).join(', ') : '—'}
              </Fact>
              <Fact label="Форма тела">{SHAPE_NAMES[f.shape]}</Fact>
            </dl>
          </>
        )}
        {!known && (
          <p className="cell px-3 py-3 text-[12.5px] leading-relaxed muted">
            Обитает: {LOC_NAMES[f.loc[0]]}, {f.depth[0]}–{f.depth[1]} м. {TIME_NAMES[f.time]}.
          </p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#08111b] px-2 py-2">
      <p className="text-[9.5px] uppercase tracking-[0.18em] dim">{label}</p>
      <p className="num mt-0.5 font-serif text-[17px] text-[var(--brass-2)]">{children}</p>
    </div>
  );
}

function Fact({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`bg-[#08111b] px-3 py-2 ${wide ? 'col-span-2' : ''}`}>
      <dt className="text-[9.5px] uppercase tracking-[0.18em] dim">{label}</dt>
      <dd className="mt-0.5 text-[#e6e0d2]">{children}</dd>
    </div>
  );
}

function Chip({ on, onClick, children, color }: { on: boolean; onClick: () => void; children: React.ReactNode; color?: string }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-[2px] border px-2.5 py-1 text-[11px] transition-colors ${on ? 'border-[var(--brass)] bg-[var(--brass-soft)] text-[var(--brass-2)]' : 'border-[var(--line)] text-[var(--muted)] hover:border-[var(--line-2)] hover:text-white'}`}
    >
      {color && <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: color }} />}
      {children}
    </button>
  );
}
