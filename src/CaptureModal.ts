import { App, Modal, Notice, Setting } from "obsidian";
import { loadRoster } from "./roster";
import { appendAgendaItem } from "./append";
import type { Priority } from "./types";
import type AgendaCapturePlugin from "../main";

export class CaptureModal extends Modal {
  private plugin: AgendaCapturePlugin;
  private team = "";
  private text = "";
  private priority: Priority = "Standard";
  private hashtag = "";

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

    let textArea: HTMLTextAreaElement | null = null;
    new Setting(contentEl)
      .setName("Item")
      .setDesc("Use the keyboard mic to dictate, or type. Voice cleanup pipeline arrives Day 4.")
      .addTextArea((t) => {
        textArea = t.inputEl;
        t.inputEl.rows = 4;
        t.inputEl.style.width = "100%";
        t.onChange((v) => {
          this.text = v;
        });
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

    setTimeout(() => textArea?.focus(), 0);
  }

  private async save(forceAnother: boolean) {
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
    this.contentEl.empty();
  }
}
