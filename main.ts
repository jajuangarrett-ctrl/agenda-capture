import { Plugin, Notice } from "obsidian";

export default class AgendaCapturePlugin extends Plugin {
  async onload() {
    console.log("agenda-capture: loaded");

    this.addCommand({
      id: "capture",
      name: "Capture agenda item",
      callback: () => {
        new Notice("Agenda Capture scaffold loaded. Modal coming in Day 2.");
      },
    });

    this.addCommand({
      id: "manage-roster",
      name: "Manage agenda roster",
      callback: () => {
        new Notice("Agenda Capture scaffold loaded. Roster modal coming in Day 2.");
      },
    });
  }

  async onunload() {
    console.log("agenda-capture: unloaded");
  }
}
