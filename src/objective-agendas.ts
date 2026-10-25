import type { PublishedAgendaMember } from './publishData';

interface ObjectiveSnapshot {
  version: 1;
  objectives: { id: string; title: string; people: string[]; status: string; priority?: string; path: string }[];
}
const personKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
export function mergeObjectiveAgendas(roster: PublishedAgendaMember[], value: unknown): PublishedAgendaMember[] {
  const snapshot = value as ObjectiveSnapshot;
  if (!snapshot || snapshot.version !== 1 || !Array.isArray(snapshot.objectives)) throw new Error('Invalid Objective Manager snapshot. Refresh Objective Manager and try again.');
  for (const objective of snapshot.objectives) {
    if (!objective || typeof objective.id !== 'string' || !objective.id || typeof objective.title !== 'string' || !Array.isArray(objective.people) || objective.people.some(name => typeof name !== 'string') || typeof objective.status !== 'string' || typeof objective.path !== 'string' || !objective.path || objective.path.startsWith('/') || objective.path.split('/').includes('..')) throw new Error('Invalid objective entry. The previous agendas have been kept.');
  }
  const result = roster.map(member => ({...member, tasks:member.tasks.filter(task => task.source !== 'objective')}));
  const people = new Map(result.map(member => [personKey(member.name),member]));
  for (const objective of snapshot.objectives) {
    if (objective.status === 'completed' || objective.status === 'archived') continue;
    for (const name of objective.people) {
      const key = personKey(name); if (!key) continue;
      let member = people.get(key);
      if (!member) { member = {name:name.trim(),kind:'Person',fileName:'',modified:'',shortHash:'',tasks:[]}; people.set(key,member); result.push(member); }
      const taskKey = `objective-${objective.id}-${encodeURIComponent(key)}`;
      if (member.tasks.some(task => task.key === taskKey)) continue;
      member.tasks.push({key:taskKey,title:objective.title,priority:objective.priority === 'high' ? 'High impact' : '',category:'Objectives',sourceIndex:-1,source:'objective',objectivePath:objective.path});
    }
  }
  return result;
}
