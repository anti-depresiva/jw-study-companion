import { describe, expect, it } from "vitest";
import { z } from "zod";
import { apiSchema } from "@/lib/ai/client";

describe("apiSchema", () => {
  it("entfernt Grenzen, die die API im Antwortschema ablehnt", () => {
    const s = apiSchema(
      z.strictObject({
        answers: z.array(z.strictObject({ index: z.number().int(), answer: z.string().max(10) })).min(2),
      }),
    );
    const json = JSON.stringify(s);
    expect(json).not.toMatch(/minimum|maximum|maxLength|minItems/);
    expect(json).toContain('"integer"');
    expect(json).toContain('"additionalProperties":false');
  });
});
