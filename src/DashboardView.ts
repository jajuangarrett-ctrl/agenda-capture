import { ItemView, Notice, setIcon, TFile, WorkspaceLeaf } from "obsidian";
import type AgendaCapturePlugin from "../main";
import { getAgendaKind, parseOpenAgendaTasks, type PublishedAgendaMember } from "./publishData";
import { loadRoster } from "./roster";

export const AGENDA_DASHBOARD_VIEW = "fjg-agenda-dashboard";

export class AgendaDashboardView extends ItemView {
  private agendas: PublishedAgendaMember[] = [];
  private selected = "";
  private query = "";
  private loading = false;

  constructor(leaf: WorkspaceLeaf, private readonly plugin: AgendaCapturePlugin) {
    super(leaf);
  }

  getViewType(): string { return AGENDA_DASHBOARD_VIEW; }
  getDisplayText(): string { return "Agenda Center"; }
  getIcon(): string { return "notebook-tabs"; }

  async onOpen(): Promise<void> {
    await this.refresh();
  }

  async refresh(): Promise<void> {
    if (this.loading) return;
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
          shortHash: "",
          tasks: parseOpenAgendaTasks(markdown, name),
        });
      }
      this.agendas = agendas;
      if (!this.selected || !agendas.some((agenda) => agenda.name === this.selected)) {
        this.selected = agendas[0]?.name || "";
      }
      this.render();
    } catch (error) {
      new Notice(`Could not load agendas: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.loading = false;
    }
  }

  render(): void {
    const root = this.containerEl.children[1] as HTMLElement;
    root.empty();
    root.addClass("fjg-agenda-dashboard");
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
    const talk = actions.createEl("button", { text: "Talk to capture", cls: "mod-cta agenda-talk-button" });
    const mic = talk.createSpan({ cls: "agenda-button-icon" });
    setIcon(mic, "mic");
    talk.addEventListener("click", () => this.plugin.openCaptureModal("", this.selected));
    const add = actions.createEl("button", { text: "Add agenda item" });
    add.addEventListener("click", () => this.plugin.openCaptureModal("", this.selected));
    const refresh = actions.createEl("button", { text: "Refresh" });
    refresh.addEventListener("click", () => void this.refresh());
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
    const copy = heading.createDiv();
    copy.createEl("p", { text: agenda.kind.toUpperCase(), cls: "agenda-eyebrow" });
    copy.createEl("h2", { text: agenda.name });
    copy.createEl("p", { text: `${agenda.tasks.length} open ${agenda.tasks.length === 1 ? "item" : "items"}`, cls: "agenda-panel-subtitle" });
    const actions = heading.createDiv({ cls: "agenda-panel-actions" });
    const print = actions.createEl("button", { text: "Print agenda" });
    const printIcon = print.createSpan({ cls: "agenda-button-icon" });
    setIcon(printIcon, "printer");
    print.addEventListener("click", () => this.printAgenda(agenda));
    const open = actions.createEl("button", { text: "Open source" });
    open.addEventListener("click", () => void this.openSource(agenda));

    const items = panel.createDiv({ cls: "agenda-items" });
    if (!agenda.tasks.length) {
      const empty = items.createDiv({ cls: "agenda-empty" });
      empty.createEl("strong", { text: "Nothing waiting" });
      empty.createEl("p", { text: "This agenda has no open items." });
      return;
    }
    agenda.tasks.forEach((task, index) => {
      const row = items.createEl("article", { cls: "agenda-item" });
      row.createSpan({ text: String(index + 1).padStart(2, "0"), cls: "agenda-item-number" });
      const body = row.createDiv();
      body.createEl("p", { text: task.title, cls: "agenda-item-title" });
      const meta = body.createDiv({ cls: "agenda-item-meta" });
      meta.createSpan({ text: task.category });
      if (task.priority) meta.createSpan({ text: task.priority, cls: "is-priority" });
    });
  }

  private async openSource(agenda: PublishedAgendaMember): Promise<void> {
    const path = `${this.plugin.settings.vaultSubfolder}/${agenda.fileName}`;
    const file = this.app.vault.getAbstractFileByPath(path);
    if (file instanceof TFile) await this.app.workspace.getLeaf("tab").openFile(file);
  }

  private printAgenda(agenda: PublishedAgendaMember): void {
    const popup = window.open("", "_blank", "width=900,height=1000");
    if (!popup) { new Notice("Allow pop-ups in Obsidian to print this agenda."); return; }
    const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char] || char));
    const rows = agenda.tasks.length
      ? agenda.tasks.map((task, index) => `<li><span>${String(index + 1).padStart(2, "0")}</span><p>${escape(task.title)}</p></li>`).join("")
      : "<li class=empty>No open agenda items.</li>";
    popup.document.write(`<!doctype html><html><head><title>${escape(agenda.name)} Agenda</title><style>@page{margin:.65in}*{box-sizing:border-box}body{color:#29242e;font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:0}header{border-bottom:4px solid #53257f;padding-bottom:22px;margin-bottom:28px}small{color:#53257f;font-weight:800;letter-spacing:.1em}h1{font-size:36px;margin:5px 0 4px}header p{color:#655d6d;margin:0}ol{list-style:none;margin:0;padding:0}li{display:grid;grid-template-columns:46px 1fr;gap:16px;border-bottom:1px solid #ddd7e2;padding:16px 0;break-inside:avoid}li span{color:#53257f;font-weight:800}li p{margin:0}.empty{display:block;color:#655d6d}footer{color:#655d6d;font-size:12px;margin-top:32px}</style></head><body><header><small>STUDENT SUPPORT SERVICES</small><h1>${escape(agenda.name)}</h1><p>Meeting agenda · ${new Date().toLocaleDateString()}</p></header><ol>${rows}</ol><footer>Prepared from FJG Agenda Center</footer><script>window.onload=()=>window.print()<\/script></body></html>`);
    popup.document.close();
  }
}
