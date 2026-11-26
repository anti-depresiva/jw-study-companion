import Anthropic from "@anthropic-ai/sdk";
import type { BetaMessage, BetaMessageParam, BetaTextBlockParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { z } from "zod";

export class AiUnavailableError extends Error {
  constructor() {
    super("Die KI ist nicht eingerichtet. Bitte den Anthropic-API-Schlüssel in den Einstellungen eintragen.");
  }
}
export class AiRefusalError extends Error {}
export class AiOutputError extends Error {}

let client: Anthropic | null = null;
let config = { apiKey: "", model: "claude-opus-5-5" };

/** Wird vor jeder KI-Aktion mit den Einstellungen des Geräts aufgerufen. */
export function configureAi(apiKey: string, modelId: string) {
  if (apiKey !== config.apiKey) client = null;
  config = { apiKey: apiKey.trim(), model: modelId.trim() || "claude-opus-5-5" };
}

export const aiEnabled = () => Boolean(config.apiKey);

export function getClient(): Anthropic {
  if (!config.apiKey) throw new AiUnavailableError();
  // Persönliche App: Der Schlüssel liegt nur auf diesem Gerät und wird direkt an Anthropic gesendet.
  client ??= new Anthropic({ apiKey: config.apiKey, maxRetries: 3, dangerouslyAllowBrowser: true });
  return client;
}

export const model = () => config.model;

/** Server-seitige Ausweichmodelle bei Ablehnungen (Opus 5.5). */
export const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export function textOf(message: BetaMessage): string {
  return message.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
}

export function assertUsable(message: BetaMessage) {
  if (message.stop_reason === "refusal") {
    throw new AiRefusalError("Die KI hat diese Anfrage abgelehnt. Bitte formuliere sie anders.");
  }
  if (message.stop_reason === "max_tokens") {
    throw new AiOutputError("Die KI-Antwort war zu lang und wurde abgeschnitten.");
  }
}

export interface StructuredRequest<T extends z.ZodType> {
  system: string;
  /** Großer, unveränderlicher Kontext (z. B. Artikeltext) – wird gecacht. */
  context?: string;
  prompt: string;
  schema: T;
  maxTokens?: number;
  effort?: "low" | "medium" | "high";
  /** Zusätzliche Folgenachrichten (z. B. Korrekturhinweise). */
  followUps?: BetaMessageParam[];
}

/** Von der API im Antwortschema nicht unterstützte Angaben (Zod prüft sie danach trotzdem). */
const UNSUPPORTED = new Set(["minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf", "minLength", "maxLength", "maxItems", "pattern"]);

function stripUnsupported(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripUnsupported);
  if (!node || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node)) {
    if (UNSUPPORTED.has(k)) continue;
    // minItems nur mit 0 oder 1 erlaubt
    if (k === "minItems" && typeof v === "number" && v > 1) continue;
    out[k] = stripUnsupported(v);
  }
  return out;
}

/** JSON-Schema für output_config.format – ohne Grenzen, die die API ablehnt (z. B. bei .int()). */
export function apiSchema(schema: z.ZodType): Record<string, unknown> {
  return stripUnsupported(z.toJSONSchema(schema, { target: "draft-7" })) as Record<string, unknown>;
}

/**
 * Strukturierte Ausgabe (JSON-Schema) mit Streaming, Prompt-Caching und
 * server-seitigem Fallback. Das Ergebnis wird zusätzlich mit Zod validiert.
 */
export async function structured<T extends z.ZodType>(req: StructuredRequest<T>): Promise<z.infer<T>> {
  const content: BetaTextBlockParam[] = [];
  if (req.context) {
    content.push({ type: "text", text: req.context, cache_control: { type: "ephemeral" } });
  }
  content.push({ type: "text", text: req.prompt });

  const stream = getClient().beta.messages.stream({
    model: model(),
    max_tokens: req.maxTokens ?? 16000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    system: [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }],
    output_config: {
      effort: req.effort ?? "medium",
      format: { type: "json_schema", schema: apiSchema(req.schema) },
    },
    messages: [{ role: "user", content }, ...(req.followUps ?? [])],
  });
  const message = await stream.finalMessage();
  assertUsable(message);
  const raw = textOf(message);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AiOutputError("Die KI-Antwort war kein gültiges JSON.");
  }
  const result = req.schema.safeParse(parsed);
  if (!result.success) throw new AiOutputError("Die KI-Antwort entsprach nicht dem erwarteten Format.");
  return result.data;
}

export function describeAiError(err: unknown): { message: string; status: number } {
  if (err instanceof AiUnavailableError) return { message: err.message, status: 503 };
  if (err instanceof AiRefusalError || err instanceof AiOutputError) return { message: err.message, status: 422 };
  if (err instanceof Anthropic.AuthenticationError) return { message: "Der Anthropic-API-Schlüssel ist ungültig.", status: 502 };
  if (err instanceof Anthropic.RateLimitError) return { message: "Zu viele KI-Anfragen – bitte kurz warten.", status: 429 };
  if (err instanceof Anthropic.APIConnectionError) return { message: "Keine Verbindung zur KI.", status: 502 };
  if (err instanceof Anthropic.APIError) {
    // Grund von Anthropic mit anzeigen (z. B. „prompt is too long“), sonst ist ein 400 nicht zu deuten
    const body = err.error as { error?: { message?: unknown } } | undefined;
    const detail = typeof body?.error?.message === "string" ? body.error.message.slice(0, 200) : "";
    return { message: `KI-Fehler (${err.status ?? "?"})${detail ? `: ${detail}` : "."}`, status: 502 };
  }
  return { message: "Unerwarteter Fehler bei der KI-Anfrage.", status: 500 };
}

/** Verständliche Fehlermeldung für die Oberfläche. */
export function friendlyError(err: unknown): string {
  if (err instanceof Anthropic.APIError || err instanceof AiUnavailableError || err instanceof AiRefusalError || err instanceof AiOutputError) {
    return describeAiError(err).message;
  }
  return err instanceof Error ? err.message : "Unbekannter Fehler.";
}
