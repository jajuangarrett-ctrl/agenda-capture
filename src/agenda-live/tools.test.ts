import { describe, it, expect, vi } from 'vitest';
vi.mock('obsidian', () => ({ TFile: class { constructor(public path: string) {} }, normalizePath: (path: string) => path }));
import { TFile } from 'obsidian';
import { LiveAgendaTools } from './tools';
import { parseOpenAgendaTasks } from '../publishData';
import { editAgendaBlock, reorderAgendaBlocks } from '../agenda-document';

function fixture() {
  const path = 'People/Test.md';
  const file = Object.assign(new (TFile as any)(path), { stat: { mtime: 1 } });
  const roster = new (TFile as any)('People/_roster.json');
  let markdown = '---\ntitle: Test\n---\n\n- [ ] #CalWORKs\n  Keep supporting note\n- [x] Already done\n- [ ] Budget #agenda #Standard\n- [ ] Budget #agenda #Standard\n';
  let active = true;
  let beforeProcess = () => {};
  const app: any = { vault: {
    getAbstractFileByPath: (p: string) => p === path ? file : p.endsWith('_roster.json') ? roster : null,
    read: async (f: any) => f === roster ? JSON.stringify({ members: ['Test'] }) : markdown,
    process: async (_: any, change: (text: string) => string) => { beforeProcess(); markdown = change(markdown); file.stat.mtime++; },
  }};
  const tools = new LiveAgendaTools(app, () => 'People', () => {}, () => active);
  const run = (name: string, args: any) => tools.execute(name, JSON.stringify(args)) as Promise<any>;
  return { run, read: () => run('read_agenda', { agenda: 'Test' }), content: () => markdown,
    race: () => { beforeProcess = () => { markdown += '\nConcurrent note'; }; }, stop: () => { beforeProcess = () => { active = false; }; } };
}

describe('live agenda writes', () => {
  it('finds a hashtag-only item using spoken words, removes it and hides it from active list', async () => {
    const f = fixture(); const found = await f.run('find_agenda_items', { agenda: 'Test', query: 'Cal Works' });
    expect(found.count).toBe(1); const item = found.matches[0];
    await f.run('change_agenda_item', { agenda: 'Test', expected_revision: item.revision, item_key: item.item_key, operation: 'complete', value: '' });
    expect(f.content()).toContain('- [x] #CalWORKs\n  Keep supporting note');
    expect((await f.read()).items.every((i: any) => !i.tags.includes('#CalWORKs'))).toBe(true);
  });
  it('updates hashtag-only items without losing or duplicating their hashtags', async () => {
    const f = fixture(); const a = await f.read();
    const result = await f.run('change_agenda_item', { agenda: 'Test', expected_revision: a.revision, item_key: a.items[0].item_key, operation: 'update', value: 'Review work study #CalWORKs' });
    expect(f.content()).toContain('- [ ] Review work study #CalWORKs\n  Keep supporting note');
    expect(result.revision).not.toBe(a.revision);
  });
  it('moves whole items, preserving completed tasks and distinguishing duplicates', async () => {
    const f = fixture(); const a = await f.read(); expect(a.items).toHaveLength(3);
    expect(a.items[1].item_key).not.toBe(a.items[2].item_key);
    const result = await f.run('move_agenda_item', { agenda: 'Test', expected_revision: a.revision, item_key: a.items[0].item_key, position: 3 });
    expect(result.items[2].tags).toContain('#CalWORKs');
    expect(f.content()).toContain('- [x] Already done');
    expect(f.content()).toContain('#CalWORKs\n  Keep supporting note');
  });
  it('rejects stale edits and changes arriving during the atomic write', async () => {
    const f = fixture(); const a = await f.read(); f.race();
    await expect(f.run('change_agenda_item', { agenda: 'Test', expected_revision: a.revision, item_key: a.items[0].item_key, operation: 'delete', value: '' })).rejects.toThrow('changed');
    expect(f.content()).toContain('#CalWORKs');
  });
  it('blocks pending writes after voice ends', async () => {
    const f = fixture(); const a = await f.read(); f.stop();
    await expect(f.run('move_agenda_item', { agenda: 'Test', expected_revision: a.revision, item_key: a.items[0].item_key, position: 2 })).rejects.toThrow('ended');
  });
  it('adds a batch atomically and returns its current order', async () => {
    const f = fixture(); const a = await f.read();
    const result = await f.run('add_agenda_items', { agenda: 'Test', expected_revision: a.revision, items: ['First', 'Second'], priority: 'Standard', hashtag: '#CalWORKs' });
    expect(result.items.slice(0, 2).map((i: any) => i.title)).toEqual(['First #CalWORKs', 'Second #CalWORKs']);
  });
  it('does not parse frontmatter/fenced examples and deletes associated details', () => {
    const md = '---\n- [ ] YAML example\n---\n```\n- [ ] Code example\n```\n- [ ] Real\n  details\n\n## Next\n- [ ] Keep\n';
    expect(parseOpenAgendaTasks(md, 'Test').map(i => i.title)).toEqual(['Real details', 'Keep']);
    expect(editAgendaBlock(md, 0, 'delete')).not.toContain('  details');
    expect(reorderAgendaBlocks(md, [1, 0])).toContain('## Next\n- [ ] Real\n  details');
  });
});
