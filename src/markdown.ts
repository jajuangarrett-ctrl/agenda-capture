import type { AgendaItem } from "./types";

export function splitAgendaItems(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*]|\d+[.)])\s+/, "").trim())
    .filter(Boolean);
}

export function completeChecklistItem(markdown: string, checklistIndex: number): string {
  if (!Number.isInteger(checklistIndex) || checklistIndex < 0) return markdown;
  let current = -1;
  return markdown.replace(/^(\s*[-*]\s*\[)([ xX])(\]\s*.*)$/gm, (line, before, state, after) => {
    current += 1;
    return current === checklistIndex && state === " " ? `${before}x${after}` : line;
  });
}

export function renameChecklistItem(markdown: string, checklistIndex: number, title: string): string {
  const clean = title.trim();
  if (!clean || !Number.isInteger(checklistIndex) || checklistIndex < 0) return markdown;
  let current = -1;
  return markdown.replace(/^(\s*[-*]\s*\[[ xX]\]\s*)(.*)$/gm, (line, prefix, body) => {
    current += 1;
    if (current !== checklistIndex) return line;
    const tags = body.match(/(?:\s+#[A-Za-z0-9_/-]+)+\s*$/)?.[0] || "";
    return `${prefix}${clean}${tags}`;
  });
}

export function deleteChecklistItem(markdown: string, checklistIndex: number): string {
  if (!Number.isInteger(checklistIndex) || checklistIndex < 0) return markdown;
  let current = -1;
  return markdown.split(/\n/).filter((line) => {
    if (/^\s*[-*]\s*\[[ xX]\]\s*/.test(line)) current += 1;
    return current !== checklistIndex || !/^\s*[-*]\s*\[[ xX]\]\s*/.test(line);
  }).join("\n");
}

export function renderBullet(item: AgendaItem): string {
  const tags = ["#agenda"];
  if (item.hashtag) {
    const extra = item.hashtag.startsWith("#") ? item.hashtag : `#${item.hashtag}`;
    if (extra.toLowerCase() !== "#agenda") tags.push(extra);
  }
  tags.push(`#${item.priority.replace(/\s+/g, "")}`);
  return `- [ ] ${item.text} ${tags.join(" ")}\n`;
}

export function insertBulletAtTop(current: string, bullet: string): string {
  const normalized = current.replace(/\r\n?/g, "\n");
  const { frontmatter, body } = splitFrontmatter(normalized);
  const runningList = stripLegacyDateHeadings(body).replace(/^\n+/, "");
  const newBullet = `${bullet.replace(/\n+$/, "")}\n`;
  const nextBody = `${newBullet}${runningList}`;

  if (!frontmatter) return nextBody;
  return `${frontmatter.replace(/\n+$/, "")}\n\n${nextBody}`;
}

function splitFrontmatter(content: string): { frontmatter: string; body: string } {
  const match = content.match(/^---\n[\s\S]*?\n---\n?/);
  if (!match) return { frontmatter: "", body: content };
  return { frontmatter: match[0], body: content.slice(match[0].length) };
}

function stripLegacyDateHeadings(body: string): string {
  return body
    .replace(/^## \d{6}[ \t]*(?:\n|$)/gm, "")
    .replace(/\n{3,}/g, "\n\n");
}
