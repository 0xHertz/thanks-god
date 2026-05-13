# AGENTS.md — Thanksgiving-God

GNOME Shell extension that auto-switches panel icon/text colors between light/dark mode.

## Project structure

```
thanks-giving-god@gnome.com/
├── extension.js          # Main extension entry point (ESM)
├── prefs.js              # Preferences dialog (Adwaita/GTK)
├── lib/func.js           # CSS style utility for St widgets
├── schemas/
│   ├── org.gnome.shell.extensions.dynamic-panel.gschema.xml
│   └── gschemas.compiled
├── metadata.json
└── README.md
```

## Architecture

### Entrypoint & lifecycle
- `extension.js` exports a class extending `Extension` (from `resource:///org/gnome/shell/extensions/extension.js`)
- `enable()` called on enable: sets up GSettings signals, `color-scheme` listener, panel `child-added` signals, and an `GLib.idle_add` one-shot for initial color application on login
- `disable()` must disconnect ALL signals to avoid memory leaks (pattern: save signal ID, disconnect, null out)

### Color detection & application
- Dark mode detection: reads `org.gnome.desktop.interface` → `color-scheme` key (string `"prefer-dark"`)
- Reacts to three triggers: `color-scheme` change, settings key change (4 color keys), and any new child added to panel boxes
- Applies `color` CSS property to all panel buttons and `background-color` to activities dot via `Func.updateStyle()`

### Preferences (`prefs.js`)
- Uses `Adw.PreferencesWindow` with `Gtk.ColorButton` widgets
- Settings keys: `dark-bg-color`, `dark-fg-color`, `light-bg-color`, `light-fg-color`
- Schema ID: `org.gnome.shell.extensions.finallyfind` (note: different from UUID)
- Path: `/org/gnome/shell/extensions/finallyfind/`

### Imports
- Shell UI: `resource:///org/gnome/shell/ui/main.js` → `Main.panel`, `Main.panel.statusArea`
- Shell extensions base: `resource:///org/gnome/shell/extensions/extension.js`
- GObject introspection: `gi://Gio`, `gi://GLib`, `gi://St`, `gi://Meta`, `gi://Gtk`, `gi://Gdk`, `gi://Adw`

## Key conventions & gotchas

- **No build step.** Raw JS modules, no bundler/linter/formatter/typechecker.
- **No tests.** Testing = `Alt+F2` `r` to reload shell, or log out/in.
- **Schema changes require recompilation:** `glib-compile-schemas schemas/`
- **`gschemas.compiled` is checked in** — do not gitignore it; must be committed.
- **`metadata.json` `settings-schema`** must match the gschema XML `<schema id="...">`.
- **`settings-schema` and UUID differ** (`finallyfind` vs `thanks-giving-god@gnome.com`) — intentional.
- **All JS is GNOME Shell's GJS runtime** — no Node.js APIs (no `require()`, no `process.env`, no `fs`). Use `Gio`, `GLib` for I/O.
- **ESM only** (`import`/`export`). No CommonJS.
- **`enable()`/`disable()` lifecycle** — do not use constructors for shell integration.
- **Signal cleanup is mandatory** — every `connect()` in `enable()` must be `disconnect()`-ed in `disable()`.
- **`Func.updateStyle(obj, prop, value)`** parses existing inline style, merges the new property, and re-applies. Passing empty string removes the property.
