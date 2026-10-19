// Exercise window and workspace lifecycles without changing the desktop session.
import Gio from 'gi://Gio';

const [, bytes] = Gio.File.new_for_path('autoActivities.js').load_contents(null);
const source = new TextDecoder().decode(bytes)
  .replace(/^import .*;\n/gm, '').replace('export class', 'class');
let nextId = 1;
class Signals {
  constructor() { this.signals = new Map(); }
  connect(name, callback) {
    const id = nextId++;
    this.signals.set(id, {name, callback});
    return id;
  }
  disconnect(id) {
    assert(this.signals.delete(id), 'disconnect must use the original signal owner');
  }
  emit(name, ...args) {
    for (const signal of [...this.signals.values()])
      if (signal.name === name) signal.callback(this, ...args);
  }
}
function assert(value, message) { if (!value) throw new Error(message); }
const types = Object.fromEntries(['DESKTOP', 'DOCK', 'DROPDOWN_MENU', 'NOTIFICATION', 'POPUP_MENU', 'SPLASHSCREEN', 'NORMAL'].map((key, i) => [key, i]));
const timers = new Map();
const GLib = {
  PRIORITY_DEFAULT: 0, SOURCE_REMOVE: false,
  timeout_add(_priority, _delay, callback) {
    const id = nextId++; timers.set(id, callback); return id;
  },
  Source: {remove(id) { assert(timers.delete(id), 'only remove live timers'); }},
};
const workspaces = Array.from({length: 3}, () => new Signals());
for (const workspace of workspaces) workspace.index = () => workspaces.indexOf(workspace);
let active = workspaces[0];
let actors = [];
const wm = new Signals();
Object.assign(wm, {
  get n_workspaces() { return workspaces.length; },
  get_workspace_by_index: i => workspaces[i],
  get_active_workspace: () => active,
});
// Object.assign copies accessors as values; keep this count dynamic.
Object.defineProperty(wm, 'n_workspaces', {get: () => workspaces.length});
const global = {workspace_manager: wm, window_manager: new Signals(), get_window_actors: () => actors};
let shown = 0, hidden = 0, apps = 0;
const Main = {
  overview: {visible: true, show() { shown++; }, hide() { hidden++; }, showApps() { apps++; }},
  layoutManager: {primaryIndex: 0}, sessionMode: {isLocked: false, isGreeter: false},
};
const values = {'isolate-workspaces': true, 'skip-last-workspace': true, 'hide-on-new-window': true, 'skip-taskbar': true};
const settings = {get_boolean: key => !!values[key], get_int: () => 100};
const Manager = new Function('Main', 'GLib', 'Meta', 'global', `${source}\nreturn AutoActivitiesManager;`)(Main, GLib, {WindowType: types}, global);
const manager = new Manager({settings});
const flush = () => {
  for (const [id, callback] of [...timers]) { timers.delete(id); assert(callback() === GLib.SOURCE_REMOVE, 'timer must be one-shot'); }
};
const window = (overrides = {}) => ({meta_window: {
  get_workspace: () => active, get_window_type: () => types.NORMAL,
  located_on_workspace: workspace => workspace === active, get_monitor: () => 0,
  skip_taskbar: false, minimized: false, ...overrides,
}});
manager._checkAndShowOverview(); manager._checkAndShowOverview();
assert(timers.size === 1, 'rapid events must coalesce'); flush();
assert(shown === 1, 'empty workspace opens overview');
actors = [window()]; manager._checkAndShowOverview(); flush();
assert(shown === 1, 'normal windows prevent overview');
actors = [window({get_workspace: () => null})]; manager._checkAndShowOverview(); flush();
assert(shown === 2, 'detached closing windows are safe');
actors = [window({get_window_type: () => types.DESKTOP})]; manager._checkAndShowOverview(); flush();
assert(shown === 3, 'desktop windows do not block overview');
actors = [window({minimized: true})]; values['detect-minimized'] = true;
global.window_manager.emit('minimize', actors[0]); flush();
assert(shown === 4, 'last minimized window opens overview');
values['detect-minimized'] = false; values['isolate-monitors'] = true;
actors = [window({get_monitor: () => 1})]; manager._checkAndShowOverview(); flush();
assert(shown === 5, 'monitor isolation uses primary monitor');
Main.layoutManager.primaryIndex = 1; manager._checkAndShowOverview(); flush();
assert(shown === 5, 'primary monitor changes are respected');
values['isolate-monitors'] = false;
actors = [window({located_on_workspace: () => true, get_workspace: () => workspaces[1]})];
manager._checkAndShowOverview(); flush(); assert(shown === 5, 'sticky windows count on current workspace');
actors = []; active = workspaces[2]; wm.emit('active-workspace-changed'); flush();
assert(shown === 5, 'last workspace stays empty');
active = workspaces[1]; wm.emit('active-workspace-changed'); flush();
assert(shown === 6, 'other workspace switches still work with skip-last enabled');
Main.sessionMode.isLocked = true; manager._checkAndShowOverview(); flush();
assert(shown === 6, 'locked session must not show overview'); Main.sessionMode.isLocked = false;
values['show-apps'] = true; manager._checkAndShowOverview(); flush(); assert(apps === 1, 'app grid option works');
workspaces[0].emit('window-added', window().meta_window); assert(hidden === 1, 'new windows hide overview');
workspaces.reverse(); wm.emit('workspaces-reordered');
const removed = workspaces.splice(1, 1)[0]; wm.emit('workspace-removed', 1);
assert(removed.signals.size === 0, 'removed workspace signals disconnect');
const added = new Signals(); added.index = () => workspaces.indexOf(added);
workspaces.push(added); wm.emit('workspace-added', 2);
assert(added.signals.size === 2, 'new workspace is tracked');
// Closing/minimizing the last window must work even on the final workspace.
active = workspaces[workspaces.length - 1];
const shownBeforeClose = shown;
values['show-apps'] = false;
actors = [];
active.emit('window-removed', window().meta_window);
flush();
assert(shown === shownBeforeClose + 1,
  'ignore-last-workspace must not suppress the final window closing');
manager._checkAndShowOverview(); manager.destroy();
assert(timers.size === 0 && wm.signals.size === 0 && global.window_manager.signals.size === 0, 'disable clears timeout and global signals');
assert(workspaces.every(w => w.signals.size === 0), 'disable clears reordered workspace signals');
const second = new Manager({settings}); second.destroy();
assert(timers.size === 0, 'disable without a pending timeout is safe');
print('PASS: window filters, workspace changes, overview options, timers and enable/disable cleanup');
