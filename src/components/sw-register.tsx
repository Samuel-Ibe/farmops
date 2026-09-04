"use client";

import { useEffect } from "react";

export function SWRegister() {
  useEffect(() => {
    // Skip SW registration in development to avoid stale cache issues
    if (typeof window !== "undefined" && "serviceWorker" in navigator && process.env.NODE_ENV !== "development") {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("SW registered:", registration.scope);
        })
        .catch((error) => {
          console.log("SW registration failed:", error);
        });
    }
  }, []);

  return null;
}
