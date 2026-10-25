import { describe, it, expect } from 'vitest';
import { agendaMarkup } from './agenda-template';
import { mergeObjectiveAgendas } from './objective-agendas';
import { parseOpenAgendaTasks, type PublishedAgendaMember } from './publishData';
const roster = (): PublishedAgendaMember[] => [{name:'Alex Lee',kind:'Person',fileName:'Alex Lee.md',modified:'',shortHash:'original',tasks:parseOpenAgendaTasks('- [ ] Ordinary topic\n- [x] Discussed topic','Alex Lee')}];
const objective = {id:'stable-1',title:'Selected objective',people:[' Alex  Lee ', 'New Employee'],status:'do-first',path:'08 Tasks/Inbox/Tasks/Selected/task.md'};
describe('Native Agenda Center objective integration', () => {
 it('merges selected objectives alongside original Markdown and creates missing person agendas', () => {
  const original = roster(); const merged = mergeObjectiveAgendas(original,{version:1,objectives:[objective]});
  expect(merged[0].tasks.map(task => task.title)).toEqual(['Ordinary topic','Selected objective']);
  expect(merged[0].shortHash).toBe('original'); expect(original[0].tasks).toHaveLength(1);
  const print = agendaMarkup(merged[0], 'Meeting', 'October 2026');
  expect(print).toContain('Ordinary topic'); expect(print).toContain('Selected objective');
  expect(merged[1].name).toBe('New Employee'); expect(merged[1].fileName).toBe('');
  expect(merged[0].tasks[1]).toMatchObject({source:'objective',sourceIndex:-1,objectivePath:objective.path});
 });
 it('repeated refresh deduplicates and completed, archived or deselected snapshots remove only objectives', () => {
  const selected = {version:1,objectives:[objective,objective]}; const merged = mergeObjectiveAgendas(roster(), selected);
  expect(mergeObjectiveAgendas(merged, selected)[0].tasks).toHaveLength(2);
  for (const objectives of [[],[{...objective,status:'completed'}],[{...objective,status:'archived'}]]) expect(mergeObjectiveAgendas(merged,{version:1,objectives})[0].tasks.map(task=>task.title)).toEqual(['Ordinary topic']);
 });
 it('rejects malformed snapshots before touching prior agendas', () => {
  const original = roster(); const before=JSON.stringify(original);
  expect(()=>mergeObjectiveAgendas(original,{version:1,objectives:[{...objective,people:null}]})).toThrow();
  expect(()=>mergeObjectiveAgendas(original,{version:2,objectives:[]})).toThrow();
  expect(JSON.stringify(original)).toBe(before);
 });
});
