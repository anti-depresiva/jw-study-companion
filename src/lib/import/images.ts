import { getResolvedPDFJS, type getDocumentProxy } from "unpdf";

type PdfDoc = Awaited<ReturnType<typeof getDocumentProxy>>;

export interface PdfImage {
  page: number;
  width: number;
  height: number;
  blob: Blob;
}

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const MAX_SIDE = 1600;
const MAX_IMAGES = 24;
/** Mindestgröße eines Bildes in PDF-Punkten (1/72 Zoll) – kleiner sind Symbole/Zierrat */
const MIN_W = 60;
const MIN_H = 40;

type Matrix = [number, number, number, number, number, number];
const mul = (a: Matrix, b: number[]): Matrix => [
  a[0] * b[0] + a[2] * b[1],
  a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3],
  a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4],
  a[1] * b[4] + a[3] * b[5] + a[5],
];

/**
 * Bilder in PDFs sind oft in Streifen zerlegt oder haben einen Rahmen als eigenes Bild.
 * Überlappende bzw. aneinanderstoßende Teile werden zu einem Bild zusammengefasst.
 */
export function mergeBoxes(boxes: Box[], gap = 3): Box[] {
  const merged = boxes.map((b) => ({ ...b }));
  let changed = true;
  while (changed) {
    changed = false;
    outer: for (let i = 0; i < merged.length; i++) {
      for (let j = i + 1; j < merged.length; j++) {
        const a = merged[i];
        const b = merged[j];
        if (a.x0 <= b.x1 + gap && b.x0 <= a.x1 + gap && a.y0 <= b.y1 + gap && b.y0 <= a.y1 + gap) {
          merged[i] = { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) };
          merged.splice(j, 1);
          changed = true;
          break outer;
        }
      }
    }
  }
  return merged.filter((b) => {
    const w = b.x1 - b.x0;
    const h = b.y1 - b.y0;
    return w >= MIN_W && h >= MIN_H && Math.max(w / h, h / w) <= 5;
  });
}

/** Positionen aller Bilder einer Seite (PDF-Koordinaten) aus der Zeichenoperationsliste. */
async function imageBoxes(page: Awaited<ReturnType<PdfDoc["getPage"]>>): Promise<Box[]> {
  const { OPS } = await getResolvedPDFJS();
  const ops = await page.getOperatorList();
  let ctm: Matrix = [1, 0, 0, 1, 0, 0];
  const stack: Matrix[] = [];
  const boxes: Box[] = [];
  ops.fnArray.forEach((fn, i) => {
    const args = ops.argsArray[i] as number[];
    if (fn === OPS.save) stack.push(ctm);
    else if (fn === OPS.restore) ctm = stack.pop() ?? ctm;
    else if (fn === OPS.transform) ctm = mul(ctm, args);
    else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject || fn === OPS.paintImageMaskXObject) {
      const pts = [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ].map(([x, y]) => [ctm[0] * x + ctm[2] * y + ctm[4], ctm[1] * x + ctm[3] * y + ctm[5]]);
      boxes.push({
        x0: Math.min(...pts.map((p) => p[0])),
        y0: Math.min(...pts.map((p) => p[1])),
        x1: Math.max(...pts.map((p) => p[0])),
        y1: Math.max(...pts.map((p) => p[1])),
      });
    }
  });
  return boxes;
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Bild konnte nicht umgewandelt werden."))), "image/jpeg", 0.85),
  );
}

/**
 * Bilder der angegebenen PDF-Seiten (1-basiert): Seite rendern und die Bildbereiche
 * ausschneiden – so entstehen vollständige Bilder statt einzelner Streifen.
 * Läuft komplett auf dem Gerät.
 */
export async function extractPageImages(pdf: PdfDoc, pages: number[]): Promise<PdfImage[]> {
  const result: PdfImage[] = [];
  for (const pageNumber of pages) {
    if (result.length >= MAX_IMAGES) break;
    const page = await pdf.getPage(pageNumber);
    let boxes: Box[];
    try {
      boxes = mergeBoxes(await imageBoxes(page));
    } catch {
      continue;
    }
    if (boxes.length === 0) continue;

    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(3, 2400 / Math.max(base.width, base.height));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // „print“: rendert ohne requestAnimationFrame – läuft auch, wenn die App kurz im Hintergrund ist
    await page.render({ canvas, canvasContext: ctx, viewport, intent: "print" }).promise;

    // Von oben nach unten, links nach rechts (PDF-y wächst nach oben)
    boxes.sort((a, b) => b.y1 - a.y1 || a.x0 - b.x0);
    for (const box of boxes) {
      const [ax, ay] = viewport.convertToViewportPoint(box.x0, box.y0);
      const [bx, by] = viewport.convertToViewportPoint(box.x1, box.y1);
      const sx = Math.max(0, Math.floor(Math.min(ax, bx)));
      const sy = Math.max(0, Math.floor(Math.min(ay, by)));
      const sw = Math.min(canvas.width - sx, Math.ceil(Math.abs(bx - ax)));
      const sh = Math.min(canvas.height - sy, Math.ceil(Math.abs(by - ay)));
      if (sw < 20 || sh < 20) continue;
      const fit = Math.min(1, MAX_SIDE / Math.max(sw, sh));
      const out = document.createElement("canvas");
      out.width = Math.round(sw * fit);
      out.height = Math.round(sh * fit);
      out.getContext("2d")!.drawImage(canvas, sx, sy, sw, sh, 0, 0, out.width, out.height);
      result.push({ page: pageNumber, width: out.width, height: out.height, blob: await toBlob(out) });
      out.width = out.height = 0;
      if (result.length >= MAX_IMAGES) break;
    }
    canvas.width = canvas.height = 0; // Speicher auf dem iPhone sofort freigeben
    page.cleanup();
  }
  return result;
}
