"use client";

import { useState } from "react";
import type { Engine, Trip } from "@/game/engine";
import type { Building, Hotspot } from "@/game/render/port";
import { BOATS, LOC_BY_ID, SEASONS, spotsOf } from "@/game/world";
import { AccountBadge, type AccountState } from "./Account";
import { GearIcon, Icon, MiscIcon, WEATHER_ICON } from "./Icons";
import { fmt } from "./Panels";

const LABELS: Record<Building, { name: string; sub: string }> = {
  market: { name: "Рынок", sub: "продать улов" },
  shop: { name: "Лавка снастей", sub: "снаряжение и наживка" },
  shipyard: { name: "Верфь", sub: "суда" },
  tavern: { name: "Таверна", sub: "ночлег и покой" },
};

function BuildingIcon({ b, size = 18 }: { b: Building | "sea" | "orders"; size?: number }) {
  if (b === "shop") return <GearIcon kind="rod" size={size} />;
  if (b === "market") return <Icon name="coin" size={size} />;
  if (b === "shipyard") return <Icon name="boat" size={size} />;
  if (b === "tavern") return <MiscIcon name="bed" size={size} />;
  if (b === "orders") return <Icon name="order" size={size} />;
  return <Icon name="wave" size={size} />;
}

const fmtH = (m: number) => (m >= 60 ? `${(m / 60).toFixed(1).replace(".", ",")} ч` : `${Math.round(m)} мин`);

function DepartSheet({ engine, onClose, onTravel, onMap }: { engine: Engine; onClose: () => void; onTravel: (t: Trip) => void; onMap: () => void }) {
  const s = engine.s;
  const port = engine.port;
  const last: Trip = { kind: "loc", loc: s.location, spot: s.spot };
  const lastOk = LOC_BY_ID[s.location].boatTier <= engine.boat.tier;
  const quote = (t: Trip) => engine.tripQuote(t, engine.canMotor ? "motor" : "sail");
  return (
    <div className="fade-in absolute inset-0 z-30 flex items-end justify-center bg-[#02050a]/60 backdrop-blur-[2px] sm:items-center sm:p-4" onPointerDown={(e) => { e.stopPropagation(); onClose(); }}>
      <div className="sheet reveal safe-bottom max-h-[88dvh] w-full max-w-[620px] overflow-y-auto !rounded-none p-5 sm:!rounded-[3px] sm:p-7" onPointerDown={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <div className="label-brass">Отплытие · {engine.boat.name}</div>
            <h2 className="font-serif mt-1 text-[30px] leading-none text-[#f1ebdd]">Куда выходим?</h2>
          </div>
          <button className="iconbtn" onClick={onClose} aria-label="Закрыть"><Icon name="close" size={16} /></button>
        </div>
        {lastOk && (
          <button onClick={() => onTravel(last)} className="cell cell-hover mt-5 flex w-full items-center gap-4 !border-[rgba(200,164,106,0.55)] p-4 text-left">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center border border-[var(--brass)] text-[var(--brass)]"><Icon name="pin" size={20} /></span>
            <span className="min-w-0 flex-1">
              <span className="label-brass block">Вернуться</span>
              <span className="block font-serif text-[20px] leading-tight text-[#f1ebdd]">{engine.spot.name}</span>
              <span className="block text-[11px] dim">{LOC_BY_ID[s.location].name}</span>
            </span>
            <span className="num shrink-0 text-right text-[12px] muted">{fmtH(quote(last).minutes)}</span>
          </button>
        )}
        {port.serves.map((lid) => {
          const L = LOC_BY_ID[lid];
          const fog = !engine.isUnlocked(lid);
          const locked = fog || L.boatTier > engine.boat.tier;
          return (
            <div key={lid} className="mt-5">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="font-serif text-[18px] text-[#ece6d8]">{fog ? "Не разведано" : L.name}</span>
                <span className="text-[11px] dim">{fog ? engine.unlockState(lid).reqs.filter((r) => !r.ok).map((r) => r.label).join(" · ") : locked ? `нужно судно класса ${L.boatTier + 1}` : `до ${L.maxDepth} м`}</span>
              </div>
              <div className="grid gap-1.5 sm:grid-cols-3">
                {spotsOf(lid).map((sp) => {
                  const t: Trip = { kind: "loc", loc: lid, spot: sp.id };
                  const q = quote(t);
                  return (
                    <button key={sp.id} disabled={locked} onClick={() => onTravel(t)} className="cell cell-hover p-3 text-left disabled:cursor-not-allowed disabled:opacity-40">
                      <span className="block text-[13px] leading-tight text-[#ece6d8]">{sp.name}</span>
                      <span className="mt-1 flex justify-between text-[10.5px] dim">
                        <span className={sp.maxDepth > engine.line.value ? "text-[var(--color-bad)]" : ""}>{sp.maxDepth} м</span>
                        <span className="num">{fmtH(q.minutes)}{q.fuel ? ` · ${fmt(q.fuel)} ₽` : ""}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        <button className="btn btn-quiet mt-6 w-full" onClick={onMap}><Icon name="map" size={14} />Другие акватории и порты — на карте</button>
        {engine.fleetTier > engine.boat.tier && <p className="mt-3 text-[11px] dim">На верфи можно пересесть на судно старшего класса: {BOATS.filter((b, i) => s.boatsOwned.includes(i) && b.tier > engine.boat.tier).map((b) => b.name).join(", ")}.</p>}
      </div>
    </div>
  );
}

export function PortHub({ engine, hot, compact, onOpen, onTravel, onJournal, onCodex, onEvents, account, onAccount }: {
  engine: Engine;
  hot: Hotspot[];
  compact: boolean;
  onOpen: (b: Building | "map" | "orders") => void;
  onTravel: (t: Trip) => void;
  onJournal: () => void;
  onCodex: () => void;
  onEvents: () => void;
  account: AccountState;
  onAccount: () => void;
}) {
  const s = engine.s;
  const port = engine.port;
  const [depart, setDepart] = useState(false);
  const atmo = engine.atmosphere.summary();
  const hh = String(Math.floor(engine.hour)).padStart(2, "0");
  const mm = String(Math.floor(engine.s.minutes % 60)).padStart(2, "0");
  const ready = s.orders.filter((o) => engine.orderMatches(o).length >= o.count).length;
  const coolerValue = [...engine.coolerQuote().values()].reduce((a, b) => a + b, 0);
  const badges: Partial<Record<Building, string>> = {
    market: s.cooler.length ? `${s.cooler.length} · ${fmt(coolerValue)} ₽` : "",
    shop: engine.perkPoints ? "" : "",
  };
  const dock: { id: Building | "sea" | "orders"; name: string }[] = [
    { id: "market", name: "Рынок" },
    { id: "orders", name: ready ? `Заказы · ${ready}` : "Заказы" },
    { id: "shop", name: "Лавка" },
    { id: "shipyard", name: "Верфь" },
    { id: "tavern", name: "Таверна" },
  ];

  return (
    <div className="hud-layer z-20" onPointerDown={(e) => e.stopPropagation()}>
      {/* шапка */}
      <div className="flex items-start justify-between gap-2">
        <div className="glass fade-in px-4 py-3">
          <div className="label-brass">{port.place}</div>
          <div className="font-serif text-[26px] leading-none text-[#f4eee0] sm:text-[32px]">{port.name}</div>
          <div className="mt-2 flex items-center gap-3 text-[12px] text-[#ddd7ca]">
            <span className="num text-[15px] text-[#f1ebdd]">{hh}:{mm}</span>
            <span className="flex items-center gap-1"><Icon name={WEATHER_ICON[engine.weather]} size={14} className="text-[var(--brass)]" />{atmo.weatherName} · {atmo.temp > 0 ? "+" : ""}{atmo.temp}°</span>
            <span className="hidden dim sm:inline">{SEASONS[engine.season]}, день {engine.dayOfSeason}</span>
          </div>
          {engine.fairBonus > 1 && <div className="mt-1.5 text-[11px] text-[var(--brass-2,#e3c996)]">Ярмарка выходного дня · цены на рынке +10%</div>}
          <div className="hidden">
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex gap-1.5">
            <AccountBadge account={account} compact onClick={onAccount} />
            <button className="iconbtn" onClick={onJournal} aria-label="Журнал"><Icon name="journal" size={16} />{(engine.perkPoints > 0 || engine.hasLetter || engine.daily.tasks.some((t) => t.done && !t.claimed)) && <span className="dot" />}</button>
            <button className="iconbtn" onClick={onCodex} aria-label="Кодекс"><Icon name="book" size={16} /></button>
            <button className="iconbtn" onClick={onEvents} aria-label="Явления"><Icon name="sparkle" size={16} />{engine.eventDirector.activeList().length > 0 && <span className="dot" />}</button>
          </div>
          <div className="glass num flex items-center gap-3 whitespace-nowrap px-3 py-1.5 text-[13px]">
            <span className="text-[var(--brass-2,#e3c996)]">{fmt(s.money)} ₽</span>
            <span className="text-[#ece6d8]"><Icon name="basket" size={12} className="mr-1 inline -translate-y-px opacity-60" />{s.cooler.length}/{engine.coolerCap}</span>
          </div>
        </div>
      </div>

      {/* метки зданий на сцене */}
      {hot.filter((h) => h.id !== "dock").map((h) => {
        const b = h.id as Building;
        const L = LABELS[b];
        return (
          <button
            key={b}
            onClick={() => onOpen(b)}
            className="group absolute -translate-x-1/2 -translate-y-full text-center"
            style={{ left: h.x, top: h.y - 6 }}
          >
            <span className="glass flex items-center gap-2 whitespace-nowrap px-2.5 py-1.5 transition group-hover:border-[var(--brass)]">
              <span className="text-[var(--brass)]"><BuildingIcon b={b} size={compact ? 14 : 16} /></span>
              <span className="text-left">
                <span className="block text-[11px] leading-tight text-[#f1ebdd] sm:text-[12px]">{L.name}</span>
                {!compact && <span className="block text-[10px] leading-tight dim">{badges[b] || L.sub}</span>}
              </span>
            </span>
            <span className="mx-auto block h-3 w-px bg-[var(--brass)]/60" />
          </button>
        );
      })}

      {/* нижняя панель навигации */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 px-2 pb-[max(10px,env(safe-area-inset-bottom))] sm:flex-row sm:items-end sm:justify-center">
        <div className="glass no-scrollbar flex max-w-full gap-0.5 overflow-x-auto p-1">
          {dock.map((d) => (
            <button
              key={d.id}
              onClick={() => onOpen(d.id as Building | "orders")}
              className="flex shrink-0 flex-col items-center gap-1 border border-transparent px-2.5 py-2 text-[9.5px] uppercase tracking-[0.12em] text-[#cfc8b8] transition hover:border-[var(--line-2)] hover:text-white sm:px-4 sm:text-[10px]"
            >
              <BuildingIcon b={d.id} size={compact ? 18 : 20} />
              <span className="whitespace-nowrap">{d.name}</span>
            </button>
          ))}
          <button onClick={() => onOpen("map")} className="flex shrink-0 flex-col items-center gap-1 border border-transparent px-2.5 py-2 text-[9.5px] uppercase tracking-[0.12em] text-[#cfc8b8] hover:border-[var(--line-2)] hover:text-white sm:px-4 sm:text-[10px]">
            <Icon name="map" size={compact ? 18 : 20} />
            <span>Карта</span>
          </button>
        </div>
        <button onClick={() => setDepart(true)} className="btn btn-solid h-[58px] w-full max-w-[420px] gap-3 !text-[12px] sm:w-auto sm:px-7">
          <Icon name="wave" size={20} />
          <span className="flex flex-col items-start leading-tight">
            <span>Выйти в море</span>
            <span className="text-[9.5px] font-medium normal-case tracking-normal opacity-70">{engine.spot.name}</span>
          </span>
        </button>
      </div>
      {depart && <DepartSheet engine={engine} onClose={() => setDepart(false)} onTravel={(t) => { setDepart(false); onTravel(t); }} onMap={() => { setDepart(false); onOpen("map"); }} />}
    </div>
  );
}
