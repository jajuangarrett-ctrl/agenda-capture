# Changelog

## 0.6.0 — 2026-08-28

### Added

- Expose the reviewed Agenda Capture modal through a small native plugin API so
  FJG Task Manager can prefill an item from its unified capture launcher.

### Changed

- Remove the superseded Apple Mail Intelligence protocol adapter. Agenda items
  continue to require explicit review and **Save** confirmation.

## 0.5.0 — 2026-08-27

### Added

- Add a structured, review-first Apple Mail protocol that can prefill team
  member, agenda item, priority, and hashtag from an on-device Apple
  Intelligence draft.
- Validate incoming team members against the current Agenda Capture roster and
  require the user to press **Save** before any Markdown is changed.
- Add regression tests for valid, malformed, invented-roster, and unsupported
  priority payloads.
# 0.8.0

- Added the Obsidian-native Agenda Center dashboard backed directly by `05 People/Agenda Items`.
- Added live voice and typed capture actions from the dashboard, with the selected agenda prefilled.
- Added printable individual agendas and one-click access to each source Markdown note.
- Added live counts, agenda search, refresh, empty states, and automatic updates after vault changes.
