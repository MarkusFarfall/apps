"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { gearList, isJumper, type Engine, type Trip } from "@/game/engine";
import type { GearKind } from "@/game/world";
import { availableNow, conditionsNow, fishNotes } from "@/game/lore";
import { FISH, FISH_BY_ID, RARITY_INFO, VARIANT_INFO } from "@/game/fish";
import type { FishDef, LocId, PortId } from "@/game/types";
import { BAITS, BAIT_BY_ID, BOATS, BOAT_CLASS_NAMES, LOC_POS, PORTS, PORT_BY_ID, LINES, LOCATIONS, LOC_BY_ID, MILESTONES, REELS, RODS, SONARS, WEATHER_INFO, spotsOf } from "@/game/world";
import { FishIcon } from "./FishIcon";
import { BaitIcon, GearIcon, Icon, MiscIcon, WEATHER_ICON } from "./Icons";

export const fmt = (n: number) => Math.round(n).toLocaleString("ru-RU");
export const fmtW = (w: number) => (w < 1 ? `${Math.round(w * 1000)} г` : `${w.toFixed(w < 10 ? 2 : 1)} кг`);
const LEN_K: Record<string, number> = { fusiform: 0.011, deep: 0.024, flat: 0.02, eel: 0.0016, long: 0.0032, billfish: 0.006, shark: 0.008, angler: 0.03, ray: 0.04, squid: 0.004, blob: 0.04, puffer: 0.05 };
export const fishLength = (f: FishDef, w: number) => Math.cbrt((w * 1000) / (LEN_K[f.shape] ?? 0.011));
const fmtLen = (cm: number) => (cm >= 100 ? `${(cm / 100).toFixed(2)} м` : `${Math.round(cm)} см`);

/** `above` поднимает окно выше титульной заставки (z-50) — нужно панелям, доступным до начала игры. */
export function Modal({ label, title, onClose, children, tabs, right, wide = true, above = false }: { label?: string; title: string; onClose: () => void; children: ReactNode; tabs?: ReactNode; right?: ReactNode; wide?: boolean; above?: boolean }) {
  return (
    <div className={`fade-in absolute inset-0 ${above ? "z-[60]" : "z-40"} flex items-stretch justify-center bg-[#02050a]/72 backdrop-blur-[3px] sm:items-center sm:p-3`} onPointerDown={(e) => e.stopPropagation()}>
      <div className={`sheet reveal safe-pad flex h-full max-h-[100dvh] w-full flex-col overflow-hidden !rounded-none sm:h-auto sm:max-h-[94vh] sm:!rounded-[3px] ${wide ? "max-w-[1180px]" : "max-w-3xl"}`}>
        <div className="flex shrink-0 items-end justify-between gap-4 px-4 pt-4 sm:px-7 sm:pt-6">
          <div>
            {label && <div className="label-brass">{label}</div>}
            <h2 className="font-serif mt-1 truncate text-[26px] font-medium leading-none text-[#f1ebdd] sm:text-[34px]">{title}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-3 sm:gap-5">
            {right}
            <button onClick={onClose} className="iconbtn" aria-label="Закрыть"><Icon name="close" size={16} /></button>
          </div>
        </div>
        {tabs && <div className="no-scrollbar mt-3 flex shrink-0 gap-5 overflow-x-auto border-b border-[var(--line)] px-4 sm:mt-4 sm:gap-6 sm:px-7">{tabs}</div>}
        {!tabs && <div className="rule mx-4 mt-4 shrink-0 sm:mx-7 sm:mt-5" />}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>
  );
}

function Row({ k, v, strong }: { k: string; v: ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[var(--line)] py-1.5">
      <dt className="text-[12px] muted">{k}</dt>
      <dd className={`num text-right ${strong ? "text-[15px] text-[#f1ebdd]" : "text-[13px] text-[#ddd7ca]"}`}>{v}</dd>
    </div>
  );
}

// ───────────────────────── УЛОВ ─────────────────────────
export function CatchModal({ engine }: { engine: Engine }) {
  const c = engine.lastCatch;
  if (!c) return null;
  const f = FISH_BY_ID[c.item.fishId];
  const r = RARITY_INFO[f.rarity];
  const v = c.item.variant ? VARIANT_INFO[c.item.variant] : null;
  const today = engine.marketValue(c.item);
  const mult = engine.marketMult(f.id);
  const order = engine.s.orders.find((o) => o.fishId === f.id && c.item.weight >= o.minWeight);
  const notes: [string, string][] = [];
  if (c.isNew) notes.push(["book", `Новый вид в кодексе · премия ${fmt(c.bonus)} ₽`]);
  if (c.isRecord) notes.push(["star", "Личный рекорд веса"]);
  if (c.perfect) notes.push(["target", "Точная подсечка"]);
  if (order) notes.push(["order", `Подходит для заказа: ${order.client}`]);
  return (
    <div className="fade-in absolute inset-0 z-30 flex items-stretch justify-center bg-[#02050a]/55 sm:items-center sm:p-4" onPointerDown={(e) => e.stopPropagation()}>
      <div className="sheet reveal safe-pad grid max-h-[100dvh] w-full max-w-[880px] overflow-y-auto overscroll-contain !rounded-none sm:!rounded-[3px] md:grid-cols-[1.15fr_1fr] sm:max-h-[94vh]">
        <div className="plate relative flex min-h-[190px] flex-col justify-between p-4 sm:p-6 [@media(min-height:560px)]:min-h-[300px]">
          <div className="flex items-center justify-between">
            <span className="label" style={{ color: r.color }}>{r.name}</span>
            <span className="label num">№ {String(FISH.indexOf(f) + 1).padStart(3, "0")} / {FISH.length}</span>
          </div>
          <div className="flex flex-1 items-center justify-center py-2 sm:py-4">
            <FishIcon fish={f} size={420} height={210} variant={c.item.variant} animate />
          </div>
          <div className="flex items-end justify-between">
            <div className="flex items-center gap-2 text-[11px] dim">
              <span className="inline-block h-px w-16 bg-[var(--line-2)]" />
              <span className="num">≈ {fmtLen(fishLength(f, c.item.weight))}</span>
            </div>
            <span className="truncate pl-2 text-[11px] dim">{LOC_BY_ID[c.item.loc].name} · {engine.spot.name} · день {c.item.day}</span>
          </div>
        </div>
        <div className="flex flex-col p-5 sm:p-7">
          <div className="label">{c.isNew ? "Впервые пойман" : "Улов"}</div>
          <h3 className="font-serif mt-1 text-[32px] font-medium leading-[1.05] text-[#f4eee0] sm:text-[40px]">{f.name}</h3>
          <div className="font-serif text-[17px] italic muted">{f.latin}</div>
          {v && <div className="mt-2 text-[12px] tracking-wide" style={{ color: v.color }}>Вариация: {v.name.toLowerCase()} · ×{v.mult}</div>}
          <dl className="mt-5">
            <Row k="Вес" v={fmtW(c.item.weight)} strong />
            <Row k="Длина" v={`≈ ${fmtLen(fishLength(f, c.item.weight))}`} />
            <Row k={`Цена · ${engine.port.name}`} v={<span className="text-[var(--brass-2,#e3c996)]">{fmt(today)} ₽</span>} strong />
            <Row k="Спрос" v={<span className={mult >= 1 ? "text-[var(--color-ok)]" : "text-[var(--color-bad)]"}>{mult >= 1.9 ? "спрос дня, ×2" : `${mult >= 1 ? "+" : "−"}${Math.abs(Math.round((mult - 1) * 100))} %`}</span>} />
            <Row k="Опыт" v={`+${c.xp}`} />
          </dl>
          {notes.length > 0 && (
            <ul className="mt-4 space-y-1.5">
              {notes.map(([ic, t]) => (
                <li key={t} className="flex items-center gap-2 text-[12px] text-[#ddd2b8]"><Icon name={ic} size={14} className="text-[var(--brass)]" />{t}</li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-[13px] leading-relaxed muted">{f.desc}</p>
          <div className="sticky bottom-0 -mx-5 mt-auto flex gap-3 border-t border-[var(--line)] bg-[#0a121c] px-5 pb-[max(4px,env(safe-area-inset-bottom))] pt-4 sm:-mx-7 sm:px-7 md:mt-6">
            <button className="btn btn-quiet flex-1" onClick={() => engine.releaseCatch()}>Отпустить</button>
            <button className="btn btn-solid flex-1" disabled={engine.coolerFull} onClick={() => engine.keepCatch()}>
              {engine.coolerFull ? "Садок полон" : `В садок · ${engine.s.cooler.length}/${engine.coolerCap}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── КОДЕКС ─────────────────────────
type Rec = { fishId: string; weight: number; name: string; variant: string | null };
type Leader = { name: string; codexCount: number; totalCaught: number; level?: number; achievements?: number };
type Status = "all" | "caught" | "missing" | "now";
const RARITIES = ["common", "uncommon", "rare", "epic", "legendary"] as const;

export function CodexModal({ engine, onClose }: { engine: Engine; onClose: () => void }) {
  const [tab, setTab] = useState<LocId | "all" | "world">("all");
  const [sel, setSel] = useState<FishDef | null>(null);
  const [rarity, setRarity] = useState<string>("any");
  const [status, setStatus] = useState<Status>("all");
  const [q, setQ] = useState("");
  const [records, setRecords] = useState<Rec[] | null>(null);
  const [leaders, setLeaders] = useState<Leader[] | null>(null);
  const codex = engine.s.codex;
  const found = Object.keys(codex).length;
  const list = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return FISH.filter((f) => {
      if (tab !== "all" && tab !== "world" && !f.loc.includes(tab)) return false;
      if (rarity !== "any" && f.rarity !== rarity) return false;
      const k = !!codex[f.id];
      if (status === "caught" && !k) return false;
      if (status === "missing" && k) return false;
      if (status === "now" && !availableNow(engine, f)) return false;
      if (qq) {
        const known = k || engine.s.hints.includes(f.id);
        if (!known) return false;
        if (!f.name.toLowerCase().includes(qq) && !f.latin.toLowerCase().includes(qq)) return false;
      }
      return true;
    });
  }, [tab, rarity, status, q, codex, engine]);

  useEffect(() => {
    if (tab !== "world" || records) return;
    fetch("/api/catches").then((r) => r.json()).then((j) => setRecords(j.records ?? [])).catch(() => setRecords([]));
    fetch("/api/leaderboard").then((r) => r.json()).then((j) => setLeaders(j.leaders ?? [])).catch(() => setLeaders([]));
  }, [tab, records]);

  const nextMs = MILESTONES.find((m) => m.count > found);
  const tabs = ([["all", "Все"], ...LOCATIONS.map((l) => [l.id, l.name]), ["world", "Рекорды"]] as [string, string][]).map(([id, name]) => {
    const cnt = id === "all" || id === "world" ? null : FISH.filter((f) => f.loc[0] === id);
    return (
      <button key={id} onClick={() => { setTab(id as LocId | "all" | "world"); setSel(null); }} className={`tab ${tab === id ? "on" : ""}`}>
        {name}{cnt && <span className="num ml-1.5 dim">{cnt.filter((f) => codex[f.id]).length}/{cnt.length}</span>}
      </button>
    );
  });

  return (
    <Modal
      label="Кодекс рыбака"
      title={`${found} из ${FISH.length}`}
      onClose={onClose}
      tabs={tabs}
      right={
        <div className="hidden w-64 md:block">
          <div className="h-px w-full bg-[var(--line-2)]"><div className="h-px bg-[var(--brass)]" style={{ width: `${(found / FISH.length) * 100}%` }} /></div>
          <div className="mt-1.5 text-right text-[11px] dim">{nextMs ? `Следующее звание — «${nextMs.title}», ${nextMs.count} видов` : "Кодекс заполнен"}</div>
        </div>
      }
    >
      {tab === "world" ? (
        <div className="grid gap-8 p-4 sm:p-7 md:grid-cols-2">
          <section>
            <div className="label mb-3">Рыбаки</div>
            {!leaders ? <p className="text-sm dim">Загрузка…</p> : leaders.length === 0 ? <p className="text-sm dim">Сервер недоступен или данных пока нет.</p> : (
              <ol>
                {leaders.map((l, i) => (
                  <li key={i} className="flex items-baseline gap-3 border-b border-[var(--line)] py-2 text-[13px]">
                    <span className="num w-6 dim">{i + 1}</span>
                    <span className="flex-1 truncate text-[#ece6d8]">{l.name}</span>
                    <span className="num muted">ур. {l.level ?? 1}</span>
                    <span className="num w-20 text-right muted">{l.codexCount} видов</span>
                    <span className="num hidden w-20 text-right dim sm:inline">{fmt(l.totalCaught)} рыб</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
          <section>
            <div className="label mb-3">Рекорды веса</div>
            {!records ? <p className="text-sm dim">Загрузка…</p> : records.length === 0 ? <p className="text-sm dim">Рекордов пока нет.</p> : (
              <ul className="max-h-[56vh] overflow-y-auto pr-2">
                {records.filter((r) => FISH_BY_ID[r.fishId]).map((r) => (
                  <li key={r.fishId} className="flex items-baseline gap-3 border-b border-[var(--line)] py-2 text-[13px]">
                    <span className="flex-1 truncate text-[#ece6d8]">{codex[r.fishId] ? FISH_BY_ID[r.fishId].name : "Неизвестный вид"}</span>
                    <span className="num text-[var(--brass-2,#e3c996)]">{fmtW(r.weight)}</span>
                    <span className="w-24 truncate text-right dim">{r.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : (
        <div className="p-4 sm:p-7">
          <div className="mb-4 flex flex-wrap items-center gap-2 sm:gap-3">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по названию" className="field !h-9 !w-full !text-left !text-[13px] sm:!w-56" />
            <div className="seg max-w-full overflow-x-auto">
              <button className={rarity === "any" ? "on" : ""} onClick={() => setRarity("any")}>Любая</button>
              {RARITIES.map((r) => (
                <button key={r} className={rarity === r ? "on" : ""} onClick={() => setRarity(r)}>
                  <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: RARITY_INFO[r].color }} />
                  {RARITY_INFO[r].name}
                </button>
              ))}
            </div>
            <div className="seg max-w-full overflow-x-auto">
              {([["all", "Все"], ["caught", "Пойманные"], ["missing", "Не пойманные"], ["now", "Клюют сейчас"]] as [Status, string][]).map(([id, n]) => (
                <button key={id} className={status === id ? "on" : ""} onClick={() => setStatus(id)}>{n}</button>
              ))}
            </div>
            <span className="num ml-auto text-[11px] dim">{list.length} видов</span>
          </div>
          <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
            <div className="grid grid-cols-2 content-start border-l border-t border-[var(--line)] sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
              {list.map((f) => {
                const k = !!codex[f.id];
                const hinted = engine.s.hints.includes(f.id);
                const r = RARITY_INFO[f.rarity];
                return (
                  <button key={f.id} onClick={() => setSel(f)} className={`group relative border-b border-r border-[var(--line)] bg-[#0a121c] p-2.5 text-left transition hover:bg-[#0f1a27] sm:p-3 ${sel?.id === f.id ? "!bg-[#122032] outline outline-1 outline-[var(--brass)]" : ""}`}>
                    <div className="flex items-center justify-between">
                      <span className="num text-[10px] dim">{String(FISH.indexOf(f) + 1).padStart(3, "0")}</span>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: k ? r.color : "rgba(230,225,214,0.12)" }} />
                    </div>
                    <div className="flex justify-center py-1"><FishIcon fish={f} size={124} height={60} known={k} /></div>
                    <div className={`truncate text-[12px] ${k ? "text-[#ece6d8]" : "dim"}`}>{k || hinted ? f.name : "—"}</div>
                    <div className="truncate text-[10px] dim">{k ? f.latin : hinted ? "есть заметки" : LOC_BY_ID[f.loc[0]].name}</div>
                  </button>
                );
              })}
              {list.length === 0 && <p className="font-serif col-span-full py-16 text-center text-lg italic dim">Ничего не найдено</p>}
            </div>
            <aside className={`${sel ? "fixed inset-x-0 bottom-0 z-50 max-h-[82dvh] overflow-y-auto border-t border-[var(--line-2)] bg-[#0a121c] p-5 shadow-[0_-30px_80px_rgba(0,0,0,0.6)] safe-bottom" : "hidden"} lg:static lg:block lg:max-h-none lg:overflow-visible lg:border lg:border-[var(--line)] lg:bg-[rgba(230,225,214,0.028)] lg:shadow-none lg:sticky lg:top-0 lg:h-fit`}>
              {sel ? (
                <>
                  <div className="mb-3 flex justify-end lg:hidden"><button className="iconbtn" onClick={() => setSel(null)} aria-label="Закрыть"><Icon name="close" size={14} /></button></div>
                  <FishDetail f={sel} engine={engine} />
                </>
              ) : (
                <div className="py-10 text-center">
                  <Icon name="book" size={28} className="mx-auto text-[var(--brass)] opacity-70" />
                  <p className="font-serif mt-3 text-lg italic muted">Выберите запись</p>
                  <p className="mt-2 text-[12px] leading-relaxed dim">Виды открываются после поимки. Записки из бутылок раскрывают условия клёва ещё не пойманных рыб. Фильтр «Клюют сейчас» показывает виды, для которых совпадают время, погода, сезон и луна.</p>
                </div>
              )}
            </aside>
          </div>
        </div>
      )}
    </Modal>
  );
}

function FishDetail({ f, engine }: { f: FishDef; engine: Engine }) {
  const e = engine.s.codex[f.id];
  const hinted = engine.s.hints.includes(f.id);
  const show = !!e || hinted;
  const r = RARITY_INFO[f.rarity];
  const notes = useMemo(() => fishNotes(f, isJumper(f)), [f]);
  const checks = conditionsNow(engine, f.id);
  const allOk = checks.every((c) => c.ok);
  return (
    <div>
      <div className="plate flex justify-center py-3"><FishIcon fish={f} size={320} height={140} known={!!e} animate={!!e} /></div>
      <div className="mt-4 flex items-center justify-between">
        <span className="label" style={{ color: r.color }}>{r.name}</span>
        <span className="num text-[10px] dim">№ {String(FISH.indexOf(f) + 1).padStart(3, "0")}</span>
      </div>
      <h3 className="font-serif text-[28px] font-medium leading-tight text-[#f4eee0]">{show ? f.name : "Неизвестный вид"}</h3>
      {show && <div className="font-serif italic muted">{f.latin}</div>}
      <p className="mt-3 text-[13px] leading-relaxed text-[#d8d1c2]">{show ? f.desc : `Вид ещё не описан. Известно лишь, что он обитает в акватории «${LOC_BY_ID[f.loc[0]].name}».`}</p>

      {show && (
        <div className="mt-5">
          <div className="flex items-center justify-between">
            <span className="label">Условия сейчас</span>
            <span className={`text-[11px] ${allOk ? "text-[var(--color-ok)]" : "dim"}`}>{allOk ? "можно поймать здесь" : "не совпадают"}</span>
          </div>
          <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
            {checks.map((c) => (
              <li key={c.label} className="flex items-center gap-1.5 text-[11px]">
                <span className={`h-1.5 w-1.5 shrink-0 rotate-45 ${c.ok ? "bg-[var(--color-ok)]" : "border border-[var(--color-bad)]"}`} />
                <span className={c.ok ? "text-[#ddd7ca]" : "muted"}>{c.label}</span>
                <span className="truncate dim">· {c.hint}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {show && (
        <div className="mt-5 space-y-3">
          {notes.map((n) => (
            <div key={n.title}>
              <div className="label-brass">{n.title}</div>
              <p className="mt-1 text-[12.5px] leading-relaxed muted">{n.text}</p>
            </div>
          ))}
        </div>
      )}

      <dl className="mt-5">
        <Row k="Сила" v={show ? <span className="inline-flex gap-[3px]">{Array.from({ length: 10 }, (_, i) => <span key={i} className={`inline-block h-2 w-1 ${i < f.strength ? "bg-[var(--brass)]" : "bg-white/10"}`} />)}</span> : "—"} />
        {e && <Row k="Поймано" v={`${e.count}`} />}
        {e && <Row k="Рекорд" v={fmtW(e.maxWeight)} strong />}
        {e && <Row k="Впервые" v={`день ${e.firstDay}`} />}
        {e && e.variants.length > 0 && <Row k="Вариации" v={e.variants.map((v) => VARIANT_INFO[v].name.toLowerCase()).join(", ")} />}
      </dl>
    </div>
  );
}

// ───────────────────────── ПОРТ ─────────────────────────

export type PortTab = "market" | "orders" | "gear" | "bait" | "boats" | "map" | "rest";
export function PortModal({ engine, onClose, onTravel, onRest, onReset, cloud, initialTab = "market" }: { engine: Engine; onClose: () => void; onTravel: (t: Trip) => void; onRest: () => void; onReset: () => void; cloud: string; initialTab?: PortTab }) {
  const [tab, setTab] = useState<PortTab>(initialTab);
  const [flash, setFlash] = useState<string | null>(null);
  const s = engine.s;
  const say = (m: string) => { setFlash(m); setTimeout(() => setFlash(null), 2400); };
  const quote = engine.coolerQuote();
  const coolerValue = [...quote.values()].reduce((a, b) => a + b, 0);
  const readyOrders = s.orders.filter((o) => engine.orderMatches(o).length >= o.count).length;
  const tabs: [PortTab, string, string][] = [
    ["market", "Рынок", s.cooler.length ? `${s.cooler.length}` : ""],
    ["orders", "Заказы", readyOrders ? `${readyOrders} готов` : `${s.orders.length}`],
    ["gear", "Снаряжение", ""],
    ["bait", "Наживка", ""],
    ["boats", "Верфь", ""],
    ["map", "Карта", ""],
    ["rest", "Таверна", ""],
  ];
  const hot = engine.hot;
  const fc = engine.forecast;
  const hh = `${String(Math.floor(engine.hour)).padStart(2, "0")}:${String(Math.floor((engine.hour % 1) * 60)).padStart(2, "0")}`;

  return (
    <Modal
      label={`Порт · ${engine.port.place}`}
      title={engine.port.name}
      onClose={onClose}
      tabs={tabs.map(([id, n, b]) => (
        <button key={id} className={`tab ${tab === id ? "on" : ""}`} onClick={() => setTab(id)}>
          {n}{b && <span className={`num ml-1.5 ${id === "orders" && readyOrders ? "text-[var(--color-ok)]" : "dim"}`}>{b}</span>}
        </button>
      ))}
      right={
        <div className="flex items-center gap-6">
          <div className="hidden text-right sm:block"><div className="label">День {engine.day}</div><div className="num text-[15px] text-[#ece6d8]">{hh}</div></div>
          <div className="text-right"><div className="label hidden sm:block">Средства</div><div className="num text-[15px] text-[var(--brass-2,#e3c996)] sm:text-[18px]">{fmt(s.money)} ₽</div></div>
        </div>
      }
    >
      {flash && <div className="fade-in mx-4 mt-4 sm:mx-7 border-l-2 border-[var(--color-ok)] bg-[rgba(134,180,148,0.08)] px-4 py-2 text-[13px] text-[#cfe3d4]">{flash}</div>}
      <div className="p-4 sm:p-7">
        {tab === "market" && (
          <div>
            <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="label mb-2">Спрос дня · цена ×1,8</div>
                <div className="flex flex-wrap gap-3">
                  {hot.map((id) => (
                    <div key={id} className="cell flex items-center gap-2 py-1 pl-1 pr-3">
                      <FishIcon fish={FISH_BY_ID[id]} size={52} height={28} known={!!s.codex[id]} />
                      <span className="text-[13px] text-[#ece6d8]">{s.codex[id] ? FISH_BY_ID[id].name : "Неизвестный вид"}</span>
                    </div>
                  ))}
                </div>
              </div>
              <p className="w-full text-[11px] leading-relaxed dim md:order-last">Местная рыба здесь дешевле, привозная — дороже: у каждого порта свой спрос. Улов теряет свежесть — около 10% в сутки, в судах со льдом медленнее. Каждая проданная сегодня рыба вида снижает цену следующей такой же.</p>
              <div className="flex items-center gap-5">
                <div className="text-right">
                  <div className="label">Садок {s.cooler.length}/{engine.coolerCap}</div>
                  <div className="num text-[18px] text-[var(--brass-2,#e3c996)]">{fmt(coolerValue)} ₽</div>
                </div>
                <button className="btn btn-solid" disabled={!s.cooler.length} onClick={() => { const v = engine.sellAll(); say(`Улов продан: ${fmt(v)} ₽`); }}>Продать всё</button>
              </div>
            </div>
            {s.cooler.length === 0 ? (
              <p className="font-serif py-16 text-center text-xl italic dim">Садок пуст</p>
            ) : (
              <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0"><table className="w-full min-w-[460px] text-[13px]">
                <thead>
                  <tr className="label text-left">
                    <th className="py-2 font-medium" colSpan={2}>Вид</th>
                    <th className="py-2 text-right font-medium">Вес</th>
                    <th className="hidden py-2 text-right font-medium sm:table-cell">Спрос</th>
                    <th className="py-2 text-right font-medium">Цена</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {s.cooler.map((c) => {
                    const f = FISH_BY_ID[c.fishId];
                    const m = engine.marketMult(c.fishId);
                    const sat = engine.saturation(c.fishId);
                    const fr = engine.freshness(c);
                    const best = PORTS.filter((p) => s.portsKnown.includes(p.id) && p.id !== s.port).map((p) => ({ p, d: (p.demand[f.loc[0]] ?? 1) * (f.rarity === "epic" || f.rarity === "legendary" ? p.rareDemand : 1) })).sort((a, b) => b.d - a.d)[0];
                    const hereD = engine.demand(c.fishId);
                    const forOrder = s.orders.some((o) => o.fishId === c.fishId && c.weight >= o.minWeight);
                    return (
                      <tr key={c.uid} className="border-t border-[var(--line)]">
                        <td className="w-20 py-1.5"><FishIcon fish={f} size={72} height={36} variant={c.variant} /></td>
                        <td className="py-1.5">
                          <div className="text-[#ece6d8]">{f.name}</div>
                          <div className="text-[11px] dim">{c.variant ? VARIANT_INFO[c.variant].name : RARITY_INFO[f.rarity].name}{forOrder ? " · нужна для заказа" : ""}</div>
                          <div className="flex flex-wrap gap-x-3 text-[10.5px]">
                            <span className={fr < 0.8 ? "text-[var(--color-bad)]" : fr < 0.95 ? "text-[#d8c090]" : "text-[var(--color-ok)]"}><MiscIcon name="fresh" size={11} className="mr-0.5 inline -translate-y-px" />{Math.round(fr * 100)}%</span>
                            {best && best.d > hereD * 1.08 && <span className="text-[var(--brass)]"><MiscIcon name="demand" size={11} className="mr-0.5 inline -translate-y-px" />{best.p.name} ×{best.d.toFixed(2)}</span>}
                          </div>
                        </td>
                        <td className="num py-1.5 text-right muted">{fmtW(c.weight)}</td>
                        <td className={`num hidden py-1.5 text-right sm:table-cell ${m >= 1 ? "text-[var(--color-ok)]" : "text-[var(--color-bad)]"}`}>{m >= 1.9 ? "×2" : `${m >= 1 ? "+" : "−"}${Math.abs(Math.round((m - 1) * 100))}%`}</td>
                        <td className="num py-1.5 text-right text-[var(--brass-2,#e3c996)]">{fmt(quote.get(c.uid) ?? engine.marketValue(c))} ₽{sat < 0.999 && <div className="text-[10px] text-[var(--color-bad)]">рынок −{Math.round((1 - sat) * 100)}%</div>}</td>
                        <td className="w-24 py-1.5 text-right"><button className="btn btn-sm btn-quiet" onClick={() => engine.sellOne(c.uid)}>Продать</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table></div>
            )}
          </div>
        )}

        {tab === "orders" && (
          <div>
            <p className="mb-5 max-w-2xl text-[13px] muted">После сбора улова выплата пересчитывается и гарантирует минимум 15% сверх отдельной продажи тех же рыб. Несобранный заказ показывает базовую оплату. Заказы обновляются при заходе в порт. Выполнено: <span className="num text-[#ece6d8]">{s.ordersDone}</span></p>
            <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
              {s.orders.map((o) => {
                const f = FISH_BY_ID[o.fishId];
                const have = engine.orderMatches(o).length;
                const known = !!s.codex[o.fishId];
                const left = o.expiresDay - engine.day;
                const ready = have >= o.count;
                const payout = engine.orderReward(o);
                return (
                  <div key={o.id} className={`cell flex flex-col p-5 ${ready ? "!border-[rgba(134,180,148,0.45)]" : ""}`}>
                    <div className="flex items-center justify-between"><span className="label">{o.client}</span><span className={`text-[11px] ${left <= 0 ? "text-[var(--color-bad)]" : "dim"}`}>{left <= 0 ? "последний день" : `${left} дн.`}</span></div>
                    <div className="plate my-3 flex justify-center py-2"><FishIcon fish={f} size={200} height={84} known={known} /></div>
                    <div className="font-serif text-[22px] text-[#f1ebdd]">{known ? f.name : "Неизвестный вид"}</div>
                    <div className="text-[11px] dim">{known ? f.latin : LOC_BY_ID[f.loc[0]].name}</div>
                    <dl className="mt-3">
                      <Row k="Количество" v={<span className={ready ? "text-[var(--color-ok)]" : ""}>{have} / {o.count}</span>} />
                      {o.minWeight > 0 && <Row k="Масса от" v={fmtW(o.minWeight)} />}
                      <Row k={ready ? "Оплата · бонус к рынку" : "Базовая оплата"} v={<span className="text-[var(--brass-2,#e3c996)]">{fmt(payout)} ₽</span>} strong />
                    </dl>
                    <button className="btn btn-solid mt-4 w-full" disabled={!ready} onClick={() => engine.fulfillOrder(o.id) && say(`Заказ сдан: +${fmt(payout)} ₽`)}>Сдать заказ</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === "gear" && (
          <div>
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <p className="max-w-3xl text-[12px] leading-relaxed muted">Каждая снасть имеет класс и три ступени доработок. Уровень доработки не может быть выше класса самой снасти, а мастерские разных портов берутся за разную сложность. Здесь, в «{engine.port.name}», — до класса {engine.port.gearMax.rod + 1} и доработок {Math.min(3, engine.port.gearMax.rod)} уровня; цены ×{engine.port.priceMult.toFixed(2)}.</p>
              <div className="text-right"><div className="label">Средства</div><div className="num text-[18px] text-[var(--brass-2,#e3c996)]">{fmt(s.money)} ₽</div></div>
            </div>
            <div className="space-y-3">
              {GEAR_ROWS.map(([k, name, what]) => {
                const list = gearList(k);
                const lvl = s[k];
                const cur = list[lvl], next = list[lvl + 1];
                const block = engine.gearBlock(k);
                const mods = k === "sonar" ? [] : engine.modsOf(k);
                return (
                  <div key={k} className="cell grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1.4fr)]">
                    <div className="flex gap-4">
                      <span className="flex h-16 w-16 shrink-0 items-center justify-center border border-[var(--line-2)] bg-[#081019] text-[var(--brass)]"><GearIcon kind={k} size={38} /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="label">{name}</span>
                          <span className="num text-[10px] dim">класс {lvl + 1}/{list.length}</span>
                        </div>
                        <div className="font-serif text-[22px] leading-tight text-[#f1ebdd]">{cur.name}</div>
                        <div className="text-[12px] muted">{what}: <span className="num text-[#ece6d8]">{gearValue(k, cur.value, cur.desc)}</span></div>
                        <div className="mt-2 flex gap-1">{list.map((_, i) => <div key={i} className={`h-[3px] flex-1 ${i <= lvl ? "bg-[var(--brass)]" : i <= engine.port.gearMax[k] ? "bg-white/25" : "bg-white/8"}`} />)}</div>
                        {next ? (
                          <div className="mt-3 flex flex-wrap items-center gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="text-[13px] text-[#ece6d8]">→ {next.name}</div>
                              <div className="text-[11px] dim">{next.desc}{k !== "hook" && k !== "sonar" ? ` · ${gearValue(k, next.value, next.desc)}` : ""}</div>
                            </div>
                            <button className="btn btn-sm btn-solid" disabled={!!block} onClick={() => engine.buyGear(k) && say(`Приобретено: ${next.name}`)}>{block ?? `${fmt(engine.gearPrice(k))} ₽`}</button>
                          </div>
                        ) : <div className="mt-3 text-[12px] text-[var(--color-ok)]">Лучшее из доступного</div>}
                      </div>
                    </div>
                    {mods.length > 0 ? (
                      <div className="grid gap-2 border-t border-[var(--line)] pt-3 sm:grid-cols-3 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
                        {mods.map((m) => {
                          const ml = engine.mod(m.id);
                          const mb = engine.modBlock(m.id);
                          return (
                            <div key={m.id} className="flex flex-col border border-[var(--line)] bg-[#0a121c] p-3">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[12.5px] leading-tight text-[#ece6d8]">{m.name}</span>
                                <span className="flex gap-[3px]">{Array.from({ length: m.max }, (_, i) => <span key={i} className={`h-2 w-2 rotate-45 ${i < ml ? "bg-[var(--brass)]" : i < lvl ? "border border-[var(--brass)]/50" : "border border-white/15"}`} />)}</span>
                              </div>
                              <div className="mt-1 text-[11px] text-[#cfc6b3]">{ml > 0 ? m.desc(ml) : "Не установлено"}</div>
                              {ml < m.max && <div className="text-[10.5px] dim">Ур. {ml + 1}: {m.desc(ml + 1)}</div>}
                              <button className="btn btn-sm mt-auto w-full !h-7 !text-[9.5px]" style={{ marginTop: 10 }} disabled={!!mb} onClick={() => engine.buyMod(m.id) && say(`${m.name}: уровень ${ml + 1}`)}>{mb ?? `${fmt(engine.modPrice(m.id))} ₽`}</button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="border-t border-[var(--line)] pt-3 text-[12px] leading-relaxed muted lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
                        {cur.desc}. Эхолот видит рельеф и рыбу по горизонтам; старшие модели отмечают редкость, ещё не пойманные виды и легенд.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === "bait" && (
          <div>
            <p className="mb-4 max-w-3xl text-[12px] muted">Натуральная наживка съедается почти каждой рыбой. Искусственные приманки служат долго и теряются в основном при обрыве. Крупная наживка отсекает мелочь и приносит рыбу тяжелее; вне рабочего диапазона глубин любая наживка работает хуже.</p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {BAITS.map((b) => {
                const sold = engine.baitSold(b.id);
                const have = b.id === "worm" ? "∞" : String(s.baits[b.id] ?? 0);
                const where = PORTS.filter((p) => p.baits.includes(b.id)).map((p) => p.name).join(", ");
                return (
                  <div key={b.id} className={`cell flex flex-col p-4 ${s.currentBait === b.id ? "!border-[rgba(200,164,106,0.5)]" : ""}`}>
                    <div className="flex items-start gap-3">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center border border-[var(--line)] bg-[#081019]"><BaitIcon id={b.id} size={34} /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-serif text-[19px] leading-tight text-[#f1ebdd]">{b.name}</span>
                          <span className="num text-[13px] text-[#ece6d8]">{have}</span>
                        </div>
                        <div className="label !text-[9px]">{b.kind === "lure" ? "искусственная" : b.kind === "special" ? "особая" : "натуральная"}{b.mimics ? ` · как ${b.mimics.map((m) => BAIT_BY_ID[m].name.toLowerCase()).join(", ")}` : ""}</div>
                      </div>
                    </div>
                    <p className="mt-2 text-[12px] leading-snug muted">{b.desc}</p>
                    <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
                      <StatBar k="Размер" v={(b.size + 1) / 2} t={b.size > 0.35 ? "крупная" : b.size < -0.35 ? "мелкая" : "средняя"} />
                      <StatBar k="Поклёвка" v={(b.bite - 0.8) / 0.5} t={`${b.bite >= 1 ? "+" : "−"}${Math.abs(Math.round((b.bite - 1) * 100))}%`} />
                      <StatBar k="Прочность" v={b.durable} t={b.id === "worm" ? "∞" : `${Math.round(b.durable * 100)}%`} />
                      <StatBar k="Глубина" v={Math.min(1, Math.log10(b.depth[1] + 1) / 3.3)} t={`${b.depth[0]}–${b.depth[1]} м`} />
                    </div>
                    <div className="mt-auto pt-4">
                      {b.price > 0 && (sold ? (
                        <button className="btn btn-sm w-full" disabled={s.money < engine.baitPrice(b.id)} onClick={() => engine.buyBait(b.id) && say(`${b.name}: +${b.pack}`)}>+{b.pack} шт · {fmt(engine.baitPrice(b.id))} ₽</button>
                      ) : (
                        <div className="border border-[var(--line)] px-3 py-2 text-[11px] dim">Здесь не продаётся · {where}</div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === "boats" && (
          <div>
            <p className="mb-5 max-w-3xl text-[13px] muted">Суда остаются во владении — выходите в море на том, что лучше подходит для задачи. Класс судна открывает акватории; купить судно можно, если во флоте есть судно предыдущего класса.</p>
            {BOAT_CLASS_NAMES.map((cn, tier) => (
              <div key={cn} className="mb-6">
                <div className="mb-2 flex items-baseline gap-3">
                  <span className="label-brass">Класс {romanize(tier + 1)}</span>
                  <span className="font-serif text-[18px] text-[#ece6d8]">{cn}</span>
                  <span className="text-[11px] dim">{LOCATIONS.filter((l) => l.boatTier === tier).map((l) => l.name).join(", ")}</span>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {BOATS.map((b, i) => ({ b, i })).filter(({ b }) => b.tier === tier).map(({ b, i }) => {
                    const owned = s.boatsOwned.includes(i);
                    const active = s.boat === i;
                    const block = engine.boatBlock(i);
                    const tooFull = owned && !active && s.cooler.length > b.cooler + engine.perk("cooler") * 2;
                    return (
                      <div key={b.id} className={`cell flex flex-col p-4 sm:p-5 ${active ? "!border-[rgba(200,164,106,0.55)]" : ""} ${!owned && b.tier > engine.fleetTier + 1 ? "opacity-55" : ""}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-serif text-[21px] leading-tight text-[#f1ebdd]">{b.name}</div>
                            <div className="text-[11px] text-[var(--brass)]">{b.special}</div>
                          </div>
                          {active ? <span className="label-brass shrink-0">В строю</span> : owned ? <span className="label shrink-0">Во флоте</span> : <span className="num shrink-0 text-[15px] text-[var(--brass-2,#e3c996)]">{fmt(b.price)} ₽</span>}
                        </div>
                        <BoatPreview hull={b.hull} trim={b.trim} tier={b.tier} style={b.style} />
                        <p className="text-[12px] muted">{b.desc}</p>
                        <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-1.5">
                          <StatBar k="Трюм" v={b.cooler / 42} t={`${b.cooler}`} />
                          <StatBar k="Ход" v={(1.45 - b.travelMult) / 0.85} t={`×${(1 / b.travelMult).toFixed(2)}`} />
                          <StatBar k="Остойчивость" v={b.stability} t={b.stormSafe ? "штормовое" : `${Math.round(b.stability * 100)}%`} />
                          <StatBar k="Бесшумность" v={(b.quiet - 0.8) / 0.5} t={`${b.quiet >= 1 ? "+" : "−"}${Math.abs(Math.round((b.quiet - 1) * 100))}%`} />
                          <StatBar k="Расход топлива" v={1 - b.fuel / 420} t={b.fuel ? `${b.fuel} ₽/ч` : "нет"} />
                          <StatBar k="К редким видам" v={b.rareBonus / 0.12} t={b.rareBonus ? `+${Math.round(b.rareBonus * 100)}%` : "—"} />
                        </div>
                        <div className="mt-auto pt-4">
                          {active ? null : owned ? (
                            <button className="btn btn-quiet w-full" disabled={tooFull} onClick={() => engine.setBoat(i) && say(`Выходим на судне «${b.name.split("«")[1]?.replace("»", "") ?? b.name}»`)}>{tooFull ? "Улов не поместится в трюм" : "Пересесть"}</button>
                          ) : (
                            <button className="btn btn-solid w-full" disabled={!!block} onClick={() => engine.buyBoat(i) && say(`Новое судно: ${b.name}`)}>{block ?? `Купить · ${fmt(b.price)} ₽`}</button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "map" && <ChartMap engine={engine} onSail={(id) => onTravel({ kind: "port", port: id })} onGo={(l, sp) => onTravel({ kind: "loc", loc: l, spot: sp })} />}

        {tab === "rest" && (
          <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
            <div className="cell p-5 sm:p-6">
              <div className="label">{TAVERN[engine.port.id]}</div>
              <h3 className="font-serif mt-1 flex items-center gap-2 text-2xl text-[#f1ebdd]"><MiscIcon name="bed" size={20} className="text-[var(--brass)]" />Ночлег</h3>
              <p className="mt-2 text-[13px] muted">Комнаты сдают с 19:00 до 4:00, не чаще раза за 16 часов. Отдых до пяти утра, за ночь сменится погода и появятся новые заказы. Цена ночлега — <span className="num text-[#ece6d8]">{fmt(engine.port.innFee)} ₽</span>.</p>
              <div className="mt-5 flex items-center gap-4 border-y border-[var(--line)] py-4">
                <Icon name={WEATHER_ICON[fc.w]} size={30} className="text-[var(--brass)]" />
                <div>
                  <div className="label">Сводка по радио</div>
                  <div className="text-[13px] text-[#ece6d8]">Сейчас {WEATHER_INFO[s.weather].name.toLowerCase()}. Через ~{Math.max(1, Math.round(fc.inMin / 60))} ч ожидается: {WEATHER_INFO[fc.w].name.toLowerCase()}.</div>
                </div>
              </div>
              <button className="btn btn-solid mt-5" disabled={!!engine.restBlock} onClick={onRest}>{engine.restBlock ?? `Снять комнату · ${fmt(engine.port.innFee)} ₽`}</button>
            </div>
            <div className="cell p-5 sm:p-6">
              <div className="label">Судовой журнал</div>
              <div className="mt-3">
                <div className="mb-3"><div className="label mb-1">Имя</div><input className="field !text-left" maxLength={24} defaultValue={s.name} onBlur={(ev) => engine.setName(ev.target.value)} /></div>
                <dl>
                  <Row k="Поймано рыб" v={fmt(s.stats.totalCaught)} />
                  <Row k="Заработано" v={`${fmt(s.stats.totalEarned)} ₽`} />
                  <Row k="Выполнено заказов" v={fmt(s.ordersDone)} />
                  <Row k="Крупнейший улов" v={s.stats.biggest ? `${FISH_BY_ID[s.stats.biggest.fishId]?.name}, ${fmtW(s.stats.biggest.weight)}` : "—"} />
                  <Row k="Сохранение" v={cloud} />
                </dl>
              </div>
              <button className="btn btn-sm btn-danger mt-5" onClick={() => { if (confirm("Стереть сохранение и начать заново?")) onReset(); }}>Начать заново</button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

const romanize = (n: number) => ["I", "II", "III", "IV", "V", "VI"][n - 1] ?? String(n);

// Морская карта
const CHART_POS = LOC_POS;
const GEAR_ROWS: [GearKind, string, string][] = [["rod", "Удилище", "Предел натяжения"], ["reel", "Катушка", "Скорость подмотки"], ["line", "Леска", "Рабочая глубина"], ["hook", "Крючок", "Удержание"], ["sonar", "Эхолот", "Возможности"]];
const gearValue = (k: GearKind, v: number, desc: string) => (k === "line" ? `${v} м` : k === "reel" ? `×${v}` : k === "hook" ? ["базовое", "острое", "надёжное", "самозасекающее", "абсолютное"][v] ?? String(v) : k === "sonar" ? desc.toLowerCase() : String(v));
const TAVERN: Record<PortId, string> = { home: "Таверна «Старый якорь»", nordhavn: "Постоялый двор «Кракен»", mirador: "Отель «Пирс»", coral: "Гостевой дом «Ла Пальма»", southcross: "Жилой модуль станции" };
const CLIMATE_NAME: Record<string, string> = { temperate: "умеренный", north: "северный", tropic: "тропический", ocean: "океанический", polar: "полярный", misty: "туманный приморский" };

function ChartMap({ engine, onGo, onSail }: { engine: Engine; onGo: (l: LocId, spot: string) => void; onSail: (id: PortId) => void }) {
  const s = engine.s;
  const [sel, setSel] = useState<LocId>(s.location);
  const l = LOC_BY_ID[sel];
  const fog = !engine.isUnlocked(sel);
  const locked = fog || l.boatTier > engine.boat.tier;
  const us = engine.unlockState(sel);
  const all = FISH.filter((f) => f.loc.includes(sel));
  const here = all.filter((f) => s.codex[f.id]).length;
  const [px, py] = engine.port.pos;
  const Y = (p: number) => p * 0.625;
  return (
    <div className="grid gap-6 lg:grid-cols-[1.55fr_1fr]">
      <div className="relative aspect-[16/10] overflow-hidden border border-[var(--line-2)] bg-[#0b1824]">
        <svg viewBox="0 0 100 62.5" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
          <defs>
            <radialGradient id="deepA" cx="86%" cy="36%" r="22%"><stop offset="0" stopColor="#03080f" /><stop offset="1" stopColor="#0b1824" stopOpacity="0" /></radialGradient>
            <radialGradient id="shelfG" cx="15%" cy="60%" r="40%"><stop offset="0" stopColor="#153246" /><stop offset="1" stopColor="#0b1824" stopOpacity="0" /></radialGradient>
            <pattern id="grid" width="6.25" height="6.25" patternUnits="userSpaceOnUse"><path d="M6.25 0H0V6.25" fill="none" stroke="rgba(143,179,200,0.07)" strokeWidth="0.15" /></pattern>
            <pattern id="ice" width="1.4" height="1.4" patternUnits="userSpaceOnUse"><path d="M0 1.4L1.4 0" stroke="rgba(200,225,240,0.25)" strokeWidth="0.12" /></pattern>
          </defs>
          <rect width="100" height="62.5" fill="url(#shelfG)" />
          <rect width="100" height="62.5" fill="url(#grid)" />
          <rect width="100" height="62.5" fill="url(#deepA)" />
          {[0, 1, 2, 3].map((i) => <ellipse key={i} cx="86" cy="15" rx={4 + i * 3.5} ry={2.5 + i * 2.2} fill="none" stroke="rgba(143,179,200,0.1)" strokeWidth="0.18" />)}
          {[0, 1, 2, 3, 4].map((i) => (
            <path key={i} d={`M${-2 + i * 3} 64 C ${8 + i * 5} ${48 - i * 2}, ${4 + i * 5} ${26 - i * 2}, ${16 + i * 5} -2`} fill="none" stroke="rgba(143,179,200,0.11)" strokeWidth="0.16" strokeDasharray={i % 2 ? "0.8 0.8" : undefined} />
          ))}
          {/* материк */}
          <path d="M0 62.5 L0 0 L19 0 C18 3 12 4 13 7 C14 9 19 8 20 11 C21 14 17 15 19 18 C22 21 26 19 27 23 C27 26 22 26 21 29 C20 33 24 34 22 38 C20 42 16 40 14 43 C12 46 16 48 13 51 C11 53 7 51 5 54 L4 56 C6 58 9 57 10 60 L10 62.5 Z" fill="#1b2721" stroke="rgba(230,225,214,0.28)" strokeWidth="0.2" />
          {/* лиман — река */}
          <path d="M3 62.5 C4 58 2 56 4 54" fill="none" stroke="#2a4a5a" strokeWidth="0.7" />
          {/* фьорд */}
          <path d="M13 7 C10 6 7 8 4 7" fill="none" stroke="#0b1824" strokeWidth="0.8" />
          {/* шхеры */}
          {[[32, 12], [34, 13.5], [29, 16], [33, 16.5], [36, 15], [31, 18.5], [28, 13]].map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx={0.8 + (i % 3) * 0.3} ry={0.5} fill="#2a3530" stroke="rgba(230,225,214,0.25)" strokeWidth="0.1" />)}
          {/* мыс Туманного берега */}
          <path d="M38 36 C40 38 44 38 46 40 C45 41 42 40.5 40 41 C38 40 37 38 38 36 Z" fill="#1f2a24" stroke="rgba(230,225,214,0.25)" strokeWidth="0.15" />
          {/* тропические острова */}
          <path d="M63 58 C65 55.5 69 55 71 57 C72 59 68 60 65 60 C63 60 62 59 63 58 Z" fill="#23302a" stroke="rgba(230,225,214,0.22)" strokeWidth="0.15" />
          <path d="M44 62.5 C45 59 49 58 53 59 C55 60 54 62 56 62.5 Z" fill="#1f3326" stroke="rgba(230,225,214,0.22)" strokeWidth="0.15" />
          {/* вулкан */}
          <path d="M72 38.5 L74 35.5 L76 38.5 Z" fill="#2a2422" stroke="rgba(230,225,214,0.35)" strokeWidth="0.15" />
          <circle cx="74" cy="35.2" r="0.35" fill="rgba(255,120,50,0.7)" />
          {/* ледяной шельф */}
          <path d="M76 62.5 L78 56 C82 54.5 88 55 93 53.5 C96 53 98 54 100 53 L100 62.5 Z" fill="url(#ice)" stroke="rgba(220,236,246,0.45)" strokeWidth="0.2" />
          <path d="M76 62.5 L78 56 C82 54.5 88 55 93 53.5 C96 53 98 54 100 53 L100 62.5 Z" fill="rgba(200,225,240,0.1)" />
          {LOCATIONS.filter((x) => x.id !== "bay").map((x) => {
            const [qx, qy] = CHART_POS[x.id];
            const lk = !engine.isUnlocked(x.id) || x.boatTier > engine.boat.tier;
            return <line key={x.id} x1={px} y1={Y(py)} x2={qx} y2={Y(qy)} stroke={lk ? "rgba(230,225,214,0.1)" : "rgba(200,164,106,0.42)"} strokeWidth="0.22" strokeDasharray="0.8 0.8" />;
          })}
          <g transform="translate(93 44)" stroke="rgba(230,225,214,0.35)" strokeWidth="0.2" fill="none">
            <circle r="4" />
            <circle r="2.9" strokeDasharray="0.3 0.6" />
            <path d="M0 -5.2 L0.8 0 L0 5.2 L-0.8 0 Z" fill="rgba(200,164,106,0.5)" />
            <path d="M-5.2 0 L0 -0.6 L5.2 0 L0 0.6 Z" fill="rgba(230,225,214,0.2)" />
          </g>
          <text x="93" y="38" fontSize="1.6" textAnchor="middle" fill="rgba(230,225,214,0.5)" fontFamily="serif">N</text>
        </svg>
        {LOCATIONS.map((x) => {
          const [qx, qy] = CHART_POS[x.id];
          const hidden = !engine.isUnlocked(x.id);
          const lk = hidden || x.boatTier > engine.boat.tier;
          const cur = s.location === x.id;
          const right = qx > 80;
          return (
            <button key={x.id} onClick={() => setSel(x.id)} className="group absolute -translate-x-1/2 -translate-y-1/2 p-1.5 text-left" style={{ left: `${qx}%`, top: `${qy}%` }}>
              <span className={`block h-2.5 w-2.5 rotate-45 border ${sel === x.id ? "border-[var(--brass)] bg-[var(--brass)]" : lk ? "border-white/25 bg-[#0b1824]" : "border-[var(--brass)] bg-[#0b1824]"}`} />
              <span className={`font-serif absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-[11px] leading-none sm:text-[14px] ${right ? "right-5" : "left-5"} ${sel === x.id ? "text-[#f4eee0]" : lk ? "text-white/35" : "text-[#d8d1c2]"} group-hover:text-white`}>
                {hidden ? "?" : x.name}{cur && <span className="label-brass ml-1.5 align-middle !text-[8px]">здесь</span>}
              </span>
            </button>
          );
        })}
        {PORTS.map((p) => {
          const known = s.portsKnown.includes(p.id);
          const here = s.port === p.id;
          return (
            <div key={p.id} className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${p.pos[0]}%`, top: `${p.pos[1]}%` }} title={p.name}>
              <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${here ? "border-[var(--brass)] bg-[var(--brass)] text-[#17110a]" : known ? "border-[var(--brass)] bg-[#0b1824] text-[var(--brass)]" : "border-white/20 bg-[#0b1824] text-white/25"}`}><MiscIcon name="port" size={12} /></span>
            </div>
          );
        })}
        <div className="absolute bottom-2 left-3 hidden text-[9px] tracking-[0.2em] text-white/30 sm:block">КАРТА АКВАТОРИЙ · МАСШТАБ УСЛОВНЫЙ</div>
      </div>
      <div className="flex flex-col">
        <div className="mb-5">
          <div className="label mb-2">Порты</div>
          <div className="space-y-1.5">
            {PORTS.map((p) => {
              const known = s.portsKnown.includes(p.id);
              const here = s.port === p.id;
              const fuel = engine.fuelTo(p.pos);
              return (
                <div key={p.id} className={`flex items-center gap-3 border px-3 py-2 ${here ? "border-[rgba(200,164,106,0.55)]" : "border-[var(--line)]"} ${known ? "" : "opacity-45"}`}>
                  <MiscIcon name="port" size={15} className={known ? "text-[var(--brass)]" : "dim"} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] text-[#ece6d8]">{known ? p.name : "Неизвестный порт"}</div>
                    <div className="truncate text-[10.5px] dim">{known ? p.place : `откроется: ${p.serves.map((l) => LOC_BY_ID[l].name).join(" / ")}`}</div>
                  </div>
                  {here ? <span className="label-brass">здесь</span> : known && (
                    <button className="btn btn-sm btn-quiet" disabled={fuel > s.money} onClick={() => onSail(p.id)}>{(engine.travelMinutesTo(p.pos) / 60).toFixed(1)} ч{fuel ? ` · ${fmt(fuel)} ₽` : ""}</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className="label">{locked ? "Недоступно" : `Переход ${(engine.travelMinutes(sel) / 60).toFixed(1)} ч · топливо ${engine.boat.fuel ? `${fmt(engine.fuelCost(sel))} ₽` : "не нужно"}`}</div>
        <h3 className="font-serif text-[26px] leading-tight text-[#f4eee0] sm:text-[32px]">{fog ? "Неизведанные воды" : l.name}</h3>
        <p className="mt-1 text-[13px] muted">{fog ? "Карты этих мест у вас пока нет." : l.desc}</p>
        <dl className="mt-3">
          <Row k="Глубины" v={`до ${l.maxDepth} м`} />
          <Row k="Кодекс" v={`${here} / ${all.length}`} />
          <Row k="Климат" v={CLIMATE_NAME[l.climate] ?? l.climate} />
          {!locked && engine.boat.fuel > 0 && <Row k="Топливо туда и обратно" v={<span className={s.money < engine.fuelCost(sel) * 2 ? "text-[var(--color-bad)]" : ""}>{fmt(engine.fuelCost(sel) * 2)} ₽</span>} />}
          <Row k="Прозрачность" v={l.clarity > 0.8 ? "кристальная" : l.clarity > 0.55 ? "хорошая" : l.clarity > 0.35 ? "умеренная" : "мутная"} />
          <Row k="Судно" v={`класс ${romanize(l.boatTier + 1)} и выше`} />
        </dl>
        {fog ? (
          <div className="mt-5 border border-[var(--line)] p-4">
            <div className="flex items-center gap-2 text-[13px] text-[#ece6d8]"><Icon name="lock" size={16} className="text-[var(--brass)]" />Не разведано</div>
            {us.u && <p className="font-serif mt-2 text-[15px] italic muted">«{us.u.hint}»</p>}
            <ul className="mt-3 space-y-1.5">
              {us.reqs.map((r) => (
                <li key={r.label} className="flex items-center gap-2 text-[12px]">
                  <span className={`h-1.5 w-1.5 shrink-0 rotate-45 ${r.ok ? "bg-[var(--color-ok)]" : "border border-[var(--brass)]"}`} />
                  <span className={`flex-1 ${r.ok ? "muted line-through decoration-white/20" : "text-[#ddd7ca]"}`}>{r.label}</span>
                  <span className="num dim">{r.have}</span>
                </li>
              ))}
              <li className="flex items-center gap-2 text-[12px]">
                <span className={`h-1.5 w-1.5 shrink-0 rotate-45 ${engine.fleetTier >= l.boatTier ? "bg-[var(--color-ok)]" : "border border-[var(--brass)]"}`} />
                <span className="flex-1 text-[#ddd7ca]">Судно класса {romanize(l.boatTier + 1)}</span>
                <span className="num dim">{engine.fleetTier >= l.boatTier ? "✓" : "—"}</span>
              </li>
            </ul>
          </div>
        ) : locked ? (
          <div className="mt-5 flex items-center gap-3 border border-[var(--line)] p-4 text-[13px] muted"><Icon name="lock" size={18} />{engine.fleetTier >= l.boatTier ? `Пересядьте на судно класса ${romanize(l.boatTier + 1)} на верфи` : `Требуется судно класса ${romanize(l.boatTier + 1)} — ${BOAT_CLASS_NAMES[l.boatTier].toLowerCase()}`}</div>
        ) : (
          <div className="mt-5 space-y-2">
            <div className="label">Точки ловли</div>
            {spotsOf(sel).map((sp) => {
              const cur = s.spot === sp.id;
              return (
                <button key={sp.id} onClick={() => onGo(sel, sp.id)} className={`cell cell-hover block w-full p-3 text-left ${cur ? "!border-[rgba(200,164,106,0.55)]" : ""}`}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[14px] text-[#ece6d8]">{sp.name}</span>
                    <span className={`num text-[11px] ${sp.maxDepth > engine.line.value ? "text-[var(--color-bad)]" : "dim"}`}>{sp.maxDepth} м</span>
                  </div>
                  <div className="mt-0.5 text-[11px] leading-snug dim">{sp.desc}</div>
                </button>
              );
            })}
            {l.maxDepth > engine.line.value && <p className="text-[11px] text-[var(--color-bad)]">Текущая леска достаёт лишь до {engine.line.value} м.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function StatBar({ k, v, t }: { k: string; v: number; t: string }) {
  return (
    <div>
      <div className="flex justify-between text-[11px]"><span className="muted">{k}</span><span className="num text-[#ddd7ca]">{t}</span></div>
      <div className="mt-1 h-[3px] bg-white/10"><div className="h-full bg-[var(--brass)]" style={{ width: `${Math.max(4, Math.min(1, v) * 100)}%` }} /></div>
    </div>
  );
}

function BoatPreview({ hull, trim, tier, style }: { hull: string; trim: string; tier: number; style?: string }) {
  const w = { kayak: 78, row: 70, dinghy: 84, barkas: 96, cutter: 112, yacht: 124, seiner: 140, trawler: 150, research: 156 }[style ?? ""] ?? 70 + tier * 20;
  const x0 = 100 - w / 2;
  const low = style === "kayak";
  const deckY = low ? 51 : 47;
  return (
    <svg viewBox="0 0 200 76" className="my-2 h-20 w-full">
      <line x1="0" y1="56" x2="200" y2="56" stroke="rgba(143,179,200,0.35)" strokeWidth="0.8" />
      <path d="M0 60 Q 25 58 50 60 T 100 60 T 150 60 T 200 60" fill="none" stroke="rgba(143,179,200,0.15)" strokeWidth="0.8" />
      {style === "yacht" && <><line x1={100} y1={6} x2={100} y2={46} stroke={trim} strokeWidth="1.3" /><path d="M101 8 L101 44 L128 44 Z" fill="#f4f2ec" opacity="0.9" /><path d="M99 12 L99 44 L80 44 Z" fill="#e8e4da" opacity="0.8" /></>}
      {style === "barkas" && <><rect x={100 - 12} y={37} width={22} height={10} fill={trim} /><line x1={112} y1={14} x2={112} y2={37} stroke={trim} strokeWidth="1.4" /><path d="M112 16 Q120 24 112 34" fill="none" stroke="#c8b890" strokeWidth="2" /></>}
      {(style === "cutter" || style === "seiner" || style === "trawler" || style === "research") && <path d={`M${100 - w * 0.22} 47 V${36 - tier * 3} H${100 + w * 0.08} L${100 + w * 0.14} 47 Z`} fill={trim} opacity="0.92" />}
      {(style === "seiner" || style === "trawler" || style === "research") && <line x1={100 - w * 0.05} y1={14 - tier} x2={100 - w * 0.05} y2={36 - tier * 3} stroke={trim} strokeWidth="1.4" />}
      {style === "trawler" && <path d={`M${x0 + 8} 47 L${x0 + 12} 20 L${x0 + 30} 20 L${x0 + 34} 47`} fill="none" stroke="#e8e4dc" strokeWidth="2" />}
      {style === "research" && <path d={`M${x0 + 6} 47 L${x0 + 12} 22 L${x0 + 26} 47`} fill="none" stroke="#e08a30" strokeWidth="2" />}
      {style === "row" && <line x1={x0 + 18} y1="47" x2={x0 - 4} y2="64" stroke={trim} strokeWidth="1.4" />}
      {style === "kayak" && <><line x1={80} y1={40} x2={120} y2={58} stroke="#2a2a2a" strokeWidth="1.4" /><circle cx={100} cy={44} r={3} fill="#3a4a3a" /></>}
      {style === "dinghy" && <rect x={x0 - 8} y="42" width="8" height="10" fill="#333" />}
      <path d={low ? `M${x0} ${deckY} Q100 ${deckY - 4} ${x0 + w} ${deckY} Q100 ${deckY + 8} ${x0} ${deckY} Z` : `M${x0} ${deckY} L${x0 + w} 44 Q${x0 + w * 0.94} 58 ${x0 + w * 0.78} 60 L${x0 + w * 0.08} 60 Q${x0} 54 ${x0} ${deckY} Z`} fill={hull} stroke={trim} strokeWidth="1.2" />
    </svg>
  );
}
