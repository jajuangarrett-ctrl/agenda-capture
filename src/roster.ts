import { App, normalizePath, TFile } from "obsidian";
import type { Roster } from "./types";

const ROSTER_FILENAME = "_roster.json";

export function rosterPath(subfolder: string): string {
  return normalizePath(`${subfolder}/${ROSTER_FILENAME}`);
}

export async function loadRoster(app: App, subfolder: string): Promise<Roster> {
  const path = rosterPath(subfolder);
  const file = app.vault.getAbstractFileByPath(path);
  if (file instanceof TFile) {
    const raw = await app.vault.read(file);
    try {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.members)) {
        return { members: parsed.members.filter((m: unknown) => typeof m === "string") };
      }
    } catch {
      // fall through to empty
    }
  }
  return { members: [] };
}

export async function saveRoster(app: App, subfolder: string, roster: Roster): Promise<void> {
  await ensureFolder(app, subfolder);
  const path = rosterPath(subfolder);
  const content = JSON.stringify(roster, null, 2);
  const existing = app.vault.getAbstractFileByPath(path);
  if (existing instanceof TFile) {
    await app.vault.modify(existing, content);
  } else {
    await app.vault.create(path, content);
  }
}

export async function ensureFolder(app: App, subfolder: string): Promise<void> {
  const path = normalizePath(subfolder);
  if (!app.vault.getAbstractFileByPath(path)) {
    await app.vault.createFolder(path);
  }
}
