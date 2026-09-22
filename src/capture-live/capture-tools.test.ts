import { describe, expect, it } from "vitest";
import { CaptureTools, type CapturePort } from "./capture-tools";

describe("CaptureTools agenda context", () => {
  it("returns current read-only agenda contents", async () => {
    const port: CapturePort = {
      fields: () => [],
      ready: () => true,
      save: async () => true,
      context: async () => ({ agenda: "SSS Team", open_items: [{ title: "Budget update" }] }),
    };
    const tools = new CaptureTools(port, () => true);
    await expect(tools.execute("get_agenda", "{}")).resolves.toEqual({
      agenda: "SSS Team",
      open_items: [{ title: "Budget update" }],
    });
  });
});
