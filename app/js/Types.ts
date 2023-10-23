import {
  Action as LocalStorageAction,
  State as LocalStorageState,
} from "./reducers/localStorageReducer";
import {
  Action as TempStorageAction,
  State as TempStorageState,
} from "./reducers/tempStorageReducer";

export type ThemeSettingValue = "dark" | "light" | "system";

type StoreAction = LocalStorageAction | TempStorageAction;

export type AppState = {
  localStorage: LocalStorageState;
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
