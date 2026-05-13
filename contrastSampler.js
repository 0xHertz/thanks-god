import GLib from "gi://GLib";
import Shell from "gi://Shell";
import GdkPixbuf from "gi://GdkPixbuf";
import Gio from "gi://Gio";
import * as Main from "resource:///org/gnome/shell/ui/main.js";

export const AdaptiveContrastConfig = {
  enabled: true,

  // 采样频率建议不要低于 100ms
  sampleIntervalMs: 200,

  // 大于该亮度使用深色文字
  luminanceThreshold: 0.42,

  lightTextColor: "#f2f2f2",
  darkTextColor: "#1a1a1a",

  // 顶栏采样高度
  sampleHeight: 48,

  // 水平方向采样块数量
  horizontalSamples: 3,

  // 每个采样块尺寸
  sampleBoxWidth: 96,
  sampleBoxHeight: 48,
};

function _clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function _srgbToLinear(c) {
  const n = c / 255.0;

  if (n <= 0.04045) return n / 12.92;

  return Math.pow((n + 0.055) / 1.055, 2.4);
}

function _luminanceFromRgb(r, g, b) {
  const rl = _srgbToLinear(r);
  const gl = _srgbToLinear(g);
  const bl = _srgbToLinear(b);

  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

function _trimmedMean(values, trimRatio = 0.1) {
  if (!values.length) return null;

  const sorted = [...values].sort((a, b) => a - b);

  const trim = Math.floor(sorted.length * trimRatio);

  const start = _clamp(trim, 0, sorted.length - 1);
  const end = _clamp(sorted.length - trim, start + 1, sorted.length);

  let sum = 0;

  for (let i = start; i < end; i++) sum += sorted[i];

  return sum / (end - start);
}

function _buildTempPath() {
  const token = `${GLib.get_monotonic_time()}-${Math.floor(Math.random() * 1000000)}`;

  return `${GLib.get_tmp_dir()}/panel-sample-${token}.png`;
}

function _sanitizeRect(rect) {
  if (!rect) return null;

  const monitor = global.display.get_monitor_geometry(
    global.display.get_primary_monitor(),
  );

  let x = Math.floor(rect.x);
  let y = Math.floor(rect.y);
  let width = Math.floor(rect.width);
  let height = Math.floor(rect.height);

  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height)
  ) {
    return null;
  }

  width = Math.max(1, width);
  height = Math.max(1, height);

  x = _clamp(x, monitor.x, monitor.x + monitor.width - 1);

  y = _clamp(y, monitor.y, monitor.y + monitor.height - 1);

  width = Math.min(width, monitor.width - (x - monitor.x));

  height = Math.min(height, monitor.height - (y - monitor.y));

  if (width <= 0 || height <= 0) return null;

  return {
    x,
    y,
    width,
    height,
  };
}

async function _captureAreaToFile(screenshot, rect, filePath) {
  return new Promise((resolve) => {
    try {
      const file = Gio.File.new_for_path(filePath);

      const stream = file.replace(
        null,
        false,
        Gio.FileCreateFlags.REPLACE_DESTINATION,
        null,
      );

      screenshot.screenshot_area(
        rect.x,
        rect.y,
        rect.width,
        rect.height,
        stream,
        (obj, res) => {
          try {
            obj.screenshot_area_finish(res);

            try {
              stream.close(null);
            } catch (_) {}

            resolve(true);
          } catch (e) {
            console.error(`[Thanks-God] Screenshot finish failed: ${e}`);

            try {
              stream.close(null);
            } catch (_) {}

            resolve(false);
          }
        },
      );
    } catch (e) {
      console.error(`[Thanks-God] Screenshot API failed: ${e}`);

      resolve(false);
    }
  });
}

export class StageContrastSampler {
  constructor() {
    this._screenshot = new Shell.Screenshot();

    // screenshot API 不允许并发
    this._busy = false;
  }

  async _captureLuminance(rect) {
    rect = _sanitizeRect(rect);

    if (!rect) return null;

    const filePath = _buildTempPath();

    try {
      const captured = await _captureAreaToFile(
        this._screenshot,
        rect,
        filePath,
      );

      if (!captured) return null;

      const pixbuf = GdkPixbuf.Pixbuf.new_from_file(filePath);

      if (!pixbuf) return null;

      const width = pixbuf.get_width();
      const height = pixbuf.get_height();
      const rowstride = pixbuf.get_rowstride();
      const channels = pixbuf.get_n_channels();
      const hasAlpha = pixbuf.get_has_alpha();

      const pixels = pixbuf.get_pixels();

      const values = [];

      // 降采样
      const step = Math.max(1, Math.floor(Math.min(width, height) / 32));

      for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
          const idx = y * rowstride + x * channels;

          if (hasAlpha) {
            const a = pixels[idx + 3];

            if (a < 32) continue;
          }

          const r = pixels[idx + 0];
          const g = pixels[idx + 1];
          const b = pixels[idx + 2];

          values.push(_luminanceFromRgb(r, g, b));
        }
      }

      return _trimmedMean(values, 0.1);
    } catch (e) {
      console.error(`[Thanks-God] Failed to analyze screenshot: ${e}`);

      return null;
    } finally {
      try {
        GLib.unlink(filePath);
      } catch (_) {}
    }
  }

  async sampleTopBarLuminance(config = AdaptiveContrastConfig) {
    // 防止 screenshot 并发
    if (this._busy) return null;

    this._busy = true;

    try {
      const monitorIndex = global.display.get_primary_monitor();

      const monitor = global.display.get_monitor_geometry(monitorIndex);

      const panelHeight = Math.max(1, Main.panel.height || config.sampleHeight);

      const sampleHeight = Math.max(panelHeight, config.sampleHeight);

      const samples = [];

      const count = Math.max(1, config.horizontalSamples);

      for (let i = 0; i < count; i++) {
        const t = count === 1 ? 0.5 : i / (count - 1);

        const centerX = monitor.x + Math.floor(monitor.width * t);

        const rect = {
          x: centerX - Math.floor(config.sampleBoxWidth / 2),

          y: monitor.y,

          width: config.sampleBoxWidth,

          height: Math.min(sampleHeight, config.sampleBoxHeight),
        };

        const luma = await this._captureLuminance(rect);

        if (luma !== null) samples.push(luma);
      }

      if (!samples.length) return null;

      return _trimmedMean(samples, 0.15);
    } finally {
      this._busy = false;
    }
  }

  decideTextColor(luminance, config = AdaptiveContrastConfig) {
    if (luminance === null || luminance === undefined) {
      return config.lightTextColor;
    }

    return luminance > config.luminanceThreshold
      ? config.darkTextColor
      : config.lightTextColor;
  }

  destroy() {
    this._screenshot = null;
  }
}
