import { extractImages } from "unpdf";

type PdfDoc = Exclude<Parameters<typeof extractImages>[0], Uint8Array | ArrayBuffer | string>;

export interface PdfImage {
  page: number;
  width: number;
  height: number;
  blob: Blob;
}

const MAX_SIDE = 1600;
const MAX_IMAGES = 24;

/** Echte Bilder von Zierelementen (Linien, Symbole, Hintergründe) unterscheiden. */
function isContentImage(w: number, h: number) {
  const ratio = Math.max(w / h, h / w);
  return w >= 180 && h >= 120 && w * h >= 60_000 && ratio <= 5;
}

async function toJpeg(rgba: Uint8Array, width: number, height: number): Promise<{ blob: Blob; width: number; height: number }> {
  const full = document.createElement("canvas");
  full.width = width;
  full.height = height;
  const ctx = full.getContext("2d");
  if (!ctx) throw new Error("Canvas nicht verfügbar.");
  const pixels = new Uint8ClampedArray(rgba.byteLength);
  pixels.set(rgba);
  ctx.putImageData(new ImageData(pixels, width, height), 0, 0);

  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const out = document.createElement("canvas");
  out.width = Math.round(width * scale);
  out.height = Math.round(height * scale);
  const octx = out.getContext("2d")!;
  octx.fillStyle = "#fff"; // transparente Bereiche weiß statt schwarz
  octx.fillRect(0, 0, out.width, out.height);
  octx.drawImage(full, 0, 0, out.width, out.height);
  const blob = await new Promise<Blob>((resolve, reject) =>
    out.toBlob((b) => (b ? resolve(b) : reject(new Error("Bild konnte nicht umgewandelt werden."))), "image/jpeg", 0.82),
  );
  full.width = full.height = 0; // Speicher auf dem iPhone sofort freigeben
  return { blob, width: out.width, height: out.height };
}

/** Bilder der angegebenen PDF-Seiten (1-basiert) – läuft komplett auf dem Gerät. */
export async function extractPageImages(pdf: PdfDoc, pages: number[]): Promise<PdfImage[]> {
  const result: PdfImage[] = [];
  const seen = new Set<string>();
  for (const page of pages) {
    if (result.length >= MAX_IMAGES) break;
    let images;
    try {
      images = await extractImages(pdf, page);
    } catch {
      continue; // einzelne Seite ohne lesbare Bilder überspringen
    }
    for (const img of images) {
      if (!isContentImage(img.width, img.height)) continue;
      const key = img.key ?? `${page}-${img.width}x${img.height}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const jpeg = await toJpeg(img.data, img.width, img.height);
      result.push({ page, ...jpeg });
      if (result.length >= MAX_IMAGES) break;
    }
  }
  return result;
}
