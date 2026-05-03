# Agenda Capture

Quick voice/text capture of agenda items into per-team-member markdown files in your Obsidian vault.

## Status

Day 1 scaffold. Capture modal, roster manager, and voice pipeline land in subsequent days per the [implementation plan](https://github.com/) (private).

## Install (BRAT)

1. Install the [Obsidian42 BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin if not already installed.
2. In Obsidian, open BRAT settings -> Add Beta Plugin.
3. Paste this repo's URL.
4. Enable "Agenda Capture" in Community Plugins.

## Install (manual, for desktop development)

1. Build: `npm install && npm run build`.
2. Copy `manifest.json` and `main.js` to `<vault>/.obsidian/plugins/agenda-capture/`.
3. Reload Obsidian (Ctrl/Cmd+R) and enable in Community Plugins.

## Develop

```
npm install
npm run dev    # watch mode
npm run build  # production build
```

## Vault layout this plugin writes to

```
<vault>/05 People/Agenda Items/
  _roster.json              # team member list (synced via Obsidian Sync)
  Maria Rodriguez.md
  John Chen.md
  ...
```

Each team member's file uses the format:

```markdown
## MMDDYY
- [ ] [agenda item text] #optional-hashtag [High Impact|Standard]
```

The `[ ]` checkbox represents whether the item has been shared with the team member yet. Same-day captures append under the existing date heading.
