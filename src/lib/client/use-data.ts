"use client";

import { useCallback, useEffect, useState } from "react";

/* Einfacher Änderungs-Bus: Nach jeder Speicheraktion laden betroffene Ansichten neu. */
const listeners = new Set<() => void>();

export function notifyChange() {
  for (const l of listeners) l();
}

/** Lädt Daten aus dem Gerätespeicher und aktualisiert sie bei Änderungen. */
export function useData<T>(load: () => Promise<T>, deps: unknown[]): { data: T | undefined; error: Error | null; reload: () => void } {
  const key = JSON.stringify(deps);
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<{ key: string; data?: T; error: Error | null }>({ key: "", error: null });

  useEffect(() => {
    let alive = true;
    load().then(
      (data) => alive && setState({ key, data, error: null }),
      (error: Error) => alive && setState({ key, error }),
    );
    return () => {
      alive = false;
    };
    // `load` hängt nur von `deps` ab (über `key` abgebildet).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version]);

  useEffect(() => {
    const listener = () => setVersion((v) => v + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const current = state.key === key;
  return { data: current ? state.data : undefined, error: current ? state.error : null, reload };
}
