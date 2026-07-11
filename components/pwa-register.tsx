"use client";

import { useEffect } from "react";

/** Registra o service worker em produção; em dev, remove SW/caches antigos. */
export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      // Em dev, um SW remanescente (de um build de produção anterior no mesmo
      // host) serviria chunks em cache e quebraria a hidratação — remova-o.
      navigator.serviceWorker.getRegistrations().then((regs) => {
        for (const r of regs) r.unregister();
      });
      if ("caches" in window) {
        caches.keys().then((keys) => {
          for (const k of keys) caches.delete(k);
        });
      }
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Falha ao registrar não deve quebrar a aplicação.
    });
  }, []);
  return null;
}
