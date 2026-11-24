// Erzeugt PNG-Icons (PWA, Apple, Favicon) aus den SVG-Vorlagen.
// Aufruf: npm run icons
import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";

const icon = await readFile("public/icons/icon.svg");
const maskable = await readFile("public/icons/icon-maskable.svg");

const jobs = [
  [icon, 192, "public/icons/icon-192.png"],
  [icon, 512, "public/icons/icon-512.png"],
  [maskable, 192, "public/icons/maskable-192.png"],
  [maskable, 512, "public/icons/maskable-512.png"],
  [maskable, 180, "public/icons/apple-touch-icon.png"],
  [icon, 48, "public/icons/favicon-48.png"],
];

for (const [svg, size, out] of jobs) {
  await writeFile(out, await sharp(svg, { density: 384 }).resize(size, size).png().toBuffer());
  console.log("✓", out);
}
