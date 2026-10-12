"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/service-worker.js").catch((err) => {
      console.warn("Service worker registration failed:", err);
    });
  }, []);

  return null;
}
