import { App, normalizePath, TFile } from "obsidian";
import { ensureFolder } from "./roster";
import { insertBulletAtTop, renderBullet } from "./markdown";
import type { AgendaItem } from "./types";

export async function appendAgendaItem(
  app: App,
  subfolder: string,
  item: AgendaItem
): Promise<string> {
  await ensureFolder(app, subfolder);
  const path = normalizePath(`${subfolder}/${item.team}.md`);
  const bullet = renderBullet(item);
  const file = app.vault.getAbstractFileByPath(path);

  if (file instanceof TFile) {
    const current = await app.vault.read(file);
    const next = insertBulletAtTop(current, bullet);
    await app.vault.modify(file, next);
    return path;
  } else {
    await app.vault.create(path, bullet);
    return path;
  }
}
