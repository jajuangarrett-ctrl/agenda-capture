import { describe, it, expect } from "vitest";
import { formatDateHeading, renderBullet, insertBulletUnderHeading } from "./markdown";
import type { AgendaItem } from "./types";

describe("formatDateHeading", () => {
  it("zero-pads single-digit month and day", () => {
    expect(formatDateHeading(new Date(2026, 0, 5))).toBe("010526");
  });
  it("uses 2-digit year (modulo 100)", () => {
    expect(formatDateHeading(new Date(2026, 4, 3))).toBe("050326");
  });
  it("handles December correctly", () => {
    expect(formatDateHeading(new Date(2026, 11, 31))).toBe("123126");
  });
  it("handles year rollover into 2030", () => {
    expect(formatDateHeading(new Date(2030, 0, 1))).toBe("010130");
  });
});

describe("renderBullet", () => {
  const base: AgendaItem = {
    team: "Maria Rodriguez",
    text: "Discuss intake numbers",
    priority: "Standard",
  };

  it("auto-tags with #agenda and #Standard priority", () => {
    expect(renderBullet(base)).toBe("- [ ] Discuss intake numbers #agenda #Standard\n");
  });
  it("appends extra hashtag (with leading #) between #agenda and priority", () => {
    expect(renderBullet({ ...base, hashtag: "#followup" })).toBe(
      "- [ ] Discuss intake numbers #agenda #followup #Standard\n"
    );
  });
  it("appends extra hashtag (no leading #) between #agenda and priority", () => {
    expect(renderBullet({ ...base, hashtag: "followup" })).toBe(
      "- [ ] Discuss intake numbers #agenda #followup #Standard\n"
    );
  });
  it("does not duplicate #agenda when user supplies it", () => {
    expect(renderBullet({ ...base, hashtag: "agenda" })).toBe(
      "- [ ] Discuss intake numbers #agenda #Standard\n"
    );
    expect(renderBullet({ ...base, hashtag: "#Agenda" })).toBe(
      "- [ ] Discuss intake numbers #agenda #Standard\n"
    );
  });
  it("renders High Impact priority as #HighImpact (no space)", () => {
    expect(renderBullet({ ...base, priority: "High Impact" })).toBe(
      "- [ ] Discuss intake numbers #agenda #HighImpact\n"
    );
  });
});

describe("insertBulletUnderHeading", () => {
  const heading = "050326";
  const bullet = "- [ ] new item [Standard]\n";

  it("creates new heading when file is empty", () => {
    expect(insertBulletUnderHeading("", heading, bullet)).toBe(
      `## ${heading}\n${bullet}`
    );
  });

  it("inserts a new heading above content when the file has no date headings", () => {
    const current = "Some preamble text.\n";
    expect(insertBulletUnderHeading(current, heading, bullet)).toBe(
      `## ${heading}\n${bullet}\nSome preamble text.\n`
    );
  });

  it("inserts bullet immediately after today's heading", () => {
    const current = `## ${heading}\n- [ ] existing item [Standard]\n`;
    expect(insertBulletUnderHeading(current, heading, bullet)).toBe(
      `## ${heading}\n${bullet}- [ ] existing item [Standard]\n`
    );
  });

  it("inserts a new today heading above older headings", () => {
    const older = "## 050226\n- [ ] yesterday item [Standard]\n";
    expect(insertBulletUnderHeading(older, heading, bullet)).toBe(
      `## ${heading}\n${bullet}\n## 050226\n- [ ] yesterday item [Standard]\n`
    );
  });

  it("inserts under today's heading when other headings sandwich it", () => {
    const current =
      "## 040126\n- [ ] old [Standard]\n\n" +
      `## ${heading}\n- [ ] existing today [Standard]\n\n` +
      "## 040526\n- [ ] something later [Standard]\n";
    const expected =
      "## 040126\n- [ ] old [Standard]\n\n" +
      `## ${heading}\n${bullet}- [ ] existing today [Standard]\n\n` +
      "## 040526\n- [ ] something later [Standard]\n";
    expect(insertBulletUnderHeading(current, heading, bullet)).toBe(expected);
  });

  it("does NOT match a longer date prefix like ## 0503261", () => {
    const current = `## ${heading}1\n- [ ] mismatched [Standard]\n`;
    expect(insertBulletUnderHeading(current, heading, bullet)).toBe(
      `## ${heading}\n${bullet}\n## ${heading}1\n- [ ] mismatched [Standard]\n`
    );
  });

  it("does NOT match a different heading level like ### MMDDYY", () => {
    const current = `### ${heading}\n- [ ] sub [Standard]\n`;
    expect(insertBulletUnderHeading(current, heading, bullet)).toBe(
      `## ${heading}\n${bullet}\n### ${heading}\n- [ ] sub [Standard]\n`
    );
  });

  it("preserves frontmatter above a new top date heading", () => {
    const current = "---\ntags: [team]\n---\n\n## 050226\n- [ ] yesterday [Standard]\n";
    expect(insertBulletUnderHeading(current, heading, bullet)).toBe(
      `---\ntags: [team]\n---\n\n## ${heading}\n${bullet}\n## 050226\n- [ ] yesterday [Standard]\n`
    );
  });
});
