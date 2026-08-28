import { describe, expect, test } from "vitest";
import { parseAgendaMailReviewPayload } from "./mail-review";

function encode(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

describe("Mail agenda review payload", () => {
  test("prefills only roster-backed team and supported fields", () => {
    expect(parseAgendaMailReviewPayload(encode({
      version: 1,
      action: "review-agenda",
      team: "sss team",
      text: "Discuss the August meeting agenda.",
      priority: "High Impact",
      hashtag: "#Follow Up!"
    }), ["SSS Team"])).toEqual({
      team: "SSS Team",
      text: "Discuss the August meeting agenda.",
      priority: "High Impact",
      hashtag: "Follow-Up"
    });
  });

  test("drops invented roster members and defaults invalid priority", () => {
    const draft = parseAgendaMailReviewPayload(encode({
      version: 1,
      action: "review-agenda",
      team: "Invented Person",
      text: "Review the proposal.",
      priority: "Emergency"
    }), ["SSS Team"]);
    expect(draft.team).toBe("");
    expect(draft.priority).toBe("Standard");
  });

  test("rejects malformed and immediate-write payloads", () => {
    expect(() => parseAgendaMailReviewPayload("not-json", [])).toThrow("could not be decoded");
    expect(() => parseAgendaMailReviewPayload(encode({ version: 1, action: "create-agenda-item" }), []))
      .toThrow("Unsupported Mail agenda draft");
  });
});
