import { describe, it, expect } from "vitest";
import { insertBulletAtTop, renderBullet } from "./markdown";
import type { AgendaItem } from "./types";

describe("renderBullet", () => {
  const base: AgendaItem = {
    team: "Maria Rodriguez",
    text: "Discuss intake numbers",
    priority: "Standard",
  };

  it("auto-tags with #agenda and #Standard priority", () => {
    expect(renderBullet(base)).toBe("- [ ] Discuss intake numbers #agenda #Standard\n");
  });

  it("appends an extra hashtag with or without a leading #", () => {
    expect(renderBullet({ ...base, hashtag: "#followup" })).toBe(
      "- [ ] Discuss intake numbers #agenda #followup #Standard\n"
    );
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

  it("renders High Impact priority as #HighImpact", () => {
    expect(renderBullet({ ...base, priority: "High Impact" })).toBe(
      "- [ ] Discuss intake numbers #agenda #HighImpact\n"
    );
  });
});

describe("insertBulletAtTop", () => {
  const bullet = "- [ ] new item #agenda #Standard\n";

  it("creates a running list when the file is empty", () => {
    expect(insertBulletAtTop("", bullet)).toBe(bullet);
  });

  it("inserts the newest capture above existing items", () => {
    const current = "- [ ] existing item #agenda #Standard\n";
    expect(insertBulletAtTop(current, bullet)).toBe(`${bullet}${current}`);
  });

  it("inserts above unstructured existing content", () => {
    const current = "Some preamble text.\n";
    expect(insertBulletAtTop(current, bullet)).toBe(`${bullet}${current}`);
  });

  it("preserves frontmatter above the running list", () => {
    const current =
      "---\ntags: [team]\n---\n\n" +
      "- [ ] existing item #agenda #Standard\n";
    expect(insertBulletAtTop(current, bullet)).toBe(
      "---\ntags: [team]\n---\n\n" + bullet +
        "- [ ] existing item #agenda #Standard\n"
    );
  });

  it("removes legacy date headings while preserving their items", () => {
    const current =
      "## 050226\n- [ ] yesterday item #agenda #Standard\n\n" +
      "## 050126\n- [ ] older item #agenda #Standard\n";
    expect(insertBulletAtTop(current, bullet)).toBe(
      bullet +
        "- [ ] yesterday item #agenda #Standard\n\n" +
        "- [ ] older item #agenda #Standard\n"
    );
  });

  it("does not remove longer or differently leveled headings", () => {
    const current =
      "## 0503261\n- [ ] keep longer heading\n\n" +
      "### 050326\n- [ ] keep level-three heading\n";
    const out = insertBulletAtTop(current, bullet);
    expect(out).toContain("## 0503261\n");
    expect(out).toContain("### 050326\n");
  });

  it("normalizes Windows line endings", () => {
    const current = "---\r\ntags: []\r\n---\r\n\r\n- [ ] existing\r\n";
    expect(insertBulletAtTop(current, bullet)).toBe(
      "---\ntags: []\n---\n\n" + bullet + "- [ ] existing\n"
    );
  });
});
