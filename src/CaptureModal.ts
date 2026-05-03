import { App, ButtonComponent, Modal, Notice, Setting } from "obsidian";
import { loadRoster } from "./roster";
import { appendAgendaItem } from "./append";
import {
  cleanupTranscript,
  startRecording,
  transcribeWhisper,
  type VoiceRecorder,
} from "./transcribe";
import type { Priority } from "./types";
import type AgendaCapturePlugin from "../main";

export class CaptureModal extends Modal {
  private plugin: AgendaCapturePlugin;
  private team = "";
  private text = "";
  private priority: Priority = "Standard";
  private hashtag = "";

  private textArea: HTMLTextAreaElement | null = null;
  private recordButton: ButtonComponent | null = null;
  private recorder: VoiceRecorder | null = null;
  private recording = false;
  private busy = false;

  constructor(app: App, plugin: AgendaCapturePlugin) {
    super(app);
    this.plugin = plugin;
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
    this.team = roster.members.includes(last) ? last : roster.members[0];

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
      .setName("Item")
      .setDesc("Tap Record to dictate, or type below. Cleanup runs automatically when both API keys are set.")
      .addTextArea((t) => {
        this.textArea = t.inputEl;
        t.inputEl.rows = 4;
        t.inputEl.style.width = "100%";
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
    if (this.busy || !this.recordButton) return;

    if (!this.recording) {
      if (!this.plugin.settings.openaiApiKey) {
        new Notice("Add your OpenAI API key in plugin settings before recording.");
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
      let transcript = await transcribeWhisper(
        audio,
        this.plugin.settings.openaiApiKey
      );

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
    if (this.busy) {
      new Notice("Voice capture still running.");
      return;
    }
    const text = this.text.trim();
    if (!text) {
      new Notice("Add some text before saving.");
      return;
    }

    try {
      await appendAgendaItem(this.app, this.plugin.settings.vaultSubfolder, {
        team: this.team,
        text,
        priority: this.priority,
        hashtag: this.hashtag || undefined,
      });
    } catch (e) {
      new Notice(`Save failed: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }

    this.plugin.settings.lastUsedTeamMember = this.team;
    await this.plugin.saveSettings();

    new Notice(`Saved to ${this.team}.md`);

    const reopen = forceAnother || this.plugin.settings.showAnotherAfterSave;
    this.close();
    if (reopen) {
      setTimeout(() => new CaptureModal(this.app, this.plugin).open(), 200);
    }
  }

  onClose() {
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
