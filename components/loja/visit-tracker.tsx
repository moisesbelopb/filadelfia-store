"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Registra a visita da página em segundo plano, DEPOIS da renderização, via
 * navigator.sendBeacon — não bloqueia nada e o visitante nunca espera por isso.
 * Montado só no layout da loja; ainda assim ignora /admin por segurança.
 */
export function VisitTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return;
    try {
      const body = JSON.stringify({ path: pathname });
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        navigator.sendBeacon("/api/track", body);
      } else {
        // Fallback: fetch com keepalive (não segura a navegação).
        void fetch("/api/track", { method: "POST", body, keepalive: true });
      }
    } catch {
      // ignora — telemetria nunca deve afetar a experiência
    }
  }, [pathname]);

  return null;
}
