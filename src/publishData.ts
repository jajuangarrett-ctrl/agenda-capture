export interface PublishedAgendaTask {
  key: string;
  title: string;
  priority: "" | "High impact";
  category: string;
  sourceIndex: number;
}

export interface PublishedAgendaMember {
  name: string;
  kind: "Person" | "Team" | "Program";
  fileName: string;
  modified: string;
  shortHash: string;
  tasks: PublishedAgendaTask[];
}

export interface AgendaPublishPayload {
  version: 1;
  generatedAt: string;
  sourceFolder: string;
  roster: PublishedAgendaMember[];
  summary: {
    agendaCount: number;
    openItemCount: number;
    emptyAgendaCount: number;
  };
}

const CATEGORY_ORDER = [
  "People, staffing & workplace",
  "Operations, systems & scheduling",
  "Programs, services & student access",
  "Finance, contracts & approvals",
  "Engagement, events & communications",
  "Leadership updates & decisions",
  "Other agenda items",
] as const;

function matches(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

export function categorizeAgendaItem(title: string): string {
  const text = title.toLowerCase();
  if (matches(text, [
    "employee", "staffing", "personnel", "supervisor", "faculty", "position",
    "office environment", "office situation", "office space", "vacation",
    "out-of-class", "nance", "retraining", "hiring",
  ])) return CATEGORY_ORDER[0];
  if (matches(text, [
    "grant", "fiscal", "lottery", "contract", "retainer", "authorization",
    "professional expert", "sponsorship", "$",
  ])) return CATEGORY_ORDER[3];
  if (matches(text, [
    "event", "retreat", "tournament", "pride", "celebrat", "translation",
    "communication", "volunteer", "engagement",
  ])) return CATEGORY_ORDER[4];
  if (matches(text, [
    "sars", "calsaw", "handshake", "scheduling", "schedule", "front desk",
    "electronic sign-in", "access", "caseload", "paperwork", "stipend",
    "supplies", "equipment", "deliverable",
  ])) return CATEGORY_ORDER[1];
  if (matches(text, [
    "basic needs", "calworks", "work-study", "work study", "child watch",
    "student", "lgbt", "a2mend", "project assistance", "sashes",
    "enrollment", "outreach",
  ])) return CATEGORY_ORDER[2];
  if (matches(text, [
    "chancellor", "sdiccca", "pathways", "committee", "chair", "strategy",
    "research", "update",
  ])) return CATEGORY_ORDER[5];
  return CATEGORY_ORDER[6];
}

function cleanTaskText(raw: string): string {
  return raw
    .replace(/==/g, "")
    .replace(/`/g, "")
    .replace(/\*\*/g, "")
    .replace(/\s+#(?:agenda|HighImpact|Standard)\b/gi, "")
    .replace(/^[-*]\s+/, "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[“”"'`]/g, "")
    .replace(/[^a-z0-9$]+/g, " ")
    .trim();
}

export function simpleHash(text: string): string {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function parseOpenAgendaTasks(
  markdown: string,
  memberName: string
): PublishedAgendaTask[] {
  const withoutFrontmatter = String(markdown)
    .replace(/^\uFEFF/, "")
    .replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*(?:\r?\n|$)/, "");
  const rows: Array<{ completed: boolean; raw: string }> = [];
  let current: { completed: boolean; raw: string } | null = null;

  for (const line of withoutFrontmatter.split(/\r?\n/)) {
    const match = line.match(/^\s*[-*]\s*\[([ xX])\]\s*(.*)$/);
    if (match) {
      current = {
        completed: match[1].toLowerCase() === "x",
        raw: match[2].trim(),
      };
      rows.push(current);
      continue;
    }
    const continuation = line.trim();
    if (current && continuation && !/^#{1,6}\s/.test(continuation)) {
      current.raw += ` ${continuation}`;
    }
  }

  const seen = new Set<string>();
  const tasks: PublishedAgendaTask[] = [];
  rows.forEach((row, sourceIndex) => {
    if (row.completed) return;
    const title = cleanTaskText(row.raw);
    const normalized = normalizeText(title);
    if (!title || seen.has(normalized)) return;
    seen.add(normalized);
    tasks.push({
      key: `task-${simpleHash(`${memberName}|${normalized}`)}`,
      title,
      priority: /#HighImpact\b/i.test(row.raw) ? "High impact" : "",
      category: categorizeAgendaItem(title),
      sourceIndex,
    });
  });
  return tasks;
}

export function getAgendaKind(name: string): "Person" | "Team" | "Program" {
  if (/\bteam\b/i.test(name)) return "Team";
  if (/\b(program|issp|bssp)\b/i.test(name)) return "Program";
  return "Person";
}

export function createAgendaPublishPayload(
  sourceFolder: string,
  members: PublishedAgendaMember[],
  generatedAt = new Date().toISOString()
): AgendaPublishPayload {
  const openItemCount = members.reduce((sum, member) => sum + member.tasks.length, 0);
  return {
    version: 1,
    generatedAt,
    sourceFolder,
    roster: members,
    summary: {
      agendaCount: members.length,
      openItemCount,
      emptyAgendaCount: members.filter((member) => member.tasks.length === 0).length,
    },
  };
}
