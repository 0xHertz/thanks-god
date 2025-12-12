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

    // 用户登录时执行，但通过 allocation 确保 Actor 初始化完成再修改
    this._updatePanelColors();

    // 监听 Tray 图标变化
    this._traySignals = [];
    const trayAreas = Object.values(Main.panel.statusArea);
    for (const area of trayAreas) {
      if (area.container) {
        const addSignal = area.container.connect("child-added", (_, child) => {
          // 【改动】新增：动态添加的 Tray 图标也更新样式
          this._updateActorStyle(
            child,
            `color: ${
              this._colorSchemeSettings.get_string("color-scheme") ===
              "prefer-dark"
                ? this._settings.get_string("dark-fg-color")
                : this._settings.get_string("light-fg-color")
            };`,
          );
        });
        const removeSignal = area.container.connect(
          "child-removed",
          (_, child) => {
            this._updateActorStyle(child);
          },
        );
        this._traySignals.push({ area, addSignal, removeSignal });
      }
    }
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

    if (this._traySignals) {
      for (const { area, addSignal, removeSignal } of this._traySignals) {
        area.container.disconnect(addSignal);
        area.container.disconnect(removeSignal);
      }
      this._traySignals = null;
    }
    Main.panel.set_style("");
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

    // 更新状态栏按钮
    Object.values(Main.panel.statusArea).forEach((area) => {
      this._updateActorStyle(area, `color: ${foregroundColor};`);
    });

    // 更新 activities dot
    const activities = Main.panel.statusArea.activities?.first_child;
    if (activities && activities.get_children) {
      activities.get_children().forEach((dotWrapper) => {
        const dot = dotWrapper._dot;
        if (dot)
          this._updateActorStyle(dot, `background-color: ${foregroundColor};`);
      });
    }
  }

  // 核心方法：安全修改 Actor 样式
  _updateActorStyle(actor, style = "") {
    if (!actor) return;

    if (actor.get_allocation_box && actor.get_allocation_box()) {
      actor.set_style(style);
    } else {
      actor.connect_once("notify::allocation", () => actor.set_style(style));
    }
  }
}
