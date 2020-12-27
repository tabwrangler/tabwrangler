/* @flow */

import type { Action, AppState } from "../Types";
import configureStore, { type mockStoreWithoutMiddleware } from "redux-mock-store";
import { createInitialState as lsCreateInitialState } from "../reducers/localStorageReducer";
import thunk from "redux-thunk";
import { createInitialState as tsCreateInitialState } from "../reducers/tempStorageReducer";

type MockInitialState = {
  localStorage?: Object,
  tempStorage?: Object,
};

export default function configureMockStore(
  initialState: MockInitialState = { localStorage: null, tempStorage: null }
): mockStoreWithoutMiddleware<AppState, Action> {
  return configureStore([thunk])<AppState, Action>({
    localStorage: {
      ...lsCreateInitialState(),
      ...(initialState.localStorage == null ? {} : initialState.localStorage),
    },
    settings: {
      paused: false,
      theme: "system",
    },
    tempStorage: {
      ...tsCreateInitialState(),
      ...(initialState.tempStorage == null ? {} : initialState.tempStorage),
    },
  });
}
