/* @flow */

import {
  type Action as LocalStorageAction,
  type State as LocalStorageState,
} from "./reducers/localStorageReducer";
import {
  type Action as SettingsAction,
  type State as SettingsState,
} from "./reducers/settingsReducer";
import {
  type Action as TempStorageAction,
  type State as TempStorageState,
} from "./reducers/tempStorageReducer";

export type ThemeSettingValue = "dark" | "light" | "system";

type StoreAction = LocalStorageAction | SettingsAction | TempStorageAction;

export type AppState = {
  +localStorage: LocalStorageState,
  +settings: SettingsState,
  +tempStorage: TempStorageState,
};

/*
 * Redux + Redux Thunk
 */
export type GetState = () => AppState;
type ThunkAction = (dispatch: Dispatch, getState: GetState) => any;
type PromiseAction = Promise<StoreAction>;
export type Action = PromiseAction | StoreAction | ThunkAction;
export type Dispatch = (action: Action) => any;
