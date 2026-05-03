import { App, Modal, Notice, Setting } from "obsidian";
import { loadRoster, saveRoster } from "./roster";

export class RosterModal extends Modal {
  private subfolder: string;
  private members: string[] = [];

  constructor(app: App, subfolder: string) {
    super(app);
    this.subfolder = subfolder;
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Manage agenda roster" });

    const roster = await loadRoster(this.app, this.subfolder);
    this.members = roster.members.slice();

    const listEl = contentEl.createDiv({ cls: "agenda-roster-list" });
    this.renderList(listEl);

    let nameInput: HTMLInputElement | null = null;
    new Setting(contentEl)
      .setName("Add team member")
      .addText((t) => {
        nameInput = t.inputEl;
        t.setPlaceholder("Full name");
        t.inputEl.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (nameInput) this.add(nameInput.value, listEl, nameInput);
          }
        });
      })
      .addButton((b) =>
        b
          .setButtonText("Add")
          .setCta()
          .onClick(() => {
            if (nameInput) this.add(nameInput.value, listEl, nameInput);
          })
      );
  }

  private renderList(listEl: HTMLElement) {
    listEl.empty();
    if (this.members.length === 0) {
      listEl.createEl("p", {
        text: "Roster is empty. Add your first team member below.",
        cls: "agenda-roster-empty",
      });
      return;
    }
    const sorted = this.members.slice().sort((a, b) => a.localeCompare(b));
    sorted.forEach((name) => {
      const row = listEl.createDiv({ cls: "agenda-roster-row" });
      row.createSpan({ text: name });
      const del = row.createEl("button", { text: "Remove", cls: "mod-warning" });
      del.addEventListener("click", async () => {
        this.members = this.members.filter((m) => m !== name);
        await this.persist();
        this.renderList(listEl);
      });
    });
  }

  private async add(rawName: string, listEl: HTMLElement, input: HTMLInputElement) {
    const name = rawName.trim();
    if (!name) return;
    if (this.members.some((m) => m.toLowerCase() === name.toLowerCase())) {
      new Notice(`${name} is already on the roster.`);
      return;
    }
    this.members.push(name);
    await this.persist();
    input.value = "";
    input.focus();
    this.renderList(listEl);
  }

  private async persist() {
    await saveRoster(this.app, this.subfolder, { members: this.members });
  }

  onClose() {
    this.contentEl.empty();
  }
}
