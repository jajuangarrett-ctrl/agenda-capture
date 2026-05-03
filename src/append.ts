import { App, normalizePath, TFile } from "obsidian";
import { ensureFolder } from "./roster";
import type { AgendaItem } from "./types";

export async function appendAgendaItem(
  app: App,
  subfolder: string,
  item: AgendaItem
): Promise<void> {
  // Day-3 work fills in find-or-create heading logic. Day-2 stub just appends
  // a bullet to the end of the file so the modal can be exercised end-to-end.
  await ensureFolder(app, subfolder);
  const path = normalizePath(`${subfolder}/${item.team}.md`);
  const bullet = renderBullet(item);
  const existing = app.vault.getAbstractFileByPath(path);
  if (existing instanceof TFile) {
    await app.vault.append(existing, bullet);
  } else {
    await app.vault.create(path, bullet);
  }
}

export function renderBullet(item: AgendaItem): string {
  const tagPart = item.hashtag
    ? ` ${item.hashtag.startsWith("#") ? item.hashtag : `#${item.hashtag}`}`
    : "";
  return `- [ ] ${item.text}${tagPart} [${item.priority}]\n`;
}
