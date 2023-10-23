import {
  Action as LocalStorageAction,
  State as LocalStorageState,
} from "./reducers/localStorageReducer";

export type ThemeSettingValue = "dark" | "light" | "system";

type StoreAction = LocalStorageAction;

export type AppState = {
  localStorage: LocalStorageState;
};

/*
 * Redux + Redux Thunk
 */
export type GetState = () => AppState;
type ThunkAction = (dispatch: Dispatch, getState: GetState) => unknown;
type PromiseAction = Promise<StoreAction>;
export type Action = PromiseAction | StoreAction | ThunkAction;
export type Dispatch = (action: Action) => unknown;
