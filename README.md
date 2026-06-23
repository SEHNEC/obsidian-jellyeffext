# JellyEffext

A floating, Notion-style rich text toolbar for Obsidian's Live Preview mode.

Select any text and a clean floating toolbar appears — bold, italic, underline, strikethrough, inline code, font sizes, text colors, and highlights — without leaving your keyboard flow.

## Features

- **Floating toolbar** — Appears on selection, like Notion or Google Docs
- **Fixed toolbar mode** — Optional always-visible bar at the top or bottom of the editor
- **Text formatting** — Bold, Italic, Underline, Strikethrough, Inline Code
- **Font sizes** — Presets (12px–32px) plus a custom size dialog
- **Text colors** — 8 default presets plus a full color picker with persistent custom colors
- **Highlight colors** — 5 default presets plus a full color picker
- **Clear formatting** — Strip all formatting from a selection in one click
- **Keyboard shortcuts** — Every action is a command, assignable via Obsidian's Hotkeys settings
- **Theme-aware** — Works with light and dark themes
- **No runtime dependencies** — Single bundled `main.js`, no external libraries

## How Formatting Is Stored

JellyEffext uses **standard Markdown whenever possible** so your notes stay portable:

| Format | Stored As | Example |
|--------|-----------|---------|
| Bold | `**text**` | `**hello**` |
| Italic | `*text*` | `*hello*` |
| Strikethrough | `~~text~~` | `~~hello~~` |
| Inline Code | `` `text` `` | `` `hello` `` |

For features that have no Markdown equivalent (underline, font size, colors), clean CSS class–based spans are used:

```html
<span class="rt-size-18 rt-color-red rt-bg-yellow rt-underline">text</span>
```

No long inline `style="..."` attributes are generated — only short, semantic class names.

## Installation

### From the Obsidian Community Plugins (coming soon)

1. Open **Settings → Community Plugins → Browse**
2. Search for **JellyEffext**
3. Click **Install**, then **Enable**

### Manual Installation

1. Download the latest release (`main.js`, `manifest.json`, `styles.css`)
2. Copy them to `<your-vault>/.obsidian/plugins/jellyeffext/`
3. Reload Obsidian and enable the plugin in **Settings → Community Plugins**

### From Source

```bash
git clone <repo-url> jellyeffext
cd jellyeffext
npm install
npm run build
```

Then copy the resulting `main.js`, `manifest.json`, and `styles.css` into `<your-vault>/.obsidian/plugins/jellyeffext/`.

## Settings

- **Floating toolbar** — Toggle the popup-on-selection toolbar
- **Fixed toolbar** — Always show the toolbar (overrides floating mode)
- **Fixed toolbar position** — Top or bottom of the editor
- **Font size presets** — Comma-separated list of sizes shown in the dropdown
- **Text color presets** — Editable name/hex pairs shown as swatches
- **Highlight color presets** — Editable name/hex pairs for highlights
- **Theme integration** — Auto-adjusts certain colors for dark mode

## Commands & Hotkeys

All actions are registered as Obsidian commands and can be bound under **Settings → Hotkeys**:

| Action | Suggested Shortcut |
|--------|-------------------|
| Toggle Bold | Ctrl+B |
| Toggle Italic | Ctrl+I |
| Toggle Underline | Ctrl+U |
| Toggle Strikethrough | — |
| Toggle Inline Code | — |
| Clear Formatting | — |
| Set Font Size: 12px–32px | Ctrl+Alt+1…5 |

## Development

```bash
npm install       # install dev dependencies
npm run dev       # watch mode
npm run build     # production build (tsc + esbuild)
```

### Project Layout

```
jellyeffext/
├── main.ts              # Plugin source
├── styles.css           # Toolbar + formatting styles
├── manifest.json        # Plugin manifest
├── versions.json        # Version → minAppVersion map
├── package.json
├── tsconfig.json
├── esbuild.config.mjs
└── README.md
```

## Compatibility

- **Obsidian** — v1.5.0 and later
- **Editor modes** — Live Preview and Source Mode (Reading Mode is read-only by design)
- **Platforms** — Desktop and mobile

## License

MIT

---

## Editing Tip

If you have trouble selecting or editing text **inside** colored, sized, or underlined spans in Live Preview, press **`Ctrl+E`** (or **`Cmd+E`** on macOS) to switch to **Source Mode** briefly. Make your edit, then switch back.

This isn't a bug in the plugin — it's how Obsidian renders inline HTML widgets in Live Preview. Any plugin that uses inline `<span>` elements (Highlightr, Style Settings color helpers, etc.) has the same behavior. Source Mode shows the raw text and gives you full cursor control.
