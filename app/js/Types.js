/* @flow */

import type { Action as LocalStorageAction } from './reducers/localStorageReducer';
import type { Action as TempStorageAction } from './reducers/tempStorageReducer';

type Action = LocalStorageAction | TempStorageAction;

/*
 * React Redux
 */

export type Dispatch = (action: Action) => any;
