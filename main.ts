import { Notice, Plugin, TFile } from "obsidian";
import {
  AgendaCaptureSettings,
  AgendaCaptureSettingTab,
  DEFAULT_SETTINGS,
} from "./src/settings";
import { CaptureModal } from "./src/CaptureModal";
import { RosterModal } from "./src/RosterModal";
import { appendAgendaItem } from "./src/append";
import { parseAgendaClipperPayload } from "./src/clipper";
import { loadRoster } from "./src/roster";

export default class AgendaCapturePlugin extends Plugin {
  settings: AgendaCaptureSettings = DEFAULT_SETTINGS;

  async onload() {
    await this.loadSettings();
    const openCapture = () => new CaptureModal(this.app, this).open();

    this.addRibbonIcon("microphone", "Capture agenda item", openCapture);

    this.addCommand({
      id: "capture",
      name: "Capture agenda item",
      callback: openCapture,
    });

    this.registerObsidianProtocolHandler("agenda-capture", openCapture);
    this.registerObsidianProtocolHandler("fjg-agenda-clipper", async (params) => {
      await this.handleAgendaClipper(params);
    });

    this.addCommand({
      id: "manage-roster",
      name: "Manage agenda roster",
      callback: () => new RosterModal(this.app, this.settings.vaultSubfolder).open(),
    });

    this.app.workspace.onLayoutReady(() => {
      this.recoverMissedAdvancedUriLaunch(openCapture);
    });

    this.addSettingTab(new AgendaCaptureSettingTab(this.app, this));
  }

  private recoverMissedAdvancedUriLaunch(openCapture: () => void) {
    const advancedUri = (this.app as any).plugins?.getPlugin?.("obsidian-advanced-uri");
    if (advancedUri?.lastParameters?.commandid === `${this.manifest.id}:capture`) {
      setTimeout(openCapture, 250);
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  private async handleAgendaClipper(params: Record<string, string>) {
    try {
      const roster = await loadRoster(this.app, this.settings.vaultSubfolder);
      const item = parseAgendaClipperPayload(
        String(params.payload || ""),
        roster.members
      );
      const savedPath = await appendAgendaItem(
        this.app,
        this.settings.vaultSubfolder,
        item
      );

      this.settings.lastUsedTeamMember = item.team;
      await this.saveSettings();
      new Notice(`Agenda item saved for ${item.team}.`);

      if (this.settings.openSavedFileAfterSave) {
        const file = this.app.vault.getAbstractFileByPath(savedPath);
        if (file instanceof TFile) {
          await this.app.workspace.getLeaf(false).openFile(file);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      new Notice(`Agenda clip failed: ${message}`, 10000);
      console.error("[Agenda Capture clipper]", error);
    }
  }
}
