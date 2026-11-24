// Nachbearbeitung des statischen Exports für reine Datei-Hoster (GitHub Pages):
// Next.js legt Prefetch-Segmente als Ordner ab (__next.X/seite/__PAGE__.txt),
// fragt sie im Browser aber als Datei mit Punkten an (__next.X.seite.__PAGE__.txt).
// Dieses Skript legt die erwarteten Dateinamen zusätzlich an.
import { copyFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const OUT = path.resolve("out");
let created = 0;

function filesUnder(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    return statSync(p).isDirectory() ? filesUnder(p) : [p];
  });
}

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (!statSync(p).isDirectory()) continue;
    if (name.startsWith("__next.")) {
      for (const file of filesUnder(p)) {
        const rel = path.relative(p, file).split(path.sep).join(".");
        copyFileSync(file, path.join(dir, `${name}.${rel}`));
        created++;
      }
    } else if (name !== "_next") {
      walk(p);
    }
  }
}

walk(OUT);
// GitHub Pages: Ordner mit Unterstrich (_next) nicht durch Jekyll filtern lassen
writeFileSync(path.join(OUT, ".nojekyll"), "");
console.log(`✓ ${created} Prefetch-Dateien für statisches Hosting ergänzt`);
