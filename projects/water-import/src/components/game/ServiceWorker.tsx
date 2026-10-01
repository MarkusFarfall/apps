"use client";

import { useEffect } from "react";

/**
 * Регистрирует service worker: игра открывается офлайн и ставится на телефон.
 * Делаем это после загрузки страницы, чтобы не мешать первому кадру.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    const timer = setTimeout(() => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* офлайн-режим недоступен — игра работает как обычно */
      });
    }, 1200);

    return () => clearTimeout(timer);
  }, []);

  return null;
}
