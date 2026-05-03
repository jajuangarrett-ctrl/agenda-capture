import type { AgendaItem } from "./types";

export function formatDateHeading(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yy = String(d.getFullYear() % 100).padStart(2, "0");
  return `${mm}${dd}${yy}`;
}

export function renderBullet(item: AgendaItem): string {
  const tags = ["#agenda"];
  if (item.hashtag) {
    const extra = item.hashtag.startsWith("#") ? item.hashtag : `#${item.hashtag}`;
    if (extra.toLowerCase() !== "#agenda") tags.push(extra);
  }
  return `- [ ] ${item.text} ${tags.join(" ")} [${item.priority}]\n`;
}

export function insertBulletUnderHeading(
  current: string,
  heading: string,
  bullet: string
): string {
  // Match `## MMDDYY` as its own line. Reject `### MMDDYY` and `## MMDDYY-extra`.
  const headingPattern = new RegExp(`^## ${heading}[ \\t]*$`, "m");
  const match = headingPattern.exec(current);
  if (match) {
    const headingEnd = match.index + match[0].length;
    const insertAt = current.charAt(headingEnd) === "\n" ? headingEnd + 1 : headingEnd;
    return current.slice(0, insertAt) + bullet + current.slice(insertAt);
  }

  const trimmed = current.replace(/\s+$/, "");
  const separator = trimmed.length > 0 ? "\n\n" : "";
  return `${trimmed}${separator}## ${heading}\n${bullet}`;
}
