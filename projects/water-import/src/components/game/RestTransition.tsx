"use client";

import { useEffect } from "react";

const ANIMATION_MS = 2600;

export function RestTransition({ portName, onComplete }: { portName: string; onComplete: () => void }) {
  useEffect(() => {
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const timer = window.setTimeout(onComplete, reducedMotion ? 180 : ANIMATION_MS);
    return () => window.clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="rest-transition absolute inset-0 z-[100] overflow-hidden" role="status" aria-label={`Ночёвка в порту ${portName}. Рассвет.`}>
      <div className="rest-sky" aria-hidden="true" />
      <div className="rest-daylight" aria-hidden="true" />
      <div className="rest-stars" aria-hidden="true">
        {Array.from({ length: 14 }, (_, i) => <span key={i} />)}
      </div>
      <div className="rest-sun" aria-hidden="true" />
      <div className="rest-water" aria-hidden="true"><div className="rest-reflection" /></div>
      <svg className="rest-boat" viewBox="0 0 180 56" fill="none" aria-hidden="true">
        <path d="M18 35h144l-15 14H37L18 35Z" fill="#101d25" stroke="#b68e62" strokeWidth="1.4" />
        <path d="M89 8v27M91 11l39 19H91V11Z" fill="#d5c4a4" fillOpacity=".78" stroke="#eee0c1" strokeWidth="1" />
        <path d="M27 51c17 3 37 3 55 0m17 0c15 2 30 2 45 0" stroke="#d5a47a" strokeOpacity=".42" strokeWidth="1.2" />
        <circle cx="81" cy="32" r="2.2" fill="#edc887" />
      </svg>
      <div className="rest-caption">
        <div className="label-brass">Таверна · {portName}</div>
        <h2 className="font-serif">Ночь уходит</h2>
        <p>Море встречает новый рассвет</p>
      </div>
      <div className="rest-footer" aria-hidden="true"><span>НОЧЛЕГ</span><i /><span>РАССВЕТ</span></div>
    </div>
  );
}
