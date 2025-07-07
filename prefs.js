import Adw from "gi://Adw";
import Gtk from "gi://Gtk";
import Gdk from "gi://Gdk";
import Gio from "gi://Gio";
import {
  ExtensionPreferences,
  gettext as _,
} from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

export default class extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    let settings = (window._settings = this.getSettings());

    const gColors = new Adw.PreferencesGroup({ title: _("Custom Colors") });

    // Dark Mode Colors
    let cDBGColor = new Gtk.ColorButton();
    cDBGColor.set_use_alpha(false);
    cDBGColor.connect("color-set", () => {
      let newColor = cDBGColor.get_rgba();
      settings.set_string("dark-bg-color", newColor.to_string());
    });
    let cDFGColor = new Gtk.ColorButton();
    cDFGColor.set_use_alpha(false);
    cDFGColor.connect("color-set", () => {
      let newColor = cDFGColor.get_rgba();
      settings.set_string("dark-fg-color", newColor.to_string());
    });

    // Light Mode Colors
    let cLBGColor = new Gtk.ColorButton();
    cLBGColor.set_use_alpha(false);
    cLBGColor.connect("color-set", () => {
      let newColor = cLBGColor.get_rgba();
      settings.set_string("light-bg-color", newColor.to_string());
    });
    let cLFGColor = new Gtk.ColorButton();
    cLFGColor.set_use_alpha(false);
    cLFGColor.connect("color-set", () => {
      let newColor = cLFGColor.get_rgba();
      settings.set_string("light-fg-color", newColor.to_string());
    });

    // Initialize color values
    let rgba = new Gdk.RGBA();
    rgba.parse(settings.get_string("dark-bg-color"));
    cDBGColor.set_rgba(rgba);
    rgba.parse(settings.get_string("dark-fg-color"));
    cDFGColor.set_rgba(rgba);
    rgba.parse(settings.get_string("light-bg-color"));
    cLBGColor.set_rgba(rgba);
    rgba.parse(settings.get_string("light-fg-color"));
    cLFGColor.set_rgba(rgba);

    let rowDColors = new Adw.ExpanderRow({ title: _("Dark Mode") });
    let rowDBGColor = new Adw.ActionRow({ title: _("Background Color") });
    rowDBGColor.add_suffix(cDBGColor);
    let rowDFGColor = new Adw.ActionRow({ title: _("Foreground Color") });
    rowDFGColor.add_suffix(cDFGColor);
    rowDColors.add_row(rowDBGColor);
    rowDColors.add_row(rowDFGColor);

    let rowLColors = new Adw.ExpanderRow({ title: _("Light Mode") });
    let rowLBGColor = new Adw.ActionRow({ title: _("Background Color") });
    rowLBGColor.add_suffix(cLBGColor);
    let rowLFGColor = new Adw.ActionRow({ title: _("Foreground Color") });
    rowLFGColor.add_suffix(cLFGColor);
    rowLColors.add_row(rowLBGColor);
    rowLColors.add_row(rowLFGColor);

    gColors.add(rowDColors);
    gColors.add(rowLColors);

    const pageColors = new Adw.PreferencesPage({
      name: "colors",
      title: _("Custom Colors"),
      iconName: `dp-panel-generic-symbolic`,
    });
    pageColors.add(gColors);

    window.set_search_enabled(false);
    window.set_default_size(400, 300);
    window.add(pageColors);
  }
}
