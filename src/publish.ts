import { App, normalizePath, requestUrl, TFile } from "obsidian";
import { loadRoster } from "./roster";
import {
  AgendaPublishPayload,
  createAgendaPublishPayload,
  getAgendaKind,
  parseOpenAgendaTasks,
  simpleHash,
} from "./publishData";

interface PublishOptions {
  subfolder: string;
  endpoint: string;
  token: string;
}

interface PublishResult {
  agendaCount: number;
  openItemCount: number;
  publishedAt: string;
}

export async function buildAgendaPublishPayload(
  app: App,
  subfolder: string
): Promise<AgendaPublishPayload> {
  const roster = await loadRoster(app, subfolder);
  const members = [];

  for (const name of roster.members) {
    const fileName = `${name}.md`;
    const filePath = normalizePath(`${subfolder}/${fileName}`);
    const abstractFile = app.vault.getAbstractFileByPath(filePath);
    const markdown = abstractFile instanceof TFile
      ? await app.vault.cachedRead(abstractFile)
      : "";
    members.push({
      name,
      kind: getAgendaKind(name),
      fileName,
      modified: abstractFile instanceof TFile
        ? new Date(abstractFile.stat.mtime).toISOString()
        : new Date(0).toISOString(),
      shortHash: simpleHash(markdown).slice(0, 12),
      tasks: parseOpenAgendaTasks(markdown, name),
    });
  }

  return createAgendaPublishPayload(subfolder, members);
}

export async function publishAgendaCenter(
  app: App,
  options: PublishOptions
): Promise<PublishResult> {
  const payload = await buildAgendaPublishPayload(app, options.subfolder);
  const response = await requestUrl({
    url: options.endpoint,
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    throw: false,
  });

  if (response.status !== 200) {
    const detail = response.json?.error || response.text || `HTTP ${response.status}`;
    throw new Error(String(detail));
  }

  return {
    agendaCount: payload.summary.agendaCount,
    openItemCount: payload.summary.openItemCount,
    publishedAt: String(response.json?.publishedAt || payload.generatedAt),
  };
}
