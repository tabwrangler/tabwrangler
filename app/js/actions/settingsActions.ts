import { SetThemeSettingAction } from "../reducers/settingsReducer";
import { ThemeSettingValue } from "../Types";

export function setTheme(theme: ThemeSettingValue): SetThemeSettingAction {
  return { key: "theme", value: theme, type: "SET_THEME_SETTING" };
}
