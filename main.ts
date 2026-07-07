import { Plugin } from "obsidian";
import {
  AgendaCaptureSettings,
  AgendaCaptureSettingTab,
  DEFAULT_SETTINGS,
} from "./src/settings";
import { CaptureModal } from "./src/CaptureModal";
import { RosterModal } from "./src/RosterModal";

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
}
