"use client";

import { useEffect } from "react";
import { BASE_PATH } from "@/lib/routes";

export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    navigator.serviceWorker.register(`${BASE_PATH}/sw.js`, { scope: `${BASE_PATH}/` }).catch(() => undefined);
  }, []);
  return null;
}
