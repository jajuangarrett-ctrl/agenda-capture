import { App, normalizePath, TFile } from "obsidian";
import { ensureFolder } from "./roster";
import { formatDateHeading, insertBulletUnderHeading, renderBullet } from "./markdown";
import type { AgendaItem } from "./types";

export async function appendAgendaItem(
  app: App,
  subfolder: string,
  item: AgendaItem,
  today: Date = new Date()
): Promise<void> {
  await ensureFolder(app, subfolder);
  const path = normalizePath(`${subfolder}/${item.team}.md`);
  const heading = formatDateHeading(today);
  const bullet = renderBullet(item);
  const file = app.vault.getAbstractFileByPath(path);

  if (file instanceof TFile) {
    const current = await app.vault.read(file);
    const next = insertBulletUnderHeading(current, heading, bullet);
    await app.vault.modify(file, next);
  } else {
    await app.vault.create(path, `## ${heading}\n${bullet}`);
  }
}
