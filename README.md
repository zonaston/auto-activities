# Auto Activities — personal GNOME 50/51 fork

Show the Activities overview when there are no windows, and hide it when a new
window opens. Based on [CleoMenezesJr/auto-activities](https://github.com/CleoMenezesJr/auto-activities),
by Cleo Menezes Jr. and jan Sena. Licensed under GPL-3.0-or-later; see [LICENSE](LICENSE).

This branch targets **GNOME Shell 50 and 51**. GNOME 51.1 has an automated
headless integration test; GNOME 50 still needs a runtime check on that version.

## Changes in this fork

- Declare GNOME 50/51 support and use a plain JavaScript signal manager.
- Keep workspace signals attached to their original workspace objects, including
  when workspaces are reordered or removed.
- Coalesce pending window checks and cancel them when disabling the extension.
- Handle closing windows without a workspace and count sticky windows correctly.
- Apply “Last Workspace” only to the last workspace, rather than suppressing all
  workspace-switch checks. Closing or minimizing its final window still opens the overview.
- Use the primary monitor for monitor isolation, matching where the overview opens.
- Ignore desktop/dock windows and avoid opening the overview on the lock/login screen.
- Package only extension files when installing, rather than copying the Git checkout.

The upstream UUID and settings schema are retained so existing preferences continue
to work. This fork replaces the upstream extension when installed; the two versions
cannot run side by side. The GNOME Extensions website supplies upstream, not this fork.
An upstream update through Extension Manager may replace the personal copy.

## Build and install

```bash
git clone https://github.com/zonaston/auto-activities.git
cd auto-activities
git switch gnome-50-51
make pack
gnome-extensions install --force dist/auto-activities@CleoMenezesJr.github.io.shell-extension.zip
```

Log out and back in after the first install (or when replacing already-loaded
JavaScript), then enable the extension:

```bash
gnome-extensions enable auto-activities@CleoMenezesJr.github.io
gnome-extensions prefs auto-activities@CleoMenezesJr.github.io
```

Alternatively, `make install` installs the source files for the current user.
Use `make uninstall` to remove that copy.

## Verification

```bash
make test
make pack
GDK_BACKEND=wayland GTK_A11Y=none timeout 60s \
  dbus-run-session -- gnome-shell-test-tool --headless --disable-animations \
  --extension dist/auto-activities@CleoMenezesJr.github.io.shell-extension.zip \
  tests/shell.js
```

The GJS regression checks exercise window filtering, primary-monitor changes,
workspace switches/removals/reordering, timer cancellation and signal cleanup.
The integration test uses a temporary GNOME configuration and a separate D-Bus
session to check loading, opening/closing a real test window on the last workspace
with “Ignore Last Workspace” enabled, and disable/re-enable. Run with animations
enabled too by omitting `--disable-animations`.

To test Files specifically (requires Nautilus), use the same command with
`--extra-filter org.gnome.Nautilus --extra-filter Nautilus` and replace
`tests/shell.js` with `tests/files.js`.

Manual checks on each GNOME version: minimize the final window with detection
on/off, move and reorder workspaces, test the last-workspace option, open the
preferences, and test monitor isolation on a multi-monitor desktop.

Porting references: [GNOME 50](https://gjs.guide/extensions/upgrading/gnome-shell-50.html)
and [GNOME 51](https://gjs.guide/extensions/upgrading/gnome-shell-51.html).
