import type { AgendaItem } from "./types";

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
    .replace(/^## \d{6}[ \t]*\n?/gm, "")
    .replace(/\n{3,}/g, "\n\n");
}
