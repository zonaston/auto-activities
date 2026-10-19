/****************************************************************************
 ** Auto Activities - Show overview when there are no windows.
 ** Copyright (C) 2022-2023 Cleo Menezes Jr., 2021  jan Sena <mi-jan-sena@proton.me>
 **
 ** This program is free software: you can redistribute it and/or modify
 ** it under the terms of the GNU General Public License as published by
 ** the Free Software Foundation, either version 3 of the License, or
 ** (at your option) any later version.
 **
 ** This program is distributed in the hope that it will be useful,
 ** but WITHOUT ANY WARRANTY; without even the implied warranty of
 ** MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 ** GNU General Public License for more details.
 **
 ** You should have received a copy of the GNU General Public License
 ** along with this program.  If not, see <https://www.gnu.org/licenses/>.
 ****************************************************************************/
"use strict";

import * as Main from "resource:///org/gnome/shell/ui/main.js";
import GLib from "gi://GLib";
import Meta from "gi://Meta";

const ignoredWindowTypes = [
  Meta.WindowType.DESKTOP,
  Meta.WindowType.DOCK,
  Meta.WindowType.DROPDOWN_MENU,
  Meta.WindowType.NOTIFICATION,
  Meta.WindowType.POPUP_MENU,
  Meta.WindowType.SPLASHSCREEN,
];

// This manager owns signals and a timeout; it does not need a Clutter actor.
export class AutoActivitiesManager {
  constructor({ settings }) {
    this._settings = settings;
    this._windowCheckingDelay = 0;
    this._workspaceSignals = new Map();
    this._syncWorkspaces();

    this._managerSignals = ["workspace-added", "workspace-removed"].map(
      (signal) => global.workspace_manager.connect(signal, () => this._syncWorkspaces()),
    );
    this._managerSignals.push(global.workspace_manager.connect(
      "active-workspace-changed", () => this._checkAndShowOverview(true),
    ));
    this._minimizedEvent = global.window_manager.connect(
      "minimize", (_sender, actor) => {
        if (this._settings.get_boolean("detect-minimized") &&
            !ignoredWindowTypes.includes(actor.meta_window.get_window_type()))
          this._checkAndShowOverview();
      },
    );
  }

  _syncWorkspaces() {
    const workspaces = new Set();
    for (let i = 0; i < global.workspace_manager.n_workspaces; i++)
      workspaces.add(global.workspace_manager.get_workspace_by_index(i));

    // Keep IDs with their workspace objects, which remain stable on reordering.
    for (const [workspace, signals] of this._workspaceSignals) {
      if (!workspaces.has(workspace)) {
        signals.forEach((id) => workspace.disconnect(id));
        this._workspaceSignals.delete(workspace);
      }
    }
    for (const workspace of workspaces) {
      if (this._workspaceSignals.has(workspace)) continue;
      this._workspaceSignals.set(workspace, [
        workspace.connect("window-removed", (_sender, window) => {
          if (!ignoredWindowTypes.includes(window.get_window_type()))
            this._checkAndShowOverview();
        }),
        workspace.connect("window-added", (_sender, window) => {
          if (!ignoredWindowTypes.includes(window.get_window_type()) &&
              this._settings.get_boolean("hide-on-new-window")) {
            if (Main.overview.visible) Main.overview.hide();
          }
        }),
      ]);
    }
  }

  _checkAndShowOverview(workspaceSwitched = false) {
    if (this._windowCheckingDelay) GLib.Source.remove(this._windowCheckingDelay);
    const delay = Math.max(0, this._settings.get_int("window-checking-delay"));
    this._windowCheckingDelay = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, () => {
      this._windowCheckingDelay = 0;
      const workspace = global.workspace_manager.get_active_workspace();
      // This option applies to workspace navigation, not closing/minimizing windows.
      if (workspaceSwitched && this._settings.get_boolean("skip-last-workspace") &&
          workspace.index() === global.workspace_manager.n_workspaces - 1)
        return GLib.SOURCE_REMOVE;

      const windows = global.get_window_actors().filter((actor) => {
        const window = actor.meta_window;
        // Closing windows may already be detached from their workspace.
        if (!window.get_workspace() || ignoredWindowTypes.includes(window.get_window_type()))
          return false;
        if (this._settings.get_boolean("isolate-workspaces") &&
            !window.located_on_workspace(workspace)) return false;
        // The overview opens on the primary monitor.
        if (this._settings.get_boolean("isolate-monitors") &&
            window.get_monitor() !== Main.layoutManager.primaryIndex) return false;
        if (this._settings.get_boolean("skip-taskbar") && window.skip_taskbar)
          return false;
        if (this._settings.get_boolean("detect-minimized") && window.minimized)
          return false;
        return true;
      });

      if (windows.length === 0 && !Main.sessionMode.isLocked && !Main.sessionMode.isGreeter) {
        if (this._settings.get_boolean("show-apps")) Main.overview.showApps();
        else Main.overview.show();
      }
      return GLib.SOURCE_REMOVE;
    });
  }

  destroy() {
    if (this._windowCheckingDelay) {
      GLib.Source.remove(this._windowCheckingDelay);
      this._windowCheckingDelay = 0;
    }
    this._managerSignals.forEach((id) => global.workspace_manager.disconnect(id));
    global.window_manager.disconnect(this._minimizedEvent);
    for (const [workspace, signals] of this._workspaceSignals)
      signals.forEach((id) => workspace.disconnect(id));
    this._workspaceSignals.clear();
    this._settings = null;
  }
}
