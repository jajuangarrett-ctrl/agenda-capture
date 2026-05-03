export type Priority = "High Impact" | "Standard";

export interface AgendaItem {
  team: string;
  text: string;
  priority: Priority;
  hashtag?: string;
}

export interface Roster {
  members: string[];
}
