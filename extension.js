import Gio from "gi://Gio";
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
      () => {
        this._updatePanelColors();
      },
    );

    // Connect extension settings changes
    this._settingsSignal = this._settings.connect(
      "changed",
      (settings, key) => {
        if (
          key === "dark-bg-color" ||
          key === "light-bg-color" ||
          key === "dark-fg-color" ||
          key === "light-fg-color"
        ) {
          this._updatePanelColors();
        }
      },
    );

    this._updatePanelColors();
  }

  disable() {
    if (this._colorSchemeSignal) {
      this._colorSchemeSettings.disconnect(this._colorSchemeSignal);
      this._colorSchemeSignal = null;
    }
    Main.panel.set_style("");
  }

  _updatePanelColors() {
    const bg_areas = [
      Main.panel._leftBox,
      Main.panel._centerBox,
      Main.panel._rightBox,
    ];
    for (const bg_area of bg_areas) {
      bg_area.set_style("");
    }
    const isDarkMode =
      this._colorSchemeSettings.get_string("color-scheme") === "prefer-dark";
    const backgroundColor = isDarkMode
      ? this._settings.get_string("dark-bg-color")
      : this._settings.get_string("light-bg-color");
    const foregroundColor = isDarkMode
      ? this._settings.get_string("dark-fg-color")
      : this._settings.get_string("light-fg-color");

    // Main.panel.set_style(`background-color: ${backgroundColor};`);
    const _panelButtons = Object.values(Main.panel.statusArea);
    for (const element of _panelButtons) {
      Func.updateStyle(element, "color", `${foregroundColor}`);
    }
    for (const dot of Main.panel.statusArea.activities.first_child.get_children()) {
      Func.updateStyle(dot._dot, "background-color", `${foregroundColor}`);
    }
  }
}
