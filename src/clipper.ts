import type { AgendaItem, Priority } from "./types";

interface RawAgendaClipperPayload {
  version?: unknown;
  action?: unknown;
  team?: unknown;
  text?: unknown;
  priority?: unknown;
  hashtag?: unknown;
}

const MAX_ENCODED_PAYLOAD_LENGTH = 60_000;
const MAX_ITEM_LENGTH = 10_000;

export function parseAgendaClipperPayload(
  encoded: string,
  rosterMembers: string[]
): AgendaItem {
  if (!encoded) throw new Error("No agenda clipper payload was provided.");
  if (encoded.length > MAX_ENCODED_PAYLOAD_LENGTH) {
    throw new Error("The agenda clipper payload is too large.");
  }

  const payload = decodePayload(encoded);
  if (payload.version !== 1 || payload.action !== "create-agenda-item") {
    throw new Error("Unsupported agenda clipper payload.");
  }

  const team = cleanTeam(payload.team);
  if (!rosterMembers.includes(team)) {
    throw new Error(`"${team}" is not in the Agenda Capture roster.`);
  }

  const text = cleanItemText(payload.text);
  const priority = cleanPriority(payload.priority);
  const hashtag = cleanHashtag(payload.hashtag);

  return {
    team,
    text,
    priority,
    ...(hashtag ? { hashtag } : {}),
  };
}

function decodePayload(encoded: string): RawAgendaClipperPayload {
  try {
    const base64 = encoded
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(encoded.length / 4) * 4, "=");
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error();
    }
    return parsed as RawAgendaClipperPayload;
  } catch {
    throw new Error("The agenda clipper payload could not be decoded.");
  }
}

function cleanTeam(value: unknown): string {
  if (typeof value !== "string") throw new Error("No team member was provided.");
  const team = value.replace(/\s+/g, " ").trim();
  if (!team) throw new Error("No team member was provided.");
  if (
    team.length > 120 ||
    team === "." ||
    team === ".." ||
    /[/\\\u0000-\u001f]/.test(team)
  ) {
    throw new Error("The team member name is invalid.");
  }
  return team;
}

function cleanItemText(value: unknown): string {
  if (typeof value !== "string") throw new Error("No agenda item was provided.");
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) throw new Error("No agenda item was provided.");
  if (text.length > MAX_ITEM_LENGTH) throw new Error("The agenda item is too long.");
  return text;
}

function cleanPriority(value: unknown): Priority {
  if (value === "Standard" || value === "High Impact") return value;
  throw new Error("The agenda priority is invalid.");
}

function cleanHashtag(value: unknown): string {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string") throw new Error("The agenda hashtag is invalid.");
  return value
    .trim()
    .replace(/^#+/, "")
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9_/-]/g, "")
    .replace(/^\/+|\/+$/g, "")
    .slice(0, 80);
}

