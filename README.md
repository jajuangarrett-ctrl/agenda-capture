# Agenda Capture

Quick voice/text capture of agenda items into per-team-member markdown files in your Obsidian vault.

Each captured item lands as a checkbox bullet at the top of `<vault>/05 People/Agenda Items/<TeamMember>.md`. The `[ ]` checkbox represents *whether the item has been shared with the team member yet*, not completion. Capture dates and date headings are deliberately omitted, leaving one newest-first running list per team member.

## Commands

- **Capture agenda item** — opens the capture modal (also available via the microphone ribbon icon)
- **Manage agenda roster** — add or remove team members

## Vault layout

```
<vault>/05 People/Agenda Items/
  _roster.json             # team member list (synced via Obsidian Sync)
  Maria Rodriguez.md
  John Chen.md
  ...
```

Each team member's file:

```markdown
- [ ] Discuss intake numbers #followup [Standard]
- [ ] Review eligibility criteria with her [High Impact]
- [ ] Yesterday's item [Standard]
```

## Capture modal

| Field         | Notes                                                                 |
|---------------|-----------------------------------------------------------------------|
| Team member   | Dropdown sourced from `_roster.json`. Last-used preselected.          |
| Item          | Type or use the Record button below. Supports the iOS keyboard mic.   |
| Voice capture | Tap Record -> dictate -> tap Stop. Whisper transcribes; Haiku cleans. |
| Priority      | Standard or High Impact.                                              |
| Hashtag       | Optional. Leading `#` is added automatically if you omit it.          |

After save: notice + the modal reopens with the same team preselected if "Show another after save" is enabled.

## Voice pipeline

1. **Record** uses the browser `MediaRecorder` API (works in Obsidian's iOS WebView).
2. Audio is POSTed to OpenAI's `audio/transcriptions` endpoint with `model=whisper-1`.
3. The raw transcript is then sent to Claude Haiku 4.5 with a system prompt that pins your roster names and custom acronyms verbatim. Cleanup is skipped if no Anthropic key is configured.
4. Cleaned text lands in the modal's textarea. You can edit before saving.

## Settings

| Setting               | Default                       |
|-----------------------|-------------------------------|
| Vault subfolder       | `05 People/Agenda Items`      |
| Show another after save | on                          |
| OpenAI API key        | -                             |
| Anthropic API key     | -                             |
| Custom acronyms       | `CalWORKs, VPSS, FJG`         |

## iPhone launch shortcut

After installing on iPhone via BRAT, install the **Advanced URI** community plugin, then build a one-action iOS Shortcut:

- Action: **Open URL**
- URL: `obsidian://advanced-uri?vault=FJG%20Vault&commandid=agenda-capture%3Acapture`

Add the Shortcut to your home screen as a Shortcuts widget for ~1.5s tap-to-capture.

## Install

### BRAT (recommended for mobile)

1. Install [Obsidian42 BRAT](https://github.com/TfTHacker/obsidian42-brat) if not already installed.
2. BRAT settings -> Add Beta Plugin -> paste this repo's URL.
3. Enable "Agenda Capture" in Community Plugins.

### Manual (desktop testing)

1. `npm install && npm run build`
2. Copy `manifest.json`, `main.js`, and `styles.css` to `<vault>/.obsidian/plugins/agenda-capture/`.
3. Reload Obsidian (Ctrl/Cmd+R), enable in Community Plugins.

## Develop

```
npm install
npm run dev    # esbuild watch mode
npm run build  # production build (typecheck + minified bundle)
npm test       # vitest unit tests for markdown surgery
```

## License

MIT
