/* @flow */

import type { SetThemeSettingAction } from "../reducers/settingsReducer";
import type { ThemeSettingValue } from "../Types";

export function setTheme(theme: ThemeSettingValue): SetThemeSettingAction {
  return { key: "theme", value: theme, type: "SET_THEME_SETTING" };
}
