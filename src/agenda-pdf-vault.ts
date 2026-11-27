import { normalizePath, TFolder, type TFile, type Vault } from 'obsidian';
import { agendaPdfFilename } from './agenda-pdf';

export async function saveAgendaPdf(vault: Vault, agendaFolder: string, title: string, date: string, bytes: ArrayBuffer): Promise<TFile> {
  const dir = normalizePath(`${agendaFolder}/Agenda Exports`);
  if (!vault.getAbstractFileByPath(dir)) {
    try { await vault.createFolder(dir); }
    catch (error) { if (!(vault.getAbstractFileByPath(dir) instanceof TFolder)) throw error; }
  }
  if (!(vault.getAbstractFileByPath(dir) instanceof TFolder)) throw new Error('Agenda Exports is not a folder.');
  const name = agendaPdfFilename(title, date);
  for (let attempt = 1; attempt <= 1000; attempt += 1) {
    const path = `${dir}/${name}${attempt === 1 ? '' : ` (${attempt})`}.pdf`;
    if (vault.getAbstractFileByPath(path) || await vault.adapter.exists(path)) continue;
    try { return await vault.createBinary(path, bytes); }
    catch (error) {
      if (!vault.getAbstractFileByPath(path) && !await vault.adapter.exists(path)) throw error;
    }
  }
  throw new Error('Too many exports with that name. Change the agenda title and try again.');
}
