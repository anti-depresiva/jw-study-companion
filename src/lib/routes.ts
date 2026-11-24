/** Zentrale Pfade (statische App: Woche/Absatz stehen in Query-Parametern). */

export type WeekBase = "/zusammenkuenfte" | "/arbeitsheft" | "/wachtturm";

export const weekHref = (base: WeekBase, year: number, week: number) => `${base}/?y=${year}&w=${week}`;
export const paragraphHref = (year: number, week: number, n: number) => `/wachtturm/absatz/?y=${year}&w=${week}&n=${n}`;
export const itemHref = (year: number, week: number, id: string) => `/arbeitsheft/punkt/?y=${year}&w=${week}&id=${encodeURIComponent(id)}`;
export const importHref = (year: number, week: number, type: "watchtower" | "workbook", mode?: "pdf" | "text" | "manual") =>
  `/import/?y=${year}&w=${week}&type=${type}${mode ? `&mode=${mode}` : ""}`;

/** Pfad für statische Dateien unter GitHub Pages (Unterordner = Repository-Name). */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
export const asset = (path: string) => `${BASE_PATH}${path}`;
