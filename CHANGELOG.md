# Changelog

## 0.9.0 — 2026-09-21

- Replace the dashboard's form-filling voice shortcut with an Objective Manager-style conversational agenda controller.
- Let voice list and read agendas aloud, including item titles, categories, and priorities.
- Let explicit voice requests add multiple items, rename an item, mark it complete, or permanently delete it.
- Add revision checks and exact agenda/item identifiers so stale or ambiguous voice edits cannot silently change the wrong item.
- Refresh the Agenda Center immediately after successful voice writes.

## 0.8.2 — 2026-09-21

- Let live voice read the currently selected agenda's open Markdown items through a read-only tool.
- Refresh agenda context after changing the selected person, team, or program.
- Keep batch agenda items on separate lines during voice capture.

## 0.8.1 — 2026-09-21

- Move live Talk to Capture controls to the top of the capture window.
- Prefer the existing FJG Objective Manager OpenAI key, with the Agenda Capture key as fallback.
- Allow multiple agenda items in one capture, one item per line, and save them together.
- Add a dashboard action that marks an item complete in Markdown and immediately removes it from the active agenda.

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
