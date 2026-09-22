import { Notice, Plugin, TFile, WorkspaceLeaf } from "obsidian";
import {
  AgendaCaptureSettings,
  AgendaCaptureSettingTab,
  DEFAULT_SETTINGS,
} from "./src/settings";
import { CaptureModal } from "./src/CaptureModal";
import { RosterModal } from "./src/RosterModal";
import { appendAgendaItem } from "./src/append";
import { parseAgendaClipperPayload } from "./src/clipper";
import { publishAgendaCenter } from "./src/publish";
import { loadRoster } from "./src/roster";
import { AGENDA_DASHBOARD_VIEW, AgendaDashboardView } from "./src/DashboardView";
import { AgendaLiveModal } from "./src/agenda-live/modal";

export default class AgendaCapturePlugin extends Plugin {
  settings: AgendaCaptureSettings = DEFAULT_SETTINGS;
  private agendaLiveModal?: AgendaLiveModal;

  async onload() {
    await this.loadSettings();
    this.registerView(AGENDA_DASHBOARD_VIEW, (leaf) => new AgendaDashboardView(leaf, this));
    const openCapture = (initialText = "") => this.openCaptureModal(initialText);

    this.addRibbonIcon("notebook-tabs", "Open Agenda Center", () => void this.activateDashboard());

    this.addCommand({
      id: "open-agenda-center",
      name: "Open Agenda Center",
      callback: () => void this.activateDashboard(),
    });

    this.addRibbonIcon("microphone", "Capture agenda item", () => openCapture());

    this.addCommand({
      id: "capture",
      name: "Capture agenda item",
      callback: () => openCapture(),
    });

    this.registerObsidianProtocolHandler("agenda-capture", (params) => {
      openCapture(String(params.text || ""));
    });
    this.registerObsidianProtocolHandler("fjg-agenda-clipper", async (params) => {
      await this.handleAgendaClipper(params);
    });

    this.addCommand({
      id: "manage-roster",
      name: "Manage agenda roster",
      callback: () => new RosterModal(this.app, this.settings.vaultSubfolder).open(),
    });

    const publishAgendas = async () => {
      try {
        if (!this.settings.agendaPublishEndpoint || !this.settings.agendaPublishToken) {
          new Notice("Configure Agenda Center publishing in Agenda Capture settings.", 8000);
          return;
        }
        new Notice("Publishing Agenda Center…");
        const result = await publishAgendaCenter(this.app, {
          subfolder: this.settings.vaultSubfolder,
          endpoint: this.settings.agendaPublishEndpoint,
          token: this.settings.agendaPublishToken,
        });
        new Notice(
          `Agenda Center published: ${result.agendaCount} agendas, ${result.openItemCount} open items.`,
          8000
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        new Notice(`Agenda publish failed: ${message}`, 10000);
        console.error("[Agenda Capture publisher]", error);
      }
    };

    this.addRibbonIcon("cloud-upload", "Publish Agenda Center", publishAgendas);

    this.addCommand({
      id: "publish-agenda-center",
      name: "Publish Agenda Center",
      callback: publishAgendas,
    });

    this.app.workspace.onLayoutReady(() => {
      this.recoverMissedAdvancedUriLaunch(() => openCapture());
    });

    this.registerEvent(this.app.vault.on("modify", (file) => {
      if (file.path.startsWith(`${this.settings.vaultSubfolder}/`)) this.refreshDashboard();
    }));

    this.addSettingTab(new AgendaCaptureSettingTab(this.app, this));
  }

  openCaptureModal(initialText = "", initialTeam = ""): void {
    new CaptureModal(this.app, this, initialText, initialTeam).open();
  }

  openLiveAgenda(selected: () => string): void {
    if (this.agendaLiveModal) return;
    this.agendaLiveModal = new AgendaLiveModal(this.app, this, selected, () => { this.agendaLiveModal = undefined; });
    this.agendaLiveModal.open();
  }

  async activateDashboard(): Promise<void> {
    let leaf: WorkspaceLeaf | undefined = this.app.workspace.getLeavesOfType(AGENDA_DASHBOARD_VIEW)[0];
    if (!leaf) {
      leaf = this.app.workspace.getLeaf("tab");
      await leaf.setViewState({ type: AGENDA_DASHBOARD_VIEW, active: true });
    }
    this.app.workspace.revealLeaf(leaf);
  }

  refreshDashboard(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(AGENDA_DASHBOARD_VIEW)) {
      const view = leaf.view;
      if (view instanceof AgendaDashboardView) void view.refresh();
    }
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
