// Requires Nautilus. Run in a separate session with --extra-filter org.gnome.Nautilus.
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Scripting from 'resource:///org/gnome/shell/ui/scripting.js';
import Gio from 'gi://Gio';

export async function run() {
  await Scripting.sleep(1500);
  const extension = Main.extensionManager.lookup('auto-activities@CleoMenezesJr.github.io');
  if (extension?.state !== 1) throw new Error('Extension failed to enable');
  const settings = extension.stateObj.getSettings();
  settings.set_boolean('skip-last-workspace', true);
  settings.set_boolean('show-apps', false);
  settings.set_int('window-checking-delay', 100);
  new Gio.Settings({schema_id: 'org.gnome.mutter'}).set_boolean('dynamic-workspaces', false);
  new Gio.Settings({schema_id: 'org.gnome.desktop.wm.preferences'}).set_int('num-workspaces', 1);
  Main.overview.hide();
  await Scripting.sleep(800);
  if (global.workspace_manager.n_workspaces !== 1)
    throw new Error('Test must use a single workspace');

  const process = Gio.Subprocess.new(['nautilus', '--new-window', '/tmp'], Gio.SubprocessFlags.NONE);
  try {
    let window;
    for (let i = 0; i < 30; i++) {
      window = global.get_window_actors().map(actor => actor.meta_window)
        .find(candidate => candidate.get_wm_class()?.includes('Nautilus'));
      if (window) break;
      await Scripting.sleep(200);
    }
    if (!window) throw new Error('Files did not open');
    await Scripting.sleep(700);
    window.delete(global.get_current_time());
    await Scripting.sleep(1500);
    if (!Main.overview.visible)
      throw new Error('Closing Files on the last workspace must show overview');
    print('PASS: closing Files on the last workspace with Ignore Last Workspace enabled');
  } finally {
    process.force_exit();
  }
}
