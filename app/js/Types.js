/* @flow */

import {
  type Action as LocalStorageAction,
  type State as LocalStorageState,
} from './reducers/localStorageReducer';
import {
  type Action as TempStorageAction,
  type State as TempStorageState,
} from './reducers/tempStorageReducer';

type Action = LocalStorageAction | TempStorageAction;

type AppState = {
  localStorage: LocalStorageState,
  tempStorage: TempStorageState,
};

/*
 * Redux + Redux Thunk
 */
export type GetState = () => AppState;
type ThunkAction = (dispatch: Dispatch, getState: GetState) => any;
export type Dispatch = (action: Action | ThunkAction) => any;
