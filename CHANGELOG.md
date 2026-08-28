# Changelog

## 0.5.0 — 2026-08-27

### Added

- Add a structured, review-first Apple Mail protocol that can prefill team
  member, agenda item, priority, and hashtag from an on-device Apple
  Intelligence draft.
- Validate incoming team members against the current Agenda Capture roster and
  require the user to press **Save** before any Markdown is changed.
- Add regression tests for valid, malformed, invented-roster, and unsupported
  priority payloads.
