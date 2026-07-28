import { describe, expect, it } from "vitest";
import { parseAgendaClipperPayload } from "./clipper";

const roster = ["Leyla Recinos", "SSS Team"];

function encode(payload: unknown): string {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

describe("agenda clipper protocol payload", () => {
  it("accepts a valid roster member and normalizes text and hashtag", () => {
    const item = parseAgendaClipperPayload(
      encode({
        version: 1,
        action: "create-agenda-item",
        team: "Leyla Recinos",
        text: " Discuss\nfall   outreach ",
        priority: "High Impact",
        hashtag: " #follow up! ",
      }),
      roster
    );

    expect(item).toEqual({
      team: "Leyla Recinos",
      text: "Discuss fall outreach",
      priority: "High Impact",
      hashtag: "follow-up",
    });
  });

  it("rejects names outside the authoritative roster", () => {
    expect(() =>
      parseAgendaClipperPayload(
        encode({
          version: 1,
          action: "create-agenda-item",
          team: "Unknown Person",
          text: "Review outreach",
          priority: "Standard",
        }),
        roster
      )
    ).toThrow("not in the Agenda Capture roster");
  });

  it("rejects unsafe team member paths even if supplied in the roster", () => {
    expect(() =>
      parseAgendaClipperPayload(
        encode({
          version: 1,
          action: "create-agenda-item",
          team: "../Unsafe",
          text: "Review outreach",
          priority: "Standard",
        }),
        ["../Unsafe"]
      )
    ).toThrow("team member name is invalid");
  });

  it("rejects malformed and unsupported payloads", () => {
    expect(() => parseAgendaClipperPayload("not-base64", roster)).toThrow(
      "could not be decoded"
    );
    expect(() =>
      parseAgendaClipperPayload(
        encode({
          version: 2,
          action: "create-agenda-item",
          team: "SSS Team",
          text: "Review outreach",
          priority: "Standard",
        }),
        roster
      )
    ).toThrow("Unsupported");
  });
});

