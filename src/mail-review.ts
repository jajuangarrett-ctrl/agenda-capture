import type { Priority } from "./types";

const MAX_ENCODED_PAYLOAD_LENGTH = 60_000;
const MAX_ITEM_LENGTH = 2_000;

export interface AgendaMailReviewDraft {
  team: string;
  text: string;
  priority: Priority;
  hashtag: string;
}

interface RawAgendaMailPayload {
  version?: unknown;
  action?: unknown;
  team?: unknown;
  text?: unknown;
  priority?: unknown;
  hashtag?: unknown;
}

export function parseAgendaMailReviewPayload(
  encoded: string,
  rosterMembers: readonly string[]
): AgendaMailReviewDraft {
  if (!encoded) throw new Error("No Mail agenda draft was provided.");
  if (encoded.length > MAX_ENCODED_PAYLOAD_LENGTH) {
    throw new Error("The Mail agenda draft is too large.");
  }
  const value = decodePayload(encoded);
  if (value.version !== 1 || value.action !== "review-agenda") {
    throw new Error("Unsupported Mail agenda draft.");
  }

  const text = cleanInline(value.text).slice(0, MAX_ITEM_LENGTH);
  if (!text) throw new Error("The Mail agenda draft has no agenda item.");
  const requestedTeam = cleanInline(value.team);
  return {
    team: rosterMembers.find((member) => member.toLocaleLowerCase() === requestedTeam.toLocaleLowerCase()) || "",
    text,
    priority: value.priority === "High Impact" ? "High Impact" : "Standard",
    hashtag: cleanHashtag(value.hashtag)
  };
}

function decodePayload(encoded: string): RawAgendaMailPayload {
  try {
    const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
    const bytes = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    return parsed as RawAgendaMailPayload;
  } catch {
    throw new Error("The Mail agenda draft could not be decoded.");
  }
}

function cleanHashtag(value: unknown): string {
  return cleanInline(value)
    .replace(/^#+/, "")
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9_/-]/g, "")
    .replace(/^\/+|\/+$/g, "")
    .slice(0, 80);
}

function cleanInline(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}
