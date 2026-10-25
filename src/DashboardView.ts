import { mergeObjectiveAgendas } from "./objective-agendas";
import { ItemView, Notice, setIcon, TFile, WorkspaceLeaf } from "obsidian";
import type AgendaCapturePlugin from "../main";
import { getAgendaKind, parseOpenAgendaTasks, type PublishedAgendaMember } from "./publishData";
import { loadRoster } from "./roster";
import { agendaMarkup, printAgendaInPlace, AGENDA_DOCUMENT_CSS } from './agenda-template';
import { editAgendaBlock } from './agenda-document';

export const AGENDA_DASHBOARD_VIEW = "fjg-agenda-dashboard";

export class AgendaDashboardView extends ItemView {
  private agendas: PublishedAgendaMember[] = [];
  private selected = "";
  private query = "";
  private loading = false;
  private refreshMessage = "";
  private titles = new Map<string, string>();
  private meetingMonth = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  constructor(leaf: WorkspaceLeaf, private readonly plugin: AgendaCapturePlugin) {
    super(leaf);
  }

  getViewType(): string { return AGENDA_DASHBOARD_VIEW; }
  getDisplayText(): string { return "Agenda Center"; }
  getIcon(): string { return "notebook-tabs"; }

  async onOpen(): Promise<void> {
    await this.refresh();
  }

  async refresh(manual = false): Promise<void> {
    if (this.loading) {
      if (manual) new Notice("Agenda refresh is already in progress.");
      return;
    }
    this.loading = true;
    try {
      const roster = await loadRoster(this.app, this.plugin.settings.vaultSubfolder);
      const agendas: PublishedAgendaMember[] = [];
      for (const name of roster.members) {
        const path = `${this.plugin.settings.vaultSubfolder}/${name}.md`;
        const file = this.app.vault.getAbstractFileByPath(path);
        if (!(file instanceof TFile)) continue;
        const markdown = await this.app.vault.cachedRead(file);
        agendas.push({
          name,
          kind: getAgendaKind(name),
          fileName: file.name,
          modified: new Date(file.stat.mtime).toISOString(),
          shortHash: markdown,
          tasks: parseOpenAgendaTasks(markdown, name),
        });
      }
      const snapshotFile = this.app.vault.getAbstractFileByPath(`${this.plugin.settings.vaultSubfolder}/_objectives.json`);
      const snapshot = snapshotFile instanceof TFile ? JSON.parse(await this.app.vault.read(snapshotFile)) : {version:1,objectives:[]};
      this.agendas = mergeObjectiveAgendas(agendas, snapshot);
      if (!this.selected || !this.agendas.some((agenda) => agenda.name === this.selected)) {
        this.selected = this.agendas[0]?.name || "";
      }
      if (manual) {
        const tasks = this.agendas.flatMap(agenda => agenda.tasks);
        const objectives = tasks.filter(task => task.source === 'objective').length;
        this.refreshMessage = `Refreshed ${this.agendas.length} agendas: ${tasks.length - objectives} agenda topics and ${objectives} objective entries. ${objectives === 0 ? 'To include an objective, enable Show on agendas in its People picker and save.' : ''}`.trim();
        new Notice(this.refreshMessage);
      }
      this.render();
    } catch (error) {
      this.refreshMessage = `Could not load agendas: ${error instanceof Error ? error.message : String(error)}`;
      new Notice(this.refreshMessage);
    } finally {
      this.loading = false;
    }
  }

  render(): void {
    const root = this.containerEl.children[1] as HTMLElement;
    root.empty();
    root.addClass("fjg-agenda-dashboard");
    root.createEl('style', { text: AGENDA_DOCUMENT_CSS });
    this.renderHeader(root);

    const total = this.agendas.reduce((sum, agenda) => sum + agenda.tasks.length, 0);
    const summary = root.createDiv({ cls: "agenda-summary" });
    this.metric(summary, String(this.agendas.length), "Agendas");
    this.metric(summary, String(total), "Open items");
    this.metric(summary, String(this.agendas.filter((agenda) => agenda.tasks.length === 0).length), "Clear agendas");

    const workspace = root.createDiv({ cls: "agenda-workspace" });
    this.renderRail(workspace);
    this.renderAgenda(workspace);
  }

  private renderHeader(root: HTMLElement): void {
    const header = root.createDiv({ cls: "agenda-dashboard-header" });
    const copy = header.createDiv();
    copy.createEl("p", { text: "STUDENT SUPPORT SERVICES", cls: "agenda-eyebrow" });
    copy.createEl("h1", { text: "Agenda Center" });
    copy.createEl("p", { text: "Every active agenda, directly from your People folder.", cls: "agenda-lede" });
    const actions = header.createDiv({ cls: "agenda-header-actions" });
    const talk = actions.createEl("button", { text: "Talk to agendas", cls: "mod-cta agenda-talk-button" });
    const mic = talk.createSpan({ cls: "agenda-button-icon" });
    setIcon(mic, "mic");
    talk.addEventListener("click", () => this.plugin.openLiveAgenda(() => this.selected));
    const add = actions.createEl("button", { text: "Add agenda item" });
    add.addEventListener("click", () => this.plugin.openCaptureModal("", this.selected));
    const refresh = actions.createEl("button", { text: "Refresh" });
    refresh.addEventListener("click", async () => {
      refresh.disabled = true;
      refresh.setText("Refreshing…");
      try { await this.refresh(true); }
      finally { refresh.disabled = false; refresh.setText("Refresh"); }
    });
    if (this.refreshMessage) copy.createEl("p", { text: this.refreshMessage, cls: "agenda-refresh-status", attr: { role: "status", "aria-live": "polite" } });
  }

  private metric(parent: HTMLElement, value: string, label: string): void {
    const metric = parent.createDiv({ cls: "agenda-metric" });
    metric.createEl("strong", { text: value });
    metric.createEl("span", { text: label });
  }

  private renderRail(parent: HTMLElement): void {
    const rail = parent.createEl("aside", { cls: "agenda-rail" });
    rail.createEl("h2", { text: "All agendas" });
    const search = rail.createEl("input", {
      type: "search",
      placeholder: "Search agendas",
      attr: { "aria-label": "Search agendas" },
    });
    search.value = this.query;
    search.addEventListener("input", () => {
      this.query = search.value;
      this.render();
      const replacement = (this.containerEl.children[1] as HTMLElement).querySelector<HTMLInputElement>(".agenda-rail input");
      replacement?.focus();
      replacement?.setSelectionRange(this.query.length, this.query.length);
    });
    const list = rail.createDiv({ cls: "agenda-rail-list" });
    const query = this.query.trim().toLowerCase();
    for (const agenda of this.agendas.filter((candidate) => !query || candidate.name.toLowerCase().includes(query))) {
      const button = list.createEl("button", {
        cls: `agenda-rail-row${agenda.name === this.selected ? " is-active" : ""}`,
        attr: { "aria-current": String(agenda.name === this.selected) },
      });
      const labels = button.createSpan();
      labels.createSpan({ text: agenda.name, cls: "agenda-rail-name" });
      labels.createSpan({ text: agenda.kind, cls: "agenda-rail-kind" });
      button.createSpan({ text: String(agenda.tasks.length), cls: "agenda-count" });
      button.addEventListener("click", () => { this.selected = agenda.name; this.render(); });
    }
  }

  private renderAgenda(parent: HTMLElement): void {
    const panel = parent.createEl("main", { cls: "agenda-main" });
    const agenda = this.agendas.find((candidate) => candidate.name === this.selected);
    if (!agenda) {
      panel.createEl("p", { text: "No agendas are available yet.", cls: "agenda-empty" });
      return;
    }
    const heading = panel.createDiv({ cls: "agenda-panel-heading" });
    const copy = heading.createDiv({cls:'agenda-export-fields'});
    const titleLabel = copy.createEl('label', {text:'Agenda title'});
    const titleInput = titleLabel.createEl('input', {attr:{'aria-label':'Agenda title'}});
    const title = this.titles.get(agenda.name) || (agenda.name === 'SSS Team' ? 'Department Meeting Agenda' : `${agenda.name} Meeting Agenda`);
    titleInput.value = title;
    const dateLabel = copy.createEl('label', {text:'Meeting date'});
    const dateInput = dateLabel.createEl('input', {attr:{'aria-label':'Meeting date'}}); dateInput.value = this.meetingMonth;
    const actions = heading.createDiv({ cls: "agenda-panel-actions" });
    const print = actions.createEl("button", { text: "Print / Save PDF" });
    const printIcon = print.createSpan({ cls: "agenda-button-icon" });
    setIcon(printIcon, "printer");
    print.addEventListener("click", () => this.printAgenda(agenda));
    const open = actions.createEl("button", { text: "Open source" });
    open.disabled = !agenda.fileName;
    open.addEventListener("click", () => void this.openSource(agenda));

    const preview = panel.createDiv({cls:'agenda-document-preview'});
    const renderPreview = () => {
      preview.innerHTML = agendaMarkup(agenda, this.titles.get(agenda.name) || title, this.meetingMonth);
      const rows = preview.querySelectorAll<HTMLElement>('.ag-row');
      agenda.tasks.forEach((task, index) => {
        if (task.source === 'objective') {
          const label = rows[index].createSpan({text:'Objective', cls:'ag-objective-label'});
          label.setAttribute('title', 'Included through Show on agendas in Objective Manager');
          const open = rows[index].createEl('button', {text:'Open objective', cls:'ag-objective-open', attr:{'aria-label':`Open objective: ${task.title}`}});
          open.onclick = () => {
            const file = this.app.vault.getAbstractFileByPath(task.objectivePath || '');
            if (file instanceof TFile) void this.app.workspace.getLeaf('tab').openFile(file);
            else new Notice('Objective note not found. Refresh Objective Manager, then Agenda Center.');
          };
          return;
        }
        const remove = rows[index].createEl('button', {cls:'ag-complete', attr:{'aria-label':`Mark complete: ${task.title}`,title:'Mark complete and remove from agenda'}});
        setIcon(remove, 'check');
        remove.onclick = () => void this.completeItem(agenda, task.sourceIndex).catch(error => new Notice(String(error)));
      });
    };
    titleInput.oninput = () => {this.titles.set(agenda.name,titleInput.value);renderPreview();};
    dateInput.oninput = () => {this.meetingMonth=dateInput.value;renderPreview();};
    renderPreview();
  }

  private async completeItem(agenda: PublishedAgendaMember, sourceIndex: number): Promise<void> {
    const path = `${this.plugin.settings.vaultSubfolder}/${agenda.fileName}`;
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) { new Notice("The source agenda file could not be found."); return; }
    await this.app.vault.process(file, (markdown) => {
      if (markdown !== agenda.shortHash) throw new Error('Agenda changed. Refresh before marking this item complete.');
      return editAgendaBlock(markdown, sourceIndex, 'complete');
    });
    new Notice("Agenda item marked complete and removed from the active agenda.");
    await this.refresh();
  }

  private async openSource(agenda: PublishedAgendaMember): Promise<void> {
    const path = `${this.plugin.settings.vaultSubfolder}/${agenda.fileName}`;
    const file = this.app.vault.getAbstractFileByPath(path);
    if (file instanceof TFile) await this.app.workspace.getLeaf("tab").openFile(file);
  }

  private printAgenda(agenda: PublishedAgendaMember): void {
    const title = this.titles.get(agenda.name) || (agenda.name === 'SSS Team' ? 'Department Meeting Agenda' : `${agenda.name} Meeting Agenda`);
    if (!printAgendaInPlace(this.containerEl.doc, this.containerEl.win, agenda, title, this.meetingMonth)) {
      new Notice("This device could not open its print dialog. Try again after restarting Obsidian.");
    }
  }
}
