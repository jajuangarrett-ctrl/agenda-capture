import { CaptureVoice, captureKey, settingFields } from "./capture-live/panel";
import { App, ButtonComponent, Modal, Notice, Setting, TFile } from "obsidian";
import { loadRoster } from "./roster";
import { appendAgendaItem } from "./append";
import { splitAgendaItems } from "./markdown";
import {
  cleanupTranscript,
  startRecording,
  transcribeWhisper,
  type VoiceRecorder,
} from "./transcribe";
import type { Priority } from "./types";
import type AgendaCapturePlugin from "../main";

export class CaptureModal extends Modal {
  private voice?: CaptureVoice;
  private closed = false;
  private plugin: AgendaCapturePlugin;
  private team = "";
  private text = "";
  private priority: Priority = "Standard";
  private hashtag = "";
  private initialTeam = "";

  private textArea: HTMLTextAreaElement | null = null;
  private recordButton: ButtonComponent | null = null;
  private recorder: VoiceRecorder | null = null;
  private recording = false;
  private busy = false;

  constructor(app: App, plugin: AgendaCapturePlugin, initialText = "", initialTeam = "") {
    super(app);
    this.plugin = plugin;
    this.text = initialText.trim();
    this.initialTeam = initialTeam.trim();
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Capture agenda item" });

    const roster = await loadRoster(this.app, this.plugin.settings.vaultSubfolder);
    if (roster.members.length === 0) {
      contentEl.createEl("p", {
        text: 'No team members yet. Run the "Manage agenda roster" command to add some.',
        cls: "agenda-empty-roster",
      });
      new Setting(contentEl).addButton((b) =>
        b.setButtonText("Close").onClick(() => this.close())
      );
      return;
    }

    const last = this.plugin.settings.lastUsedTeamMember;
    this.team = roster.members.includes(this.initialTeam)
      ? this.initialTeam
      : roster.members.includes(last) ? last : roster.members[0];

    this.voice = new CaptureVoice(contentEl, this.app, "Agenda items — one item per line; multiple items may be prepared in one conversation", {
      fields: () => settingFields(contentEl, ['Team member', 'Agenda items']),
      ready: () => !this.closed && !this.busy && !this.recording,
      save: async () => !!(await this.save(false))
    }, () => captureKey(this.app, this.plugin.settings.openaiApiKey));

    new Setting(contentEl).setName("Team member").addDropdown((d) => {
      roster.members
        .slice()
        .sort((a, b) => a.localeCompare(b))
        .forEach((m) => d.addOption(m, m));
      d.setValue(this.team);
      d.onChange((v) => {
        this.team = v;
      });
    });

    new Setting(contentEl)
      .setName("Agenda items")
      .setDesc("Add one item per line. You can dictate several items in one conversation and save them together.")
      .addTextArea((t) => {
        this.textArea = t.inputEl;
        t.inputEl.rows = 4;
        t.inputEl.style.width = "100%";
        t.setValue(this.text);
        t.onChange((v) => {
          this.text = v;
        });
      });

    new Setting(contentEl)
      .setName("Voice capture")
      .addButton((b) => {
        this.recordButton = b;
        b.setButtonText("Record").onClick(() => this.toggleRecord());
      });

    new Setting(contentEl).setName("Priority").addDropdown((d) => {
      d.addOption("Standard", "Standard");
      d.addOption("High Impact", "High Impact");
      d.setValue(this.priority);
      d.onChange((v) => {
        this.priority = v as Priority;
      });
    });

    new Setting(contentEl).setName("Hashtag (optional)").addText((t) => {
      t.setPlaceholder("#followup");
      t.setValue(this.hashtag);
      t.onChange((v) => {
        this.hashtag = v.trim();
      });
    });

    new Setting(contentEl)
      .addButton((b) =>
        b
          .setButtonText("Save")
          .setCta()
          .onClick(() => this.save(false))
      )
      .addButton((b) =>
        b.setButtonText("Save & capture another").onClick(() => this.save(true))
      );

    setTimeout(() => this.textArea?.focus(), 0);
  }

  private async toggleRecord() {
    if (this.busy || this.voice?.active || !this.recordButton) return;

    if (!this.recording) {
      const apiKey = await captureKey(this.app, this.plugin.settings.openaiApiKey);
      if (!apiKey) {
        new Notice("Add your OpenAI API key in FJG Objective Manager or Agenda Capture settings before recording.");
        return;
      }
      try {
        this.recorder = await startRecording();
        this.recording = true;
        this.recordButton.setButtonText("Stop");
        this.recordButton.setWarning();
      } catch (e) {
        new Notice(`Microphone error: ${e instanceof Error ? e.message : String(e)}`);
      }
      return;
    }

    this.recording = false;
    this.busy = true;
    this.recordButton.setDisabled(true);
    this.recordButton.removeCta();
    this.recordButton.setButtonText("Transcribing...");

    try {
      const audio = await this.recorder!.stop();
      const apiKey = await captureKey(this.app, this.plugin.settings.openaiApiKey);
      let transcript = await transcribeWhisper(audio, apiKey);

      if (this.plugin.settings.anthropicApiKey && transcript) {
        this.recordButton.setButtonText("Cleaning up...");
        const roster = await loadRoster(this.app, this.plugin.settings.vaultSubfolder);
        transcript = await cleanupTranscript(
          transcript,
          this.plugin.settings.anthropicApiKey,
          {
            rosterNames: roster.members,
            acronyms: this.plugin.settings.customAcronyms,
          }
        );
      }

      this.text = mergeTranscript(this.text, transcript);
      if (this.textArea) {
        this.textArea.value = this.text;
        this.textArea.focus();
      }
    } catch (e) {
      new Notice(`Voice capture failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      this.busy = false;
      this.recorder = null;
      if (this.recordButton) {
        this.recordButton.setDisabled(false);
        this.recordButton.setButtonText("Record");
      }
    }
  }

  private async save(forceAnother: boolean) {
    if (this.busy || this.recording || this.closed) {
      new Notice("Voice capture still running.");
      return;
    }
    const items = splitAgendaItems(this.text);
    if (!items.length) {
      new Notice("Add at least one agenda item before saving.");
      return;
    }

    this.busy = true;
    let savedPath = "";
    try {
      for (const text of [...items].reverse()) {
        savedPath = await appendAgendaItem(this.app, this.plugin.settings.vaultSubfolder, {
          team: this.team,
          text,
          priority: this.priority,
          hashtag: this.hashtag || undefined,
        });
      }
    } catch (e) {
      this.busy = false;
      new Notice(`Save failed: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }

    this.plugin.settings.lastUsedTeamMember = this.team;
    await this.plugin.saveSettings();

    new Notice(items.length === 1 ? `Saved to ${savedPath}.` : `Saved ${items.length} agenda items to ${savedPath}.`);

    const reopen = forceAnother || this.plugin.settings.showAnotherAfterSave;
    this.close();
    if (this.plugin.settings.openSavedFileAfterSave) {
      await this.openSavedFile(savedPath);
    }
    if (reopen) {
      setTimeout(() => new CaptureModal(this.app, this.plugin).open(), 200);
    }
    return savedPath;
  }

  private async openSavedFile(path: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) return;
    await this.app.workspace.getLeaf(false).openFile(file);
  }

  onClose() {
    this.closed = true; this.voice?.close();
    if (this.recorder) {
      this.recorder.cancel();
      this.recorder = null;
    }
    this.contentEl.empty();
  }
}

function mergeTranscript(existing: string, addition: string): string {
  const a = existing.trim();
  const b = addition.trim();
  if (!a) return b;
  if (!b) return a;
  return `${a} ${b}`;
}
