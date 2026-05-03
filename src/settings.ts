import { App, PluginSettingTab, Setting } from "obsidian";
import type AgendaCapturePlugin from "../main";

export interface AgendaCaptureSettings {
  openaiApiKey: string;
  anthropicApiKey: string;
  vaultSubfolder: string;
  showAnotherAfterSave: boolean;
  lastUsedTeamMember: string;
  customAcronyms: string;
}

export const DEFAULT_SETTINGS: AgendaCaptureSettings = {
  openaiApiKey: "",
  anthropicApiKey: "",
  vaultSubfolder: "05 People/Agenda Items",
  showAnotherAfterSave: true,
  lastUsedTeamMember: "",
  customAcronyms: "CalWORKs, VPSS, FJG",
};

export class AgendaCaptureSettingTab extends PluginSettingTab {
  plugin: AgendaCapturePlugin;

  constructor(app: App, plugin: AgendaCapturePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Agenda Capture" });

    new Setting(containerEl)
      .setName("Vault subfolder")
      .setDesc("Folder where per-team-member agenda files live (relative to vault root).")
      .addText((t) =>
        t
          .setPlaceholder("05 People/Agenda Items")
          .setValue(this.plugin.settings.vaultSubfolder)
          .onChange(async (v) => {
            this.plugin.settings.vaultSubfolder = v.trim() || DEFAULT_SETTINGS.vaultSubfolder;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Show another after save")
      .setDesc("After saving an item, immediately re-open the capture modal with the same team preselected.")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.showAnotherAfterSave).onChange(async (v) => {
          this.plugin.settings.showAnotherAfterSave = v;
          await this.plugin.saveSettings();
        })
      );

    containerEl.createEl("h3", { text: "Voice transcription" });

    new Setting(containerEl)
      .setName("OpenAI API key")
      .setDesc("Used by Whisper to transcribe voice captures. Stored locally in plugin data.")
      .addText((t) => {
        t.inputEl.type = "password";
        t
          .setPlaceholder("sk-...")
          .setValue(this.plugin.settings.openaiApiKey)
          .onChange(async (v) => {
            this.plugin.settings.openaiApiKey = v.trim();
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Anthropic API key")
      .setDesc("Used by Claude Haiku to clean up transcripts (fix grammar, preserve names).")
      .addText((t) => {
        t.inputEl.type = "password";
        t
          .setPlaceholder("sk-ant-...")
          .setValue(this.plugin.settings.anthropicApiKey)
          .onChange(async (v) => {
            this.plugin.settings.anthropicApiKey = v.trim();
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Custom acronyms")
      .setDesc("Comma-separated list of acronyms and proper nouns the cleanup pass should preserve verbatim.")
      .addText((t) =>
        t
          .setPlaceholder("CalWORKs, VPSS, FJG")
          .setValue(this.plugin.settings.customAcronyms)
          .onChange(async (v) => {
            this.plugin.settings.customAcronyms = v;
            await this.plugin.saveSettings();
          })
      );
  }
}
