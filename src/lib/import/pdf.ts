import { extractText, getDocumentProxy } from "unpdf";

export const MAX_PDF_BYTES = 40 * 1024 * 1024;

export class UploadError extends Error {}

/**
 * PDF-Textextraktion direkt auf dem Gerät: Größenlimit, Signaturprüfung (%PDF-).
 * Die Datei verlässt das Gerät nicht und wird nicht gespeichert.
 */
export async function extractPdfText(file: File): Promise<{ text: string; pages: number; pageTexts: string[]; doc: Awaited<ReturnType<typeof getDocumentProxy>> }> {
  if (file.size === 0) throw new UploadError("Die Datei ist leer.");
  if (file.size > MAX_PDF_BYTES) throw new UploadError("Die PDF-Datei ist größer als 40 MB.");
  if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") {
    throw new UploadError("Nur PDF-Dateien sind erlaubt.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") throw new UploadError("Die Datei ist keine gültige PDF-Datei.");
  try {
    const pdf = await getDocumentProxy(bytes);
    const { totalPages, text } = await extractText(pdf, { mergePages: false });
    const pageTexts = Array.isArray(text) ? text : [text];
    return { text: pageTexts.join("\n\n"), pages: totalPages, pageTexts, doc: pdf };
  } catch (err) {
    const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    throw new UploadError(`Der Text konnte nicht aus der PDF-Datei gelesen werden. Technischer Grund: ${detail.slice(0, 200)}`);
  }
}
