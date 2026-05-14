import Gio from "gi://Gio";
import GLib from "gi://GLib";
import Func from "./lib/func.js";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import {
  StageContrastSampler,
  AdaptiveContrastConfig,
} from "./contrastSampler.js";

export default class DynamicPanelExtension extends Extension {
  enable() {
    this._settings = this.getSettings();
    this._colorSchemeSettings = new Gio.Settings({
      schema: "org.gnome.desktop.interface",
    });
    this._enableTheme = this._settings.get_boolean("enable-theme");

    this._colorSchemeSignal = this._colorSchemeSettings.connect(
      "changed::color-scheme",
      () => {
        this._schedulePanelRefresh(250);
      },
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
            "enable-theme",
          ].includes(key)
        ) {
          this._schedulePanelRefresh(250);
        }
      },
    );
    this._leftBoxSignal = Main.panel._leftBox.connect("child-added", () => {
      this._schedulePanelRefresh(250);
    });
    this._centerBoxSignal = Main.panel._centerBox.connect("child-added", () => {
      this._schedulePanelRefresh(250);
    });
    this._rightBoxSignal = Main.panel._rightBox.connect("child-added", () => {
      this._schedulePanelRefresh(250);
    });
    this._contrastSampler = new StageContrastSampler();
    this._panelSignals = [];
    const panelBox = Main.layoutManager.panelBox;
    this._panelSignals.push(
      panelBox.connect("notify::visible", () => {
        this._schedulePanelRefresh(250);
      }),
    );
    const overview = Main.overview;
    this._overviewSignals = [];
    this._overviewSignals = [
      overview.connect("shown", () => {
        this._schedulePanelRefresh(250);
      }),
      overview.connect("hidden", () => {
        this._schedulePanelRefresh(250);
      }),
    ];

    this._updatingPanelColors = false;
    this._panelRefreshTimeoutId = null;
    this._foregroundColor = null;

    // 用户登录时执行，但通过 allocation 确保 Actor 初始化完成再修改
    this._schedulePanelRefresh(250);
  }

  disable() {
    if (this._panelRefreshTimeoutId) {
      GLib.source_remove(this._panelRefreshTimeoutId);
      this._panelRefreshTimeoutId = null;
    }
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
    if (this._contrastSampler) {
      this._contrastSampler.destroy();
    }
    if (this._overviewSignals) {
      this._overviewSignals.forEach((signalId) => {
        Main.overview.disconnect(signalId);
      });
      this._overviewSignals = null;
    }
    if (this._panelSignals) {
      const panelBox = Main.layoutManager.panelBox;
      this._panelSignals.forEach((id) => {
        try {
          panelBox.disconnect(id);
        } catch (e) {
          // signal 已不存在，忽略
        }
      });
      this._panelSignals = null;
    }
    if (this._updatingPanelColors) {
      this._updatingPanelColors = false;
    }
    if (this._foregroundColor) {
      this._foregroundColor = null;
    }
  }

  _schedulePanelRefresh(delay = 180) {
    if (this._panelRefreshTimeoutId) {
      GLib.source_remove(this._panelRefreshTimeoutId);
      this._panelRefreshTimeoutId = null;
    }

    this._panelRefreshTimeoutId = GLib.timeout_add(
      GLib.PRIORITY_DEFAULT,
      delay,
      () => {
        this._panelRefreshTimeoutId = null;

        this._updatePanelColors().catch((e) => {
          console.error(e);
        });

        return GLib.SOURCE_REMOVE;
      },
    );
  }

  async _updatePanelColors() {
    this._enableTheme = this._settings.get_boolean("enable-theme");
    if (this._updatingPanelColors) return;
    this._updatingPanelColors = true;

    try {
      // 1. 获取 panel 区域 actor
      const panelActors = [
        Main.panel._leftBox,
        Main.panel._centerBox,
        Main.panel._rightBox,
      ];

      if (!this._enableTheme) {
        // 2. 采样亮度并决定颜色
        const luminance = await this._contrastSampler.sampleTopBarLuminance(
          AdaptiveContrastConfig,
        );

        this._foregroundColor = this._contrastSampler.decideTextColor(
          luminance,
          AdaptiveContrastConfig,
        );
      } else {
        const isDarkMode =
          this._colorSchemeSettings.get_string("color-scheme") ===
          "prefer-dark";
        this._foregroundColor = isDarkMode
          ? this._settings.get_string("dark-fg-color")
          : this._settings.get_string("light-fg-color");
      }

      // 更新 panel 背景区域
      panelActors.forEach((area) => {
        area.set_style("");
      });

      const _panelButtons = Object.values(Main.panel.statusArea);
      for (const element of _panelButtons) {
        Func.updateStyle(element, "color", `${this._foregroundColor}`);
      }
      for (const dot of Main.panel.statusArea.activities.first_child.get_children()) {
        Func.updateStyle(
          dot._dot,
          "background-color",
          `${this._foregroundColor}`,
        );
      }
    } finally {
      this._updatingPanelColors = false;
    }
  }
}
