/** Source spans are shared by reading, editing and ordering; never edit a display label. */
export interface AgendaBlock { start: number; end: number; sourceIndex: number; completed: boolean; raw: string; first: string; tags: string[] }
export function agendaBlocks(markdown: string): AgendaBlock[] {
  const blocks: AgendaBlock[] = [];
  let offset = 0, fenced = false, frontmatter = false;
  const lines = markdown.match(/[^\n]*\n|[^\n]+$/g) || [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index], text = line.replace(/\r?\n$/, '');
    if (index === 0 && /^\uFEFF?---\s*$/.test(text)) { frontmatter = true; offset += line.length; continue; }
    if (frontmatter) { if (/^---\s*$/.test(text)) frontmatter = false; offset += line.length; continue; }
    if (/^\s*(```|~~~)/.test(text)) { fenced = !fenced; offset += line.length; continue; }
    const match = !fenced && text.match(/^[ \t]*[-*] +\[([ xX])\][ \t]*(.*)$/);
    if (match) {
      blocks.push({ start: offset, end: offset + line.length, sourceIndex: blocks.length, completed: match[1] !== ' ', raw: match[2], first: match[2], tags: [] });
    } else if (!fenced && blocks.length && /^[ \t]+\S/.test(text) && blocks[blocks.length - 1].end === offset) {
      const block = blocks[blocks.length - 1]; block.end = offset + line.length; block.raw += '\n' + text.trim();
    }
    offset += line.length;
  }
  for (const block of blocks) block.tags = [...new Set(block.raw.match(/#[\p{L}\p{N}_/-]+/gu) || [])];
  return blocks;
}

export function editAgendaBlock(markdown: string, index: number, operation: 'rename'|'update'|'complete'|'delete'|'tags', value = ''): string {
  const block = agendaBlocks(markdown)[index];
  if (!block) throw new Error('Agenda item is no longer available. Read it again.');
  const original = markdown.slice(block.start, block.end);
  let next = original;
  if (operation === 'delete') next = '';
  else if (operation === 'complete') next = original.replace(/\[ \]/, '[x]');
  else {
    const lines = original.split(/\r?\n/);
    const prefix = lines[0].match(/^[ \t]*[-*] +\[[ xX]\][ \t]*/)?.[0] || '- [ ] ';
    if (operation === 'tags') {
      const tags = value.trim() ? value.trim().split(/\s+/) : [];
      if (tags.some(tag => !/^#[\p{L}\p{N}_/-]+$/u.test(tag))) throw new Error('Use space-separated hashtags, such as #CalWORKs.');
      next = original.replace(/(^|\s)#[\p{L}\p{N}_/-]+/gu, '$1');
      const firstEnd = next.indexOf('\n');
      const split = firstEnd < 0 ? next.length : firstEnd;
      next = next.slice(0, split).trimEnd() + (tags.length ? ' ' + tags.join(' ') : '') + next.slice(split);
    } else {
      if (!value.trim() || /\r|\n/.test(value)) throw new Error('Use one nonempty line for the item text.');
      const present = value.match(/#[\p{L}\p{N}_/-]+/gu) || [];
      const tags = (block.first.match(/#[\p{L}\p{N}_/-]+/gu) || []).filter(tag => !present.some(p => p.toLowerCase() === tag.toLowerCase()));
      lines[0] = prefix + value.trim() + (tags.length ? ' ' + tags.join(' ') : '');
      next = lines.join(original.includes('\r\n') ? '\r\n' : '\n');
    }
  }
  return markdown.slice(0, block.start) + next + markdown.slice(block.end);
}

export function reorderAgendaBlocks(markdown: string, sourceIndexes: number[]): string {
  const open = agendaBlocks(markdown).filter(block => !block.completed);
  if (sourceIndexes.length !== open.length || new Set(sourceIndexes).size !== open.length || sourceIndexes.some(id => !open.some(block => block.sourceIndex === id))) throw new Error('Provide each open item exactly once.');
  let result = '', cursor = 0;
  open.forEach((slot, index) => {
    const source = open.find(block => block.sourceIndex === sourceIndexes[index])!;
    let content = markdown.slice(source.start, source.end);
    if (!content.endsWith('\n') && slot.end < markdown.length) content += markdown.includes('\r\n') ? '\r\n' : '\n';
    result += markdown.slice(cursor, slot.start) + content; cursor = slot.end;
  });
  return result + markdown.slice(cursor);
}
