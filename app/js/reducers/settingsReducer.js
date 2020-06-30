/* @flow */

import type { ThemeSettingValue } from '../Types';

type SetPausedAction = {
  key: 'paused',
  type: 'SET_PAUSED_SETTING',
  value: boolean,
};

type SetThemeSettingAction = {
  key: 'theme',
  type: 'SET_THEME_SETTING',
  value: ThemeSettingValue,
};

export type Action = SetPausedAction | SetThemeSettingAction;

export type State = {
  // If TabWrangler is paused (won't count down)
  paused: boolean,

  // Which color theme to use for Tab Wrangler. Can be 'dark', 'light', or 'system'
  theme: ThemeSettingValue,
};

function createInitialState() {
  return {
    paused: false,
    theme: 'system',
  };
}

const initialState = createInitialState();
export default function settingsReducer(state: State = initialState, action: Action) {
  switch (action.type) {
    case 'SET_PAUSED_SETTING':
      return {
        ...state,
        paused: action.value,
      };
    case 'SET_THEME_SETTING':
      return {
        ...state,
        theme: action.value,
      };
    default:
      return state;
  }
}
