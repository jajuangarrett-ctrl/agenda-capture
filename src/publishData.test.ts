import { describe, expect, it } from "vitest";
import {
  categorizeAgendaItem,
  createAgendaPublishPayload,
  getAgendaKind,
  parseOpenAgendaTasks,
} from "./publishData";

describe("parseOpenAgendaTasks", () => {
  it("excludes checked items and preserves only open roster tasks", () => {
    const markdown = [
      "---",
      "title: Example",
      "---",
      "- [ ] Discuss fiscal outlook #agenda #HighImpact",
      "- [x] Already discussed #agenda #Standard",
      "- [ ] Plan the fall event",
    ].join("\n");

    const tasks = parseOpenAgendaTasks(markdown, "Dr. Carter");
    expect(tasks).toHaveLength(2);
    expect(tasks.map((task) => task.title)).toEqual([
      "Discuss fiscal outlook",
      "Plan the fall event",
    ]);
    expect(tasks[0].priority).toBe("High impact");
  });

  it("deduplicates equivalent open items and joins continuation text", () => {
    const markdown = [
      "- [ ] Follow up with the team",
      "  about the updated schedule.",
      "- [ ] Follow-up with the team about the updated schedule",
    ].join("\n");
    const tasks = parseOpenAgendaTasks(markdown, "Leyla Recinos");
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe("Follow up with the team about the updated schedule.");
  });
});

describe("agenda publishing metadata", () => {
  it("categorizes deterministically without AI", () => {
    expect(categorizeAgendaItem("Discuss fiscal outlook")).toBe(
      "Finance, contracts & approvals"
    );
    expect(categorizeAgendaItem("Plan the fall event")).toBe(
      "Engagement, events & communications"
    );
  });

  it("classifies roster entries and summarizes the payload", () => {
    expect(getAgendaKind("CalWORKs Team")).toBe("Team");
    expect(getAgendaKind("Basic Needs Program")).toBe("Program");
    expect(getAgendaKind("Dr. Carter")).toBe("Person");

    const payload = createAgendaPublishPayload("05 People/Agenda Items", [
      {
        name: "Dr. Carter",
        kind: "Person",
        fileName: "Dr. Carter.md",
        modified: "2026-07-28T00:00:00.000Z",
        shortHash: "abc",
        tasks: [],
      },
    ], "2026-07-28T01:00:00.000Z");
    expect(payload.summary).toEqual({
      agendaCount: 1,
      openItemCount: 0,
      emptyAgendaCount: 1,
    });
  });
});
