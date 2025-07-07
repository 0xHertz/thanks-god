import Meta from "gi://Meta";
import St from "gi://St";
import Gio from "gi://Gio";

import * as Main from "resource:///org/gnome/shell/ui/main.js";

export default class Func {
  constructor() {}
  // 獲取現有樣式
  static getStyle(obj) {
    const style = obj.get_style();
    const propertiesAndValues = new Object();
    if (style) {
      const regex = /\s*([^:;]+)\s*:\s*([^;]+)\s*;?/g;
      const matches = style.matchAll(regex);
      for (const match of matches) {
        const property = match[1].trim();
        const value = match[2].trim();
        propertiesAndValues[property] = value;
      }
      return propertiesAndValues;
    }
    return {};
  }
  // 更新單個樣式
  static updateStyle(obj, prop, value) {
    // 獲取現有樣式
    const propertiesAndValues = Func.getStyle(obj);
    // 更新新樣式並設定回
    let newStyle = [];
    propertiesAndValues[prop] = value;
    if (value == "") {
      delete propertiesAndValues[prop];
    }
    for (const property in propertiesAndValues) {
      const value = propertiesAndValues[property];
      newStyle.push(`${property}: ${value};`);
    }
    newStyle = newStyle.join(" ");
    obj.set_style(newStyle);
  }
}
