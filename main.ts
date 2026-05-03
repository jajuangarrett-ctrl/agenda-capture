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

    this.addCommand({
      id: "capture",
      name: "Capture agenda item",
      callback: () => new CaptureModal(this.app, this).open(),
    });

    this.addCommand({
      id: "manage-roster",
      name: "Manage agenda roster",
      callback: () => new RosterModal(this.app, this.settings.vaultSubfolder).open(),
    });

    this.addSettingTab(new AgendaCaptureSettingTab(this.app, this));
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
