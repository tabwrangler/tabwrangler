/* @flow */

import type { ThemeSettingValue } from '../Types';

export function setTheme(theme: ThemeSettingValue) {
  return { key: 'theme', value: theme, type: 'SET_THEME_SETTING' };
}
