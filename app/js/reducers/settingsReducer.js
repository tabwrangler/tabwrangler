/* @flow */

import type { ThemeSettingValue } from '../Types';

type SetThemeSettingAction = {
  key: 'theme',
  type: 'SET_THEME_SETTING',
  value: ThemeSettingValue,
};

export type Action = SetThemeSettingAction;

export type State = {
  // Which color theme to use for Tab Wrangler. Can be 'dark', 'light', or 'system'
  theme: ThemeSettingValue,
};

function createInitialState() {
  return {
    theme: 'system',
  };
}

const initialState = createInitialState();
export default function settingsReducer(state: State = initialState, action: Action) {
  switch (action.type) {
    case 'SET_THEME_SETTING':
      return {
        ...state,
        [action.key]: action.value,
      };
    default:
      return state;
  }
}
