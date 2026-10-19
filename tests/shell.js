// Run in an isolated GNOME Shell session via gnome-shell-test-tool.
import Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Scripting from 'resource:///org/gnome/shell/ui/scripting.js';

const uuid = 'auto-activities@CleoMenezesJr.github.io';
function assert(value, message) { if (!value) throw new Error(message); }
export async function run() {
  await Scripting.sleep(1500);
  const extension = Main.extensionManager.lookup(uuid);
  assert(extension?.state === 1, `Extension failed to enable: ${extension?.error}`);
  const settings = extension.stateObj.getSettings();
  // The final window must reopen overview even on the last/only workspace.
  settings.set_boolean('skip-last-workspace', true);
  new Gio.Settings({schema_id: 'org.gnome.mutter'}).set_boolean('dynamic-workspaces', false);
  new Gio.Settings({schema_id: 'org.gnome.desktop.wm.preferences'}).set_int('num-workspaces', 1);
  settings.set_boolean('show-apps', false);
  settings.set_int('window-checking-delay', 100);
  Main.overview.hide();
  await Scripting.sleep(500);
  assert(global.workspace_manager.n_workspaces === 1, 'Test must use a single workspace');
  await Scripting.createTestWindow({});
  await Scripting.waitTestWindows();
  await Scripting.sleep(500);
  assert(!Main.overview.visible, 'New window should hide overview');
  await Scripting.destroyTestWindows();
  await Scripting.sleep(800);
  assert(Main.overview.visible, 'Closing last window should show overview');
  // Test a real pending source and synchronous disable on GNOME 51.
  const manager = extension.stateObj._autoActivities;
  settings.set_int('window-checking-delay', 1000);
  manager._checkAndShowOverview();
  Main.extensionManager.disableExtension(uuid);
  await Scripting.sleep(200);
  assert(manager._windowCheckingDelay === 0, 'Disable must cancel timeout');
  assert(manager._workspaceSignals.size === 0, 'Disable must disconnect workspaces');
  Main.overview.hide();
  await Scripting.sleep(1200);
  assert(!Main.overview.visible, 'Disabled extension must not reopen overview');
  Main.extensionManager.enableExtension(uuid);
  await Scripting.sleep(500);
  assert(extension.state === 1, 'Extension should re-enable');
  print('PASS: GNOME Shell integration, window open/close and disable/re-enable');
}
