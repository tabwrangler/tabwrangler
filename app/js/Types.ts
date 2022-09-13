import {
  Action as LocalStorageAction,
  State as LocalStorageState,
} from "./reducers/localStorageReducer";
import { Action as SettingsAction, State as SettingsState } from "./reducers/settingsReducer";
import {
  Action as TempStorageAction,
  State as TempStorageState,
} from "./reducers/tempStorageReducer";

export type ThemeSettingValue = "dark" | "light" | "system";

type StoreAction = LocalStorageAction | SettingsAction | TempStorageAction;

export type AppState = {
  localStorage: LocalStorageState;
  settings: SettingsState;
  tempStorage: TempStorageState;
};

/*
 * Redux + Redux Thunk
 */
export type GetState = () => AppState;
type ThunkAction = (dispatch: Dispatch, getState: GetState) => unknown;
type PromiseAction = Promise<StoreAction>;
export type Action = PromiseAction | StoreAction | ThunkAction;
export type Dispatch = (action: Action) => unknown;
