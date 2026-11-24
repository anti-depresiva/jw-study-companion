import { BrowserStore } from "./browser-store";
import type { Store } from "./store";

/** Einziger Speicher der App – liegt vollständig auf dem Gerät. */
export const store: Store = new BrowserStore();
export type { Store } from "./store";
