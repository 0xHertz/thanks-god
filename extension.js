import Gio from "gi://Gio";
import GLib from "gi://GLib";
import Func from "./lib/func.js";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";

export default class DynamicPanelExtension extends Extension {
  enable() {
    this._settings = this.getSettings();
    this._colorSchemeSettings = new Gio.Settings({
      schema: "org.gnome.desktop.interface",
    });

    this._colorSchemeSignal = this._colorSchemeSettings.connect(
      "changed::color-scheme",
      () => this._updatePanelColors(),
    );

    this._settingsSignal = this._settings.connect(
      "changed",
      (settings, key) => {
        if (
          [
            "dark-bg-color",
            "light-bg-color",
            "dark-fg-color",
            "light-fg-color",
          ].includes(key)
        ) {
          this._updatePanelColors();
        }
      },
    );
    this._leftBoxSignal = Main.panel._leftBox.connect(
      "child-added",
      (_, actor) => {
        this._updatePanelColors();
      },
    );
    this._centerBoxSignal = Main.panel._centerBox.connect(
      "child-added",
      (_, actor) => {
        this._updatePanelColors();
      },
    );
    this._rightBoxSignal = Main.panel._rightBox.connect(
      "child-added",
      (_, actor) => {
        this._updatePanelColors();
      },
    );
    // 用户登录时执行，但通过 allocation 确保 Actor 初始化完成再修改
    GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
      if (this._destroyed) return GLib.SOURCE_REMOVE;
      this._updatePanelColors();
      return GLib.SOURCE_REMOVE;
    });
  }

  disable() {
    if (this._colorSchemeSignal) {
      this._colorSchemeSettings.disconnect(this._colorSchemeSignal);
      this._colorSchemeSignal = null;
    }
    if (this._settingsSignal) {
      this._settings.disconnect(this._settingsSignal);
      this._settingsSignal = null;
    }
    Main.panel.set_style("");

    if (this._leftBoxSignal) {
      Main.panel._leftBox.disconnect(this._leftBoxSignal);
      this._leftBoxSignal = null;
    }
    if (this._centerBoxSignal) {
      Main.panel._centerBox.disconnect(this._centerBoxSignal);
      this._centerBoxSignal = null;
    }
    if (this._rightBoxSignal) {
      Main.panel._rightBox.disconnect(this._rightBoxSignal);
      this._rightBoxSignal = null;
    }
  }

  _updatePanelColors() {
    const isDarkMode =
      this._colorSchemeSettings.get_string("color-scheme") === "prefer-dark";
    const backgroundColor = isDarkMode
      ? this._settings.get_string("dark-bg-color")
      : this._settings.get_string("light-bg-color");
    const foregroundColor = isDarkMode
      ? this._settings.get_string("dark-fg-color")
      : this._settings.get_string("light-fg-color");

    // 更新 panel 背景区域
    [Main.panel._leftBox, Main.panel._centerBox, Main.panel._rightBox].forEach(
      (area) => {
        area.set_style("");
      },
    );

    const _panelButtons = Object.values(Main.panel.statusArea);
    for (const element of _panelButtons) {
      Func.updateStyle(element, "color", `${foregroundColor}`);
    }
    for (const dot of Main.panel.statusArea.activities.first_child.get_children()) {
      Func.updateStyle(dot._dot, "background-color", `${foregroundColor}`);
    }
  }
}
